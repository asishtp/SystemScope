using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace SystemScope.Api;

public class AppUser
{
    public string UserId { get; set; } = "";
    public string Email { get; set; } = "";
    public string? DisplayName { get; set; }
    public string Roles { get; set; } = "user";
    public string Permissions { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string AccessStatus { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime? AccessRequestedAt { get; set; }
    public DateTime? AccessApprovedAt { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByEmail { get; set; }
    public string? AccessNotes { get; set; }
}

public static class AppIdentity
{
    public const string AdminRole = "admin";
    public const string UserRole = "user";
    public const string UsersManagePermission = "security.users.manage";

    public static string? UserId(ClaimsPrincipal user) =>
        FirstClaim(user, "oid", "http://schemas.microsoft.com/identity/claims/objectidentifier", ClaimTypes.NameIdentifier, "sub");

    public static string? Email(ClaimsPrincipal user) =>
        FirstClaim(user, "preferred_username", "email", "upn", ClaimTypes.Email, "unique_name");

    public static string? DisplayName(ClaimsPrincipal user) =>
        FirstClaim(user, "name", ClaimTypes.Name) ?? Email(user);

    public static bool CanManageUsers(AppUser user)
    {
        var roles = Split(user.Roles);
        var permissions = Split(user.Permissions);
        return roles.Contains(AdminRole, StringComparer.OrdinalIgnoreCase)
            || roles.Contains("Administrator", StringComparer.OrdinalIgnoreCase)
            || permissions.Contains(UsersManagePermission, StringComparer.OrdinalIgnoreCase);
    }

    public static string[] Split(string? value) =>
        (value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    static string? FirstClaim(ClaimsPrincipal user, params string[] types)
    {
        foreach (var type in types)
        {
            var value = user.FindFirstValue(type);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }
}

public class AppAccessService(AppDbContext db)
{
    public Task<AppUser?> GetByIdAsync(string userId) =>
        db.AppUsers.FirstOrDefaultAsync(x => x.UserId == userId);

    public Task<AppUser?> GetByEmailAsync(string email) =>
        db.AppUsers.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());

    public async Task<AppUser?> ResolveAsync(string? userId, string? email)
    {
        AppUser? user = null;
        if (!string.IsNullOrWhiteSpace(userId)) user = await GetByIdAsync(userId);
        if (user is null && !string.IsNullOrWhiteSpace(email)) user = await GetByEmailAsync(email);
        if (user is not null && !string.IsNullOrWhiteSpace(userId) && user.UserId != userId)
        {
            user.UserId = userId;
            user.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return user;
    }

    public async Task<List<AppUser>> ListAsync(string? accessStatus = null)
    {
        var query = db.AppUsers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(accessStatus))
            query = query.Where(x => x.AccessStatus == accessStatus);
        return await query
            .OrderBy(x => x.AccessStatus == "Pending" ? 0 : x.AccessStatus == "Approved" ? 1 : 2)
            .ThenByDescending(x => x.AccessRequestedAt ?? x.UpdatedAt ?? x.CreatedAt)
            .ToListAsync();
    }

    public async Task<AppUser> RequestAccessAsync(string userId, string email, string? displayName, string? notes)
    {
        var existing = await ResolveAsync(userId, email);
        var now = DateTime.UtcNow;
        if (existing is not null)
        {
            if (string.Equals(existing.AccessStatus, "Approved", StringComparison.OrdinalIgnoreCase) && existing.IsActive)
                return existing;
            existing.DisplayName = displayName ?? existing.DisplayName;
            existing.AccessStatus = "Pending";
            existing.IsActive = true;
            existing.AccessRequestedAt = now;
            existing.AccessNotes = notes;
            existing.UpdatedAt = now;
            await db.SaveChangesAsync();
            return existing;
        }

        var firstUser = !await db.AppUsers.AnyAsync();
        var user = new AppUser
        {
            UserId = userId,
            Email = email,
            DisplayName = displayName,
            Roles = firstUser ? $"{AppIdentity.AdminRole},{AppIdentity.UserRole}" : AppIdentity.UserRole,
            Permissions = firstUser ? AppIdentity.UsersManagePermission : "",
            IsActive = true,
            AccessStatus = firstUser ? "Approved" : "Pending",
            CreatedAt = now,
            UpdatedAt = now,
            AccessRequestedAt = now,
            AccessApprovedAt = firstUser ? now : null,
            ApprovedByUserId = firstUser ? userId : null,
            ApprovedByEmail = firstUser ? email : null,
            AccessNotes = notes,
        };
        db.AppUsers.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<AppUser?> UpdateAsync(string userId, string accessStatus, string roles, bool isActive, string? notes, string? approvedByUserId, string? approvedByEmail)
    {
        var user = await GetByIdAsync(userId);
        if (user is null) return null;
        var approved = string.Equals(accessStatus, "Approved", StringComparison.OrdinalIgnoreCase);
        user.AccessStatus = accessStatus;
        user.Roles = string.IsNullOrWhiteSpace(roles) && approved ? AppIdentity.UserRole : roles;
        if (approved && !AppIdentity.Split(user.Roles).Contains(AppIdentity.UserRole, StringComparer.OrdinalIgnoreCase))
            user.Roles = string.IsNullOrWhiteSpace(user.Roles) ? AppIdentity.UserRole : $"{user.Roles},{AppIdentity.UserRole}";
        if (approved && AppIdentity.Split(user.Roles).Contains(AppIdentity.AdminRole, StringComparer.OrdinalIgnoreCase)
            && !AppIdentity.Split(user.Permissions).Contains(AppIdentity.UsersManagePermission, StringComparer.OrdinalIgnoreCase))
            user.Permissions = string.IsNullOrWhiteSpace(user.Permissions)
                ? AppIdentity.UsersManagePermission
                : $"{user.Permissions},{AppIdentity.UsersManagePermission}";
        user.IsActive = isActive;
        user.AccessNotes = notes;
        user.UpdatedAt = DateTime.UtcNow;
        if (approved)
        {
            user.AccessApprovedAt = DateTime.UtcNow;
            user.ApprovedByUserId = approvedByUserId;
            user.ApprovedByEmail = approvedByEmail;
        }
        await db.SaveChangesAsync();
        return user;
    }

    public async Task TouchLoginAsync(AppUser user)
    {
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
}

public static class AccessApi
{
    public static void MapAccess(this WebApplication app)
    {
        app.MapGet("/api/auth/entra-config", (IOptions<EntraIdSettings> entra) =>
        {
            var s = entra.Value;
            var tenant = s.TenantId;
            return Results.Ok(new
            {
                tenantId = tenant,
                authority = string.IsNullOrWhiteSpace(s.Authority) && !string.IsNullOrWhiteSpace(tenant)
                    ? $"https://login.microsoftonline.com/{tenant}"
                    : s.Authority,
                clientId = s.ClientId,
                apiClientId = s.ApiClientId,
                audience = string.IsNullOrWhiteSpace(s.Audience) ? s.ApiClientId : s.Audience,
                scope = s.Scope,
            });
        }).AllowAnonymous();

        var auth = app.MapGroup("/api/auth").RequireAuthorization();
        auth.MapGet("/me", async (ClaimsPrincipal u, AppAccessService access) =>
        {
            var userId = AppIdentity.UserId(u);
            var email = AppIdentity.Email(u);
            var name = AppIdentity.DisplayName(u);
            var appUser = await access.ResolveAsync(userId, email);
            if (appUser is null)
                return Results.Json(AccessState(email ?? userId ?? "", name, "NotRequested", null, true), statusCode: 403);
            if (!appUser.IsActive || !string.Equals(appUser.AccessStatus, "Approved", StringComparison.OrdinalIgnoreCase))
                return Results.Json(AccessState(appUser.Email, appUser.DisplayName ?? name, appUser.AccessStatus, appUser.AccessRequestedAt, !string.Equals(appUser.AccessStatus, "Pending", StringComparison.OrdinalIgnoreCase)), statusCode: 403);
            await access.TouchLoginAsync(appUser);
            return Results.Ok(new
            {
                userId = appUser.UserId,
                email = appUser.Email,
                displayName = appUser.DisplayName ?? name,
                roles = AppIdentity.Split(appUser.Roles),
                permissions = AppIdentity.Split(appUser.Permissions),
            });
        });
        auth.MapPost("/request-access", async (AccessRequestInput? body, ClaimsPrincipal u, AppAccessService access) =>
        {
            var userId = AppIdentity.UserId(u);
            var email = AppIdentity.Email(u);
            if (string.IsNullOrWhiteSpace(userId))
                return Results.BadRequest(new { message = "No user id claim was provided by the identity provider." });
            var accessEmail = string.IsNullOrWhiteSpace(email) ? userId : email;
            var existing = await access.ResolveAsync(userId, accessEmail);
            if (existing is not null && string.Equals(existing.AccessStatus, "Approved", StringComparison.OrdinalIgnoreCase) && existing.IsActive)
                return Results.Ok(AccessState(existing.Email, existing.DisplayName, existing.AccessStatus, existing.AccessRequestedAt, false, "Your access is already approved."));
            var requested = await access.RequestAccessAsync(userId, accessEmail, body?.DisplayName ?? AppIdentity.DisplayName(u), body?.Notes);
            var first = string.Equals(requested.AccessStatus, "Approved", StringComparison.OrdinalIgnoreCase);
            return Results.Ok(AccessState(requested.Email, requested.DisplayName, requested.AccessStatus, requested.AccessRequestedAt, false,
                first ? "You are the first SystemScope user and have been approved as an administrator." : "Your access request has been submitted for admin approval."));
        });

        var users = app.MapGroup("/api/security/users").RequireAuthorization();
        users.MapGet("", async (string? accessStatus, ClaimsPrincipal u, AppAccessService access) =>
        {
            var manager = await access.ResolveAsync(AppIdentity.UserId(u), AppIdentity.Email(u));
            if (manager is null || !AppIdentity.CanManageUsers(manager))
                return Results.Json(new { message = "This section is limited to security managers." }, statusCode: 403);
            var list = await access.ListAsync(accessStatus);
            return Results.Ok(new { totalCount = list.Count, users = list.Select(MapUser) });
        });
        users.MapPatch("/{userId}", async (string userId, UpdateAccessInput body, ClaimsPrincipal u, AppAccessService access) =>
        {
            var manager = await access.ResolveAsync(AppIdentity.UserId(u), AppIdentity.Email(u));
            if (manager is null || !AppIdentity.CanManageUsers(manager))
                return Results.Json(new { message = "This section is limited to security managers." }, statusCode: 403);
            var updated = await access.UpdateAsync(userId, body.AccessStatus, string.Join(",", body.Roles ?? []), body.IsActive, body.Notes, manager.UserId, manager.Email);
            return updated is null ? Results.NotFound(new { message = "User not found." }) : Results.Ok(MapUser(updated));
        });
    }

    public static IApplicationBuilder UseApplicationAccessGate(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? "";
            var allowed =
                path.Equals("/api/auth/entra-config", StringComparison.OrdinalIgnoreCase) ||
                path.Equals("/api/auth/me", StringComparison.OrdinalIgnoreCase) ||
                path.Equals("/api/auth/request-access", StringComparison.OrdinalIgnoreCase) ||
                path.Equals("/health", StringComparison.OrdinalIgnoreCase);
            if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) || allowed || context.User.Identity?.IsAuthenticated != true)
            {
                await next();
                return;
            }
            if (string.Equals(context.User.Identity?.AuthenticationType, "Development", StringComparison.OrdinalIgnoreCase))
            {
                await next();
                return;
            }
            var access = context.RequestServices.GetRequiredService<AppAccessService>();
            var appUser = await access.ResolveAsync(AppIdentity.UserId(context.User), AppIdentity.Email(context.User));
            if (appUser is null || !appUser.IsActive || !string.Equals(appUser.AccessStatus, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    message = "You are signed in, but do not yet have application access.",
                    accessStatus = appUser?.AccessStatus ?? "NotRequested",
                });
                return;
            }
            await next();
        });
    }

    static object AccessState(string email, string? displayName, string accessStatus, DateTime? requestedAt, bool canRequest, string? message = null) => new
    {
        email,
        displayName,
        accessStatus,
        canRequestAccess = canRequest,
        message = message ?? (string.Equals(accessStatus, "Pending", StringComparison.OrdinalIgnoreCase)
            ? "Your access request has been submitted for admin approval."
            : "You are signed in, but do not yet have application access."),
        accessRequestedAt = requestedAt,
    };

    static object MapUser(AppUser user) => new
    {
        userId = user.UserId,
        email = user.Email,
        displayName = user.DisplayName,
        roles = AppIdentity.Split(user.Roles),
        permissions = AppIdentity.Split(user.Permissions),
        isActive = user.IsActive,
        accessStatus = user.AccessStatus,
        accessRequestedAt = user.AccessRequestedAt,
        accessApprovedAt = user.AccessApprovedAt,
        approvedByEmail = user.ApprovedByEmail,
        accessNotes = user.AccessNotes,
        lastLoginAt = user.LastLoginAt,
    };
}

public record AccessRequestInput(string? DisplayName, string? Notes);
public record UpdateAccessInput(string AccessStatus, string[]? Roles, bool IsActive, string? Notes);
