using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class CatalogApi
{
    public static void MapCatalog(this RouteGroupBuilder api)
    {
        api.MapGet("/capabilities", ListCapabilities);
        api.MapPost("/capabilities", CreateCapability);
        api.MapGet("/capabilities/{id}", GetCapability);
        api.MapPut("/capabilities/{id}", UpdateCapability);
        api.MapPost("/capabilities/{id}/archive", ArchiveCapability);

        api.MapGet("/master-systems/{id:guid}/capabilities", (Guid id, AppDbContext db) => ListCoverage(id, db));
        api.MapPost("/master-systems/{id:guid}/capabilities", (Guid id, SystemCapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) => CreateCoverage(id, i, db, audit, u));
        api.MapGet("/systems/{id:guid}/capabilities", async (Guid id, AppDbContext db) =>
        {
            var masterId = await ResolveMasterId(db, id);
            return masterId is null ? Results.NotFound() : await ListCoverage(masterId.Value, db);
        });
        api.MapPost("/systems/{id:guid}/capabilities", async (Guid id, SystemCapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var masterId = await ResolveMasterId(db, id);
            return masterId is null ? Results.NotFound() : await CreateCoverage(masterId.Value, i, db, audit, u);
        });
        api.MapPut("/system-capabilities/{id:guid}", UpdateCoverage);
        api.MapPost("/system-capabilities/{id:guid}/archive", ArchiveCoverage);

        api.MapGet("/information-assets", ListAssets);
        api.MapPost("/information-assets", CreateAsset);
        api.MapGet("/information-assets/{id}", GetAsset);
        api.MapPut("/information-assets/{id}", UpdateAsset);
        api.MapPost("/information-assets/{id}/archive", ArchiveAsset);

        api.MapGet("/master-systems/{id:guid}/information-assets", (Guid id, AppDbContext db) => ListAssetCoverage(id, db));
        api.MapPost("/master-systems/{id:guid}/information-assets", (Guid id, SystemInformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) => CreateAssetCoverage(id, i, db, audit, u));
        api.MapGet("/systems/{id:guid}/information-assets", async (Guid id, AppDbContext db) =>
        {
            var masterId = await ResolveMasterId(db, id);
            return masterId is null ? Results.NotFound() : await ListAssetCoverage(masterId.Value, db);
        });
        api.MapPost("/systems/{id:guid}/information-assets", async (Guid id, SystemInformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var masterId = await ResolveMasterId(db, id);
            return masterId is null ? Results.NotFound() : await CreateAssetCoverage(masterId.Value, i, db, audit, u);
        });
        api.MapPut("/system-information-assets/{id:guid}", UpdateAssetCoverage);
        api.MapPost("/system-information-assets/{id:guid}/archive", ArchiveAssetCoverage);

        api.MapGet("/capabilities/{id}/information-assets", ListCapabilityAssets);
        api.MapPost("/capabilities/{id}/information-assets", LinkCapabilityAsset);
        api.MapPost("/capability-information-assets/{id:guid}/archive", ArchiveCapabilityAsset);

        api.MapGet("/integration-catalog", ListIntegrationCatalog);
        api.MapPost("/integration-catalog", CreateIntegrationCatalog);
        api.MapGet("/integration-catalog/{id}", GetIntegrationCatalog);
        api.MapPut("/integration-catalog/{id}", UpdateIntegrationCatalog);
        api.MapPost("/integration-catalog/{id}/archive", ArchiveIntegrationCatalog);

        api.MapGet("/evidence/{id:guid}/links", ListEvidenceLinks);
        api.MapPost("/evidence/{id:guid}/links", CreateEvidenceLink);
        api.MapPost("/evidence-links/{id:guid}/archive", ArchiveEvidenceLink);
    }

    public static string CatalogSlug(string name)
    {
        var chars = name.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--", StringComparison.Ordinal)) slug = slug.Replace("--", "-", StringComparison.Ordinal);
        if (slug.Length > 64) slug = slug[..64].TrimEnd('-');
        return slug;
    }

    public static async Task DeriveBusinessCapabilities(AppDbContext db, Guid masterSystemId)
    {
        var names = await (
            from link in db.SystemCapabilities
            join cap in db.BusinessCapabilities on link.CapabilityId equals cap.Id
            where link.MasterSystemId == masterSystemId && !link.Archived && !cap.Archived && link.State == InformationState.Current
            orderby cap.Level, cap.Name
            select cap.Name).ToListAsync();
        var text = string.Join("; ", names);
        var master = await db.MasterSystems.FindAsync(masterSystemId);
        if (master is null) return;
        master.BusinessCapabilities = text;
        foreach (var system in await db.Systems.Where(s => s.MasterSystemId == masterSystemId && !s.Archived).ToListAsync())
            system.BusinessCapabilities = text;
    }

    static async Task<IResult> ListCapabilities(string? q, CapabilityLevel? level, string? domain, bool? includeArchived, AppDbContext db)
    {
        var query = db.BusinessCapabilities.AsQueryable();
        if (includeArchived != true) query = query.Where(x => !x.Archived);
        if (level is { } lv) query = query.Where(x => x.Level == lv);
        if (!string.IsNullOrWhiteSpace(domain)) query = query.Where(x => x.Domain == domain);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(x => x.Name.Contains(term) || x.CatalogKey.Contains(term) || x.Description.Contains(term) || x.Domain.Contains(term) || x.Category.Contains(term));
        }
        var rows = await query.OrderBy(x => x.Level).ThenBy(x => x.Name).ToListAsync();
        var parents = await db.BusinessCapabilities.ToDictionaryAsync(x => x.Id, x => x.Name);
        var counts = await db.SystemCapabilities.Where(x => !x.Archived).GroupBy(x => x.CapabilityId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        return Results.Ok(rows.Select(x => ToListDto(x, parents, counts)));
    }

    static async Task<IResult> CreateCapability(CapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var prepared = await PrepareCapability(i, db, existing: null);
        if (prepared.Error is not null) return prepared.Error;
        var item = prepared.Item!;
        if (await LiveKeyExists(db, item.CatalogKey, null)) return Conflict("A capability with this catalog key already exists.");
        db.BusinessCapabilities.Add(item);
        await audit.Record(db, u, "Create", "BusinessCapability", item.Id, item.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("A capability with this catalog key already exists."); }
        return Results.Created($"/api/capabilities/{item.Id}", item);
    }

    static async Task<IResult> GetCapability(string id, AppDbContext db)
    {
        var item = await FindCapability(db, id);
        if (item is null) return Results.NotFound();
        var parentName = item.ParentId is Guid pid ? (await db.BusinessCapabilities.FindAsync(pid))?.Name : null;
        var children = await db.BusinessCapabilities.Where(x => x.ParentId == item.Id && !x.Archived).OrderBy(x => x.Name).Select(x => new { x.Id, x.CatalogKey, x.Name, level = x.Level.ToString() }).ToListAsync();
        var covering = await (
            from link in db.SystemCapabilities
            join master in db.MasterSystems on link.MasterSystemId equals master.Id
            where link.CapabilityId == item.Id && !link.Archived && !master.Archived
            orderby master.Name
            select new
            {
                link.Id,
                masterSystemId = master.Id,
                master.CatalogKey,
                master.Name,
                role = link.Role.ToString(),
                link.MaturityScore,
                state = link.State.ToString(),
                validation = link.Validation.ToString(),
            }).ToListAsync();
        var linkedAssets = await (
            from link in db.CapabilityInformationAssets
            join asset in db.InformationAssets on link.InformationAssetId equals asset.Id
            where link.CapabilityId == item.Id && !link.Archived && !asset.Archived
            orderby asset.Name
            select new { link.Id, informationAssetId = asset.Id, asset.CatalogKey, asset.Name, classification = asset.Classification.ToString() }).ToListAsync();
        return Results.Ok(new
        {
            item.Id,
            item.CatalogKey,
            item.Name,
            item.Description,
            item.ParentId,
            parentName,
            level = item.Level.ToString(),
            item.Domain,
            item.Category,
            criticality = item.Criticality.ToString(),
            item.Owner,
            item.DefaultMaturityScore,
            item.Archived,
            children,
            coveringSystems = covering,
            systemCount = covering.Count,
            informationAssets = linkedAssets,
        });
    }

    static async Task<IResult> UpdateCapability(string id, CapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindCapability(db, id);
        if (item is null) return Results.NotFound();
        var prepared = await PrepareCapability(i, db, item);
        if (prepared.Error is not null) return prepared.Error;
        var next = prepared.Item!;
        if (await LiveKeyExists(db, next.CatalogKey, item.Id)) return Conflict("A capability with this catalog key already exists.");
        item.CatalogKey = next.CatalogKey;
        item.Name = next.Name;
        item.Description = next.Description;
        item.ParentId = next.ParentId;
        item.Level = next.Level;
        item.Domain = next.Domain;
        item.Category = next.Category;
        item.Criticality = next.Criticality;
        item.Owner = next.Owner;
        item.DefaultMaturityScore = next.DefaultMaturityScore;
        await audit.Record(db, u, "Update", "BusinessCapability", item.Id, item.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("A capability with this catalog key already exists."); }
        return Results.Ok(item);
    }

    static async Task<IResult> ArchiveCapability(string id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindCapability(db, id);
        if (item is null) return Results.NotFound();
        if (await db.BusinessCapabilities.AnyAsync(x => x.ParentId == item.Id && !x.Archived))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["archive"] = ["Archive or unlink child capabilities first."] });
        if (await db.SystemCapabilities.AnyAsync(x => x.CapabilityId == item.Id && !x.Archived))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["archive"] = ["Unlink covering systems before archiving this capability."] });
        if (await db.CapabilityInformationAssets.AnyAsync(x => x.CapabilityId == item.Id && !x.Archived))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["archive"] = ["Unlink information assets before archiving this capability."] });
        item.Archived = true;
        await audit.Record(db, u, "Archive", "BusinessCapability", item.Id, item.Name);
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    static async Task<IResult> ListCoverage(Guid masterSystemId, AppDbContext db)
    {
        if (await db.MasterSystems.FindAsync(masterSystemId) is null) return Results.NotFound();
        var rows = await (
            from link in db.SystemCapabilities
            join cap in db.BusinessCapabilities on link.CapabilityId equals cap.Id
            where link.MasterSystemId == masterSystemId && !link.Archived && !cap.Archived
            orderby cap.Level, cap.Name
            select new
            {
                link.Id,
                capabilityId = cap.Id,
                cap.CatalogKey,
                cap.Name,
                level = cap.Level.ToString(),
                cap.Domain,
                cap.Category,
                role = link.Role.ToString(),
                link.MaturityScore,
                state = link.State.ToString(),
                validation = link.Validation.ToString(),
                link.Notes,
                link.EvidenceId,
            }).ToListAsync();
        return Results.Ok(rows);
    }

    static async Task<IResult> CreateCoverage(Guid masterSystemId, SystemCapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var master = await db.MasterSystems.FindAsync(masterSystemId);
        var cap = await db.BusinessCapabilities.FirstOrDefaultAsync(x => x.Id == i.CapabilityId && !x.Archived);
        if (master is null || cap is null) return Results.NotFound();
        var maturityError = ValidateMaturity(i.MaturityScore);
        if (maturityError is not null) return maturityError;
        var existing = await db.SystemCapabilities.FirstOrDefaultAsync(x => x.MasterSystemId == masterSystemId && x.CapabilityId == i.CapabilityId);
        if (existing is { Archived: false }) return Conflict("This system already covers that capability.");
        if (existing is null)
        {
            existing = new SystemCapability { MasterSystemId = masterSystemId, CapabilityId = i.CapabilityId };
            db.SystemCapabilities.Add(existing);
        }
        ApplyCoverage(existing, i);
        existing.Archived = false;
        await DeriveBusinessCapabilities(db, masterSystemId);
        await audit.Record(db, u, "Create", "SystemCapability", existing.Id, cap.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("This system already covers that capability."); }
        await RecalculateMaster(db, masterSystemId);
        return Results.Created($"/api/system-capabilities/{existing.Id}", existing);
    }

    static async Task<IResult> UpdateCoverage(Guid id, SystemCapabilityInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.SystemCapabilities.FindAsync(id);
        if (item is null) return Results.NotFound();
        var maturityError = ValidateMaturity(i.MaturityScore);
        if (maturityError is not null) return maturityError;
        if (i.CapabilityId != item.CapabilityId)
        {
            if (!await db.BusinessCapabilities.AnyAsync(x => x.Id == i.CapabilityId && !x.Archived)) return Results.NotFound();
            if (await db.SystemCapabilities.AnyAsync(x => x.MasterSystemId == item.MasterSystemId && x.CapabilityId == i.CapabilityId && x.Id != item.Id && !x.Archived))
                return Conflict("This system already covers that capability.");
            item.CapabilityId = i.CapabilityId;
        }
        ApplyCoverage(item, i);
        await DeriveBusinessCapabilities(db, item.MasterSystemId);
        await audit.Record(db, u, "Update", "SystemCapability", item.Id, "SystemCapability");
        await db.SaveChangesAsync();
        await RecalculateMaster(db, item.MasterSystemId);
        return Results.Ok(item);
    }

    static async Task<IResult> ArchiveCoverage(Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.SystemCapabilities.FindAsync(id);
        if (item is null) return Results.NotFound();
        item.Archived = true;
        await DeriveBusinessCapabilities(db, item.MasterSystemId);
        await audit.Record(db, u, "Archive", "SystemCapability", item.Id, "SystemCapability");
        await db.SaveChangesAsync();
        await RecalculateMaster(db, item.MasterSystemId);
        return Results.Ok(item);
    }

    static void ApplyCoverage(SystemCapability item, SystemCapabilityInput i)
    {
        item.Role = i.Role;
        item.MaturityScore = i.MaturityScore;
        item.State = i.State;
        item.Validation = i.Validation;
        item.Notes = i.Notes ?? "";
        item.EvidenceId = i.EvidenceId;
    }

    static async Task<(BusinessCapability? Item, IResult? Error)> PrepareCapability(CapabilityInput i, AppDbContext db, BusinessCapability? existing)
    {
        if (string.IsNullOrWhiteSpace(i.Name))
            return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["A capability name is required."] }));
        var maturityError = ValidateMaturity(i.DefaultMaturityScore);
        if (maturityError is not null) return (null, maturityError);
        BusinessCapability? parent = null;
        if (i.ParentId is Guid pid)
        {
            parent = await db.BusinessCapabilities.FirstOrDefaultAsync(x => x.Id == pid && !x.Archived);
            if (parent is null) return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["The parent capability was not found."] }));
            if (parent.Level == CapabilityLevel.L3)
                return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["L3 capabilities cannot have children."] }));
            if (existing is not null && await WouldCycle(db, existing.Id, pid))
                return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["A capability cannot be nested under itself."] }));
        }
        var inferred = parent is null ? CapabilityLevel.L1 : parent.Level == CapabilityLevel.L1 ? CapabilityLevel.L2 : CapabilityLevel.L3;
        if (i.Level is { } supplied && supplied != inferred)
            return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["level"] = [$"Level must be {inferred} for the selected parent."] }));
        var key = string.IsNullOrWhiteSpace(i.CatalogKey) ? CatalogSlug(i.Name) : i.CatalogKey.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 64)
            return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["catalogKey"] = ["A catalog key of at most 64 characters is required."] }));
        var item = existing ?? new BusinessCapability();
        item.Name = i.Name.Trim();
        item.CatalogKey = key;
        item.Description = (i.Description ?? "").Trim();
        item.ParentId = i.ParentId;
        item.Level = inferred;
        item.Domain = (i.Domain ?? parent?.Domain ?? "").Trim();
        item.Category = (i.Category ?? "").Trim();
        item.Criticality = i.Criticality;
        item.Owner = (i.Owner ?? "").Trim();
        item.DefaultMaturityScore = i.DefaultMaturityScore;
        return (item, null);
    }

    static IResult? ValidateMaturity(int? score) =>
        score is null or >= 1 and <= 5 ? null : Results.ValidationProblem(new Dictionary<string, string[]> { ["maturityScore"] = ["Maturity must be between 1 and 5."] });

    static async Task<bool> WouldCycle(AppDbContext db, Guid id, Guid parentId)
    {
        Guid? current = parentId;
        for (var n = 0; n < 8 && current is Guid p; n++)
        {
            if (p == id) return true;
            current = (await db.BusinessCapabilities.FindAsync(p))?.ParentId;
        }
        return false;
    }

    static async Task<bool> LiveKeyExists(AppDbContext db, string key, Guid? exceptId) =>
        await db.BusinessCapabilities.AnyAsync(x => x.CatalogKey == key && !x.Archived && (exceptId == null || x.Id != exceptId));

    static async Task<BusinessCapability?> FindCapability(AppDbContext db, string id)
    {
        if (Guid.TryParse(id, out var guid)) return await db.BusinessCapabilities.FirstOrDefaultAsync(x => x.Id == guid);
        var key = id.Trim().ToLowerInvariant();
        return await db.BusinessCapabilities.FirstOrDefaultAsync(x => x.CatalogKey == key);
    }

    static async Task<Guid?> ResolveMasterId(AppDbContext db, Guid id)
    {
        if (await db.MasterSystems.AnyAsync(x => x.Id == id)) return id;
        var assessed = await db.Systems.FindAsync(id);
        return assessed?.MasterSystemId;
    }

    static object ToListDto(BusinessCapability x, Dictionary<Guid, string> parents, Dictionary<Guid, int> counts) => new
    {
        x.Id,
        x.CatalogKey,
        x.Name,
        x.Description,
        x.ParentId,
        parentName = x.ParentId is Guid pid && parents.TryGetValue(pid, out var n) ? n : null,
        level = x.Level.ToString(),
        x.Domain,
        x.Category,
        criticality = x.Criticality.ToString(),
        x.Owner,
        x.DefaultMaturityScore,
        x.Archived,
        systemCount = counts.GetValueOrDefault(x.Id),
    };

    static async Task RecalculateMaster(AppDbContext db, Guid masterSystemId)
    {
        foreach (var id in await db.Systems.Where(s => s.MasterSystemId == masterSystemId && !s.Archived).Select(s => s.Id).ToListAsync())
            await ScanWorkspace.Recalculate(db, id);
    }

    static async Task<IResult> ListAssets(string? q, InformationAssetClassification? classification, bool? includeArchived, AppDbContext db)
    {
        var query = db.InformationAssets.AsQueryable();
        if (includeArchived != true) query = query.Where(x => !x.Archived);
        if (classification is { } c) query = query.Where(x => x.Classification == c);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(x => x.Name.Contains(term) || x.CatalogKey.Contains(term) || x.Description.Contains(term) || x.BusinessDefinition.Contains(term) || x.DataOwner.Contains(term));
        }
        var rows = await query.OrderBy(x => x.Name).ToListAsync();
        var counts = await db.SystemInformationAssets.Where(x => !x.Archived).GroupBy(x => x.InformationAssetId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var sor = await (
            from link in db.SystemInformationAssets
            join master in db.MasterSystems on link.MasterSystemId equals master.Id
            where link.Role == InformationAssetRole.SystemOfRecord && !link.Archived && !master.Archived
            select new { link.InformationAssetId, master.Name }).ToDictionaryAsync(x => x.InformationAssetId, x => x.Name);
        return Results.Ok(rows.Select(x => new
        {
            x.Id,
            x.CatalogKey,
            x.Name,
            x.Description,
            x.BusinessDefinition,
            x.DataOwner,
            x.Steward,
            classification = x.Classification.ToString(),
            x.RetentionPeriod,
            x.RegulatoryRequirements,
            validation = x.Validation.ToString(),
            x.Archived,
            systemCount = counts.GetValueOrDefault(x.Id),
            systemOfRecordName = sor.GetValueOrDefault(x.Id),
        }));
    }

    static async Task<IResult> CreateAsset(InformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var prepared = PrepareAsset(i, existing: null);
        if (prepared.Error is not null) return prepared.Error;
        var item = prepared.Item!;
        if (await LiveAssetKeyExists(db, item.CatalogKey, null)) return Conflict("An information asset with this catalog key already exists.");
        db.InformationAssets.Add(item);
        await audit.Record(db, u, "Create", "InformationAsset", item.Id, item.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("An information asset with this catalog key already exists."); }
        return Results.Created($"/api/information-assets/{item.Id}", item);
    }

    static async Task<IResult> GetAsset(string id, AppDbContext db)
    {
        var item = await FindAsset(db, id);
        if (item is null) return Results.NotFound();
        var covering = await (
            from link in db.SystemInformationAssets
            join master in db.MasterSystems on link.MasterSystemId equals master.Id
            where link.InformationAssetId == item.Id && !link.Archived && !master.Archived
            orderby master.Name
            select new
            {
                link.Id,
                masterSystemId = master.Id,
                master.CatalogKey,
                master.Name,
                role = link.Role.ToString(),
                state = link.State.ToString(),
                validation = link.Validation.ToString(),
            }).ToListAsync();
        var capabilities = await (
            from link in db.CapabilityInformationAssets
            join cap in db.BusinessCapabilities on link.CapabilityId equals cap.Id
            where link.InformationAssetId == item.Id && !link.Archived && !cap.Archived
            orderby cap.Name
            select new { link.Id, capabilityId = cap.Id, cap.CatalogKey, cap.Name, level = cap.Level.ToString() }).ToListAsync();
        var sor = covering.FirstOrDefault(x => x.role == nameof(InformationAssetRole.SystemOfRecord));
        return Results.Ok(new
        {
            item.Id,
            item.CatalogKey,
            item.Name,
            item.Description,
            item.BusinessDefinition,
            item.DataOwner,
            item.Steward,
            classification = item.Classification.ToString(),
            item.RetentionPeriod,
            item.RegulatoryRequirements,
            validation = item.Validation.ToString(),
            item.Archived,
            item.EvidenceId,
            systemOfRecordName = sor?.Name,
            coveringSystems = covering,
            capabilities,
        });
    }

    static async Task<IResult> UpdateAsset(string id, InformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindAsset(db, id);
        if (item is null) return Results.NotFound();
        var prepared = PrepareAsset(i, item);
        if (prepared.Error is not null) return prepared.Error;
        var next = prepared.Item!;
        if (await LiveAssetKeyExists(db, next.CatalogKey, item.Id)) return Conflict("An information asset with this catalog key already exists.");
        item.CatalogKey = next.CatalogKey;
        item.Name = next.Name;
        item.Description = next.Description;
        item.BusinessDefinition = next.BusinessDefinition;
        item.DataOwner = next.DataOwner;
        item.Steward = next.Steward;
        item.Classification = next.Classification;
        item.RetentionPeriod = next.RetentionPeriod;
        item.RegulatoryRequirements = next.RegulatoryRequirements;
        item.Validation = next.Validation;
        item.EvidenceId = next.EvidenceId;
        await audit.Record(db, u, "Update", "InformationAsset", item.Id, item.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("An information asset with this catalog key already exists."); }
        return Results.Ok(item);
    }

    static async Task<IResult> ArchiveAsset(string id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindAsset(db, id);
        if (item is null) return Results.NotFound();
        if (await db.SystemInformationAssets.AnyAsync(x => x.InformationAssetId == item.Id && !x.Archived))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["archive"] = ["Unlink covering systems before archiving this information asset."] });
        if (await db.CapabilityInformationAssets.AnyAsync(x => x.InformationAssetId == item.Id && !x.Archived))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["archive"] = ["Unlink capabilities before archiving this information asset."] });
        item.Archived = true;
        await audit.Record(db, u, "Archive", "InformationAsset", item.Id, item.Name);
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    static async Task<IResult> ListAssetCoverage(Guid masterSystemId, AppDbContext db)
    {
        if (await db.MasterSystems.FindAsync(masterSystemId) is null) return Results.NotFound();
        var rows = await (
            from link in db.SystemInformationAssets
            join asset in db.InformationAssets on link.InformationAssetId equals asset.Id
            where link.MasterSystemId == masterSystemId && !link.Archived && !asset.Archived
            orderby asset.Name
            select new
            {
                link.Id,
                informationAssetId = asset.Id,
                asset.CatalogKey,
                asset.Name,
                classification = asset.Classification.ToString(),
                role = link.Role.ToString(),
                state = link.State.ToString(),
                validation = link.Validation.ToString(),
                link.Notes,
                link.EvidenceId,
            }).ToListAsync();
        return Results.Ok(rows);
    }

    static async Task<IResult> CreateAssetCoverage(Guid masterSystemId, SystemInformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var master = await db.MasterSystems.FindAsync(masterSystemId);
        var asset = await db.InformationAssets.FirstOrDefaultAsync(x => x.Id == i.InformationAssetId && !x.Archived);
        if (master is null || asset is null) return Results.NotFound();
        var existing = await db.SystemInformationAssets.FirstOrDefaultAsync(x => x.MasterSystemId == masterSystemId && x.InformationAssetId == i.InformationAssetId && x.Role == i.Role);
        if (existing is { Archived: false }) return Conflict("This system already has that role on the information asset.");
        if (i.Role == InformationAssetRole.SystemOfRecord && await LiveSoRExists(db, i.InformationAssetId, existing?.Id))
            return Conflict("Another system is already the system of record for this asset.");
        if (existing is null)
        {
            existing = new SystemInformationAsset { MasterSystemId = masterSystemId, InformationAssetId = i.InformationAssetId };
            db.SystemInformationAssets.Add(existing);
        }
        ApplyAssetCoverage(existing, i);
        existing.Archived = false;
        await audit.Record(db, u, "Create", "SystemInformationAsset", existing.Id, asset.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("This coverage row already exists."); }
        await RecalculateMaster(db, masterSystemId);
        return Results.Created($"/api/system-information-assets/{existing.Id}", existing);
    }

    static async Task<IResult> UpdateAssetCoverage(Guid id, SystemInformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.SystemInformationAssets.FindAsync(id);
        if (item is null) return Results.NotFound();
        if (!await db.InformationAssets.AnyAsync(x => x.Id == i.InformationAssetId && !x.Archived)) return Results.NotFound();
        if (await db.SystemInformationAssets.AnyAsync(x => x.MasterSystemId == item.MasterSystemId && x.InformationAssetId == i.InformationAssetId && x.Role == i.Role && x.Id != item.Id && !x.Archived))
            return Conflict("This system already has that role on the information asset.");
        if (i.Role == InformationAssetRole.SystemOfRecord && await LiveSoRExists(db, i.InformationAssetId, item.Id))
            return Conflict("Another system is already the system of record for this asset.");
        item.InformationAssetId = i.InformationAssetId;
        ApplyAssetCoverage(item, i);
        await audit.Record(db, u, "Update", "SystemInformationAsset", item.Id, "SystemInformationAsset");
        await db.SaveChangesAsync();
        await RecalculateMaster(db, item.MasterSystemId);
        return Results.Ok(item);
    }

    static async Task<IResult> ArchiveAssetCoverage(Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.SystemInformationAssets.FindAsync(id);
        if (item is null) return Results.NotFound();
        item.Archived = true;
        await audit.Record(db, u, "Archive", "SystemInformationAsset", item.Id, "SystemInformationAsset");
        await db.SaveChangesAsync();
        await RecalculateMaster(db, item.MasterSystemId);
        return Results.Ok(item);
    }

    static void ApplyAssetCoverage(SystemInformationAsset item, SystemInformationAssetInput i)
    {
        item.Role = i.Role;
        item.State = i.State;
        item.Validation = i.Validation;
        item.Notes = i.Notes ?? "";
        item.EvidenceId = i.EvidenceId;
    }

    static async Task<IResult> ListCapabilityAssets(string id, AppDbContext db)
    {
        var cap = await FindCapability(db, id);
        if (cap is null) return Results.NotFound();
        var rows = await (
            from link in db.CapabilityInformationAssets
            join asset in db.InformationAssets on link.InformationAssetId equals asset.Id
            where link.CapabilityId == cap.Id && !link.Archived && !asset.Archived
            orderby asset.Name
            select new { link.Id, informationAssetId = asset.Id, asset.CatalogKey, asset.Name, classification = asset.Classification.ToString(), link.Notes }).ToListAsync();
        return Results.Ok(rows);
    }

    static async Task<IResult> LinkCapabilityAsset(string id, CapabilityInformationAssetInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var cap = await FindCapability(db, id);
        var asset = await db.InformationAssets.FirstOrDefaultAsync(x => x.Id == i.InformationAssetId && !x.Archived);
        if (cap is null || asset is null) return Results.NotFound();
        var existing = await db.CapabilityInformationAssets.FirstOrDefaultAsync(x => x.CapabilityId == cap.Id && x.InformationAssetId == i.InformationAssetId);
        if (existing is { Archived: false }) return Conflict("This capability is already linked to that information asset.");
        if (existing is null)
        {
            existing = new CapabilityInformationAsset { CapabilityId = cap.Id, InformationAssetId = i.InformationAssetId };
            db.CapabilityInformationAssets.Add(existing);
        }
        existing.Archived = false;
        existing.Notes = i.Notes ?? "";
        await audit.Record(db, u, "Create", "CapabilityInformationAsset", existing.Id, asset.Name, null);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("This capability is already linked to that information asset."); }
        return Results.Created($"/api/capability-information-assets/{existing.Id}", existing);
    }

    static async Task<IResult> ArchiveCapabilityAsset(Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.CapabilityInformationAssets.FindAsync(id);
        if (item is null) return Results.NotFound();
        item.Archived = true;
        await audit.Record(db, u, "Archive", "CapabilityInformationAsset", item.Id, "CapabilityInformationAsset");
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    static (InformationAsset? Item, IResult? Error) PrepareAsset(InformationAssetInput i, InformationAsset? existing)
    {
        if (string.IsNullOrWhiteSpace(i.Name))
            return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["An information asset name is required."] }));
        var key = string.IsNullOrWhiteSpace(i.CatalogKey) ? CatalogSlug(i.Name) : i.CatalogKey.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 64)
            return (null, Results.ValidationProblem(new Dictionary<string, string[]> { ["catalogKey"] = ["A catalog key of at most 64 characters is required."] }));
        var item = existing ?? new InformationAsset();
        item.Name = i.Name.Trim();
        item.CatalogKey = key;
        item.Description = (i.Description ?? "").Trim();
        item.BusinessDefinition = (i.BusinessDefinition ?? "").Trim();
        item.DataOwner = (i.DataOwner ?? "").Trim();
        item.Steward = (i.Steward ?? "").Trim();
        item.Classification = i.Classification;
        item.RetentionPeriod = (i.RetentionPeriod ?? "").Trim();
        item.RegulatoryRequirements = (i.RegulatoryRequirements ?? "").Trim();
        item.Validation = i.Validation;
        item.EvidenceId = i.EvidenceId;
        return (item, null);
    }

    static async Task<bool> LiveAssetKeyExists(AppDbContext db, string key, Guid? exceptId) =>
        await db.InformationAssets.AnyAsync(x => x.CatalogKey == key && !x.Archived && (exceptId == null || x.Id != exceptId));

    static async Task<bool> LiveSoRExists(AppDbContext db, Guid assetId, Guid? exceptId) =>
        await db.SystemInformationAssets.AnyAsync(x => x.InformationAssetId == assetId && x.Role == InformationAssetRole.SystemOfRecord && !x.Archived && (exceptId == null || x.Id != exceptId));

    static async Task<InformationAsset?> FindAsset(AppDbContext db, string id)
    {
        if (Guid.TryParse(id, out var guid)) return await db.InformationAssets.FirstOrDefaultAsync(x => x.Id == guid);
        var key = id.Trim().ToLowerInvariant();
        return await db.InformationAssets.FirstOrDefaultAsync(x => x.CatalogKey == key);
    }

    static async Task<IResult> ListIntegrationCatalog(string? q, bool? includeArchived, AppDbContext db)
    {
        var query = db.IntegrationCatalogs.AsQueryable();
        if (includeArchived != true) query = query.Where(x => !x.Archived);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(x => x.Name.Contains(term) || x.CatalogKey.Contains(term) || x.Purpose.Contains(term));
        }
        var rows = await query.OrderBy(x => x.Name).ToListAsync();
        return Results.Ok(rows.Select(x => new
        {
            x.Id, x.CatalogKey, x.Name, x.Purpose, x.SourceLabel, x.TargetLabel,
            integrationType = x.IntegrationType.ToString(), x.Protocol, x.DataFormat, x.Frequency, x.Criticality, x.SupportTeam, x.Archived,
        }));
    }

    static async Task<IResult> CreateIntegrationCatalog(IntegrationCatalogInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        if (string.IsNullOrWhiteSpace(i.Name))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["An integration catalog name is required."] });
        var key = string.IsNullOrWhiteSpace(i.CatalogKey) ? CatalogSlug(i.Name) : i.CatalogKey.Trim().ToLowerInvariant();
        if (await db.IntegrationCatalogs.AnyAsync(x => x.CatalogKey == key && !x.Archived))
            return Conflict("An integration catalog row with this catalog key already exists.");
        var item = ApplyCatalog(new IntegrationCatalog(), i, key);
        db.IntegrationCatalogs.Add(item);
        await audit.Record(db, u, "Create", "IntegrationCatalog", item.Id, item.Name);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Conflict("An integration catalog row with this catalog key already exists."); }
        return Results.Created($"/api/integration-catalog/{item.Id}", item);
    }

    static async Task<IResult> GetIntegrationCatalog(string id, AppDbContext db)
    {
        var item = await FindIntegrationCatalog(db, id);
        return item is null ? Results.NotFound() : Results.Ok(item);
    }

    static async Task<IResult> UpdateIntegrationCatalog(string id, IntegrationCatalogInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindIntegrationCatalog(db, id);
        if (item is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(i.Name))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["An integration catalog name is required."] });
        var key = string.IsNullOrWhiteSpace(i.CatalogKey) ? item.CatalogKey : i.CatalogKey.Trim().ToLowerInvariant();
        if (await db.IntegrationCatalogs.AnyAsync(x => x.CatalogKey == key && !x.Archived && x.Id != item.Id))
            return Conflict("An integration catalog row with this catalog key already exists.");
        ApplyCatalog(item, i, key);
        await audit.Record(db, u, "Update", "IntegrationCatalog", item.Id, item.Name);
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    static async Task<IResult> ArchiveIntegrationCatalog(string id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await FindIntegrationCatalog(db, id);
        if (item is null) return Results.NotFound();
        item.Archived = true;
        await audit.Record(db, u, "Archive", "IntegrationCatalog", item.Id, item.Name);
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    static IntegrationCatalog ApplyCatalog(IntegrationCatalog item, IntegrationCatalogInput i, string key)
    {
        item.CatalogKey = key;
        item.Name = i.Name.Trim();
        item.Purpose = (i.Purpose ?? "").Trim();
        item.SourceMasterSystemId = i.SourceMasterSystemId;
        item.TargetMasterSystemId = i.TargetMasterSystemId;
        item.SourceLabel = (i.SourceLabel ?? "").Trim();
        item.TargetLabel = (i.TargetLabel ?? "").Trim();
        item.IntegrationType = i.IntegrationType;
        item.Protocol = (i.Protocol ?? "").Trim();
        item.DataFormat = (i.DataFormat ?? "").Trim();
        item.Frequency = (i.Frequency ?? "").Trim();
        item.Criticality = string.IsNullOrWhiteSpace(i.Criticality) ? "Moderate" : i.Criticality.Trim();
        item.SupportTeam = (i.SupportTeam ?? "").Trim();
        return item;
    }

    static async Task<IntegrationCatalog?> FindIntegrationCatalog(AppDbContext db, string id)
    {
        if (Guid.TryParse(id, out var guid)) return await db.IntegrationCatalogs.FirstOrDefaultAsync(x => x.Id == guid);
        var key = id.Trim().ToLowerInvariant();
        return await db.IntegrationCatalogs.FirstOrDefaultAsync(x => x.CatalogKey == key);
    }

    static async Task<IResult> ListEvidenceLinks(Guid id, AppDbContext db)
    {
        if (!await db.Evidence.AnyAsync(x => x.Id == id)) return Results.NotFound();
        var links = await db.EvidenceLinks.Where(x => x.EvidenceId == id && !x.Archived).OrderBy(x => x.EntityType).ToListAsync();
        var named = new List<object>();
        foreach (var link in links)
        {
            var name = await ResolveTargetName(db, link.EntityType, link.EntityId);
            named.Add(new
            {
                link.Id,
                link.EvidenceId,
                entityType = link.EntityType.ToString(),
                link.EntityId,
                link.Excerpt,
                link.SourceLocation,
                targetName = name,
            });
        }
        return Results.Ok(named);
    }

    static async Task<IResult> CreateEvidenceLink(Guid id, EvidenceLinkInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var evidence = await db.Evidence.FindAsync(id);
        if (evidence is null) return Results.NotFound();
        if (await db.EvidenceLinks.AnyAsync(x => x.EvidenceId == evidence.Id && x.EntityType == i.EntityType && x.EntityId == i.EntityId && !x.Archived))
            return Conflict("This evidence is already linked to that record.");
        var result = await TryAddEvidenceLink(db, evidence, i, audit, u);
        if (result.Error is not null) return result.Error;
        await db.SaveChangesAsync();
        return Results.Created($"/api/evidence-links/{result.Link!.Id}", result.Link);
    }

    static async Task<IResult> ArchiveEvidenceLink(Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u)
    {
        var item = await db.EvidenceLinks.FindAsync(id);
        if (item is null) return Results.NotFound();
        item.Archived = true;
        await audit.Record(db, u, "Archive", "EvidenceLink", item.Id, item.EntityType.ToString(), item.ProjectId);
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    public static async Task<(EvidenceLink? Link, IResult? Error)> TryAddEvidenceLink(AppDbContext db, Evidence evidence, EvidenceLinkInput i, AuditService audit, ClaimsPrincipal u)
    {
        var resolved = await ResolveTarget(db, evidence, i.EntityType, i.EntityId);
        if (resolved.Error is not null) return (null, resolved.Error);
        var existing = await db.EvidenceLinks.FirstOrDefaultAsync(x => x.EvidenceId == evidence.Id && x.EntityType == i.EntityType && x.EntityId == i.EntityId);
        if (existing is { Archived: false }) return (existing, null);
        if (existing is null)
        {
            existing = new EvidenceLink { EvidenceId = evidence.Id, EntityType = i.EntityType, EntityId = i.EntityId, ProjectId = evidence.ProjectId };
            db.EvidenceLinks.Add(existing);
        }
        existing.Archived = false;
        existing.Excerpt = (i.Excerpt ?? "").Trim();
        existing.SourceLocation = (i.SourceLocation ?? "").Trim();
        existing.ProjectId = evidence.ProjectId;
        await audit.Record(db, u, "Create", "EvidenceLink", existing.Id, $"{i.EntityType}:{resolved.Name}", evidence.ProjectId);
        return (existing, null);
    }

    static async Task<(IResult? Error, string Name)> ResolveTarget(AppDbContext db, Evidence evidence, EvidenceEntityType type, Guid entityId)
    {
        switch (type)
        {
            case EvidenceEntityType.Capability:
            {
                var cap = await db.BusinessCapabilities.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                return cap is null ? (Results.NotFound(), "") : (null, cap.Name);
            }
            case EvidenceEntityType.InformationAsset:
            {
                var asset = await db.InformationAssets.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                return asset is null ? (Results.NotFound(), "") : (null, asset.Name);
            }
            case EvidenceEntityType.Integration:
            {
                var integration = await db.Integrations.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                if (integration is null) return (Results.NotFound(), "");
                if (integration.ProjectId != evidence.ProjectId)
                    return (Results.ValidationProblem(new Dictionary<string, string[]> { ["entityId"] = ["The integration is not in the same project as the evidence."] }), "");
                return (null, integration.Name);
            }
            case EvidenceEntityType.Finding:
            {
                var finding = await db.Findings.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                if (finding is null) return (Results.NotFound(), "");
                if (finding.ProjectId != evidence.ProjectId)
                    return (Results.ValidationProblem(new Dictionary<string, string[]> { ["entityId"] = ["The finding is not in the same project as the evidence."] }), "");
                return (null, finding.Title);
            }
            case EvidenceEntityType.Requirement:
            {
                var requirement = await db.Requirements.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                if (requirement is null) return (Results.NotFound(), "");
                if (requirement.ProjectId != evidence.ProjectId)
                    return (Results.ValidationProblem(new Dictionary<string, string[]> { ["entityId"] = ["The requirement is not in the same project as the evidence."] }), "");
                return (null, requirement.Title);
            }
            case EvidenceEntityType.System:
            {
                var system = await db.Systems.FirstOrDefaultAsync(x => x.Id == entityId && !x.Archived);
                if (system is null) return (Results.NotFound(), "");
                if (system.ProjectId != evidence.ProjectId)
                    return (Results.ValidationProblem(new Dictionary<string, string[]> { ["entityId"] = ["The system is not in the same project as the evidence."] }), "");
                return (null, system.Name);
            }
            default:
                return (Results.BadRequest(new { title = "Unsupported entity type", detail = "That evidence target is not supported yet." }), "");
        }
    }

    static async Task<string> ResolveTargetName(AppDbContext db, EvidenceEntityType type, Guid entityId) => type switch
    {
        EvidenceEntityType.Capability => (await db.BusinessCapabilities.FindAsync(entityId))?.Name ?? "",
        EvidenceEntityType.InformationAsset => (await db.InformationAssets.FindAsync(entityId))?.Name ?? "",
        EvidenceEntityType.Integration => (await db.Integrations.FindAsync(entityId))?.Name ?? "",
        EvidenceEntityType.Finding => (await db.Findings.FindAsync(entityId))?.Title ?? "",
        EvidenceEntityType.Requirement => (await db.Requirements.FindAsync(entityId))?.Title ?? "",
        EvidenceEntityType.System => (await db.Systems.FindAsync(entityId))?.Name ?? "",
        _ => "",
    };

    static IResult Conflict(string detail) => Results.Json(new { title = "Conflict", detail }, statusCode: StatusCodes.Status409Conflict);

    static bool IsUniqueViolation(DbUpdateException ex)
    {
        for (var inner = ex.InnerException; inner is not null; inner = inner.InnerException)
        {
            if (inner is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 2601 or 2627) return true;
            if (inner.Message.Contains("unique", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }
}
