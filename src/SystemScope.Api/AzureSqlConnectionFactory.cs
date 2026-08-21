using System.Data.Common;
using Azure.Core;
using Azure.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;

namespace SystemScope.Api;

public interface IAzureSqlConnectionFactory
{
    bool IsConfigured { get; }
    bool UsesAccessToken { get; }
    string AuthenticationMode { get; }
    string Server { get; }
    string Database { get; }
    string BuildConnectionString();
    Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken = default);
    Task<SqlConnection> OpenConnectionAsync(CancellationToken cancellationToken = default);
}

public class AzureSqlConnectionFactory : IAzureSqlConnectionFactory
{
    static readonly TokenRequestContext TokenRequestContext = new(["https://database.windows.net/.default"]);
    static readonly TimeSpan InteractiveTokenRefreshBuffer = TimeSpan.FromMinutes(5);

    readonly AzureSqlSettings _settings;
    readonly EntraIdSettings _entraId;
    readonly DefaultAzureCredential _credential;
    readonly InteractiveBrowserCredential? _interactiveCredential;
    readonly SemaphoreSlim _interactiveTokenLock = new(1, 1);
    readonly ILogger<AzureSqlConnectionFactory> _logger;
    AccessToken? _interactiveAccessToken;

    public AzureSqlConnectionFactory(
        IOptions<AzureSqlSettings> settings,
        IOptions<EntraIdSettings> entraId,
        ILogger<AzureSqlConnectionFactory> logger)
    {
        _settings = settings.Value;
        _entraId = entraId.Value;
        _logger = logger;
        _credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions());
        _interactiveCredential = BuildInteractiveCredential();
    }

    public bool IsConfigured => _settings.IsConfigured;
    public string AuthenticationMode => string.IsNullOrWhiteSpace(_settings.AuthenticationMode) ? "EntraId" : _settings.AuthenticationMode.Trim();
    public string Server => _settings.Server;
    public string Database => _settings.Database;
    public bool UsesAccessToken
    {
        get
        {
            var mode = AuthenticationMode.ToLowerInvariant();
            return mode is "entraid" or "activedirectoryinteractive";
        }
    }

    public string BuildConnectionString()
    {
        var mode = AuthenticationMode.ToLowerInvariant();
        return mode switch
        {
            "sqlauth" => SqlAuthConnectionString(),
            "activedirectorypassword" => ActiveDirectoryPasswordConnectionString(),
            _ => _settings.ConnectionString,
        };
    }

    public async Task<SqlConnection> OpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        var mode = AuthenticationMode;
        _logger.LogInformation("Opening Azure SQL connection to {Server}/{Database} using {AuthenticationMode}", Server, Database, mode);
        var connection = new SqlConnection(BuildConnectionString());
        if (UsesAccessToken)
            connection.AccessToken = await GetAccessTokenAsync(cancellationToken) ?? throw new InvalidOperationException("Azure SQL access token was not issued.");
        await connection.OpenAsync(cancellationToken);
        _logger.LogInformation("Azure SQL connection opened with {AuthenticationMode}", mode);
        return connection;
    }

    public async Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken = default)
    {
        var mode = AuthenticationMode.ToLowerInvariant();
        if (mode == "activedirectoryinteractive")
        {
            if (_interactiveCredential is null)
                throw new InvalidOperationException("EntraId:TenantId must be configured when AzureSql:AuthenticationMode is ActiveDirectoryInteractive.");
            var token = await GetInteractiveAccessTokenAsync(cancellationToken);
            return token.Token;
        }
        if (mode == "entraid")
        {
            var token = await _credential.GetTokenAsync(TokenRequestContext, cancellationToken);
            return token.Token;
        }
        return null;
    }

    async Task<AccessToken> GetInteractiveAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (_interactiveAccessToken is { } cached && cached.ExpiresOn > DateTimeOffset.UtcNow.Add(InteractiveTokenRefreshBuffer))
            return cached;

        await _interactiveTokenLock.WaitAsync(cancellationToken);
        try
        {
            if (_interactiveAccessToken is { } refreshed && refreshed.ExpiresOn > DateTimeOffset.UtcNow.Add(InteractiveTokenRefreshBuffer))
                return refreshed;
            var accessToken = await _interactiveCredential!.GetTokenAsync(TokenRequestContext, cancellationToken);
            _interactiveAccessToken = accessToken;
            return accessToken;
        }
        finally
        {
            _interactiveTokenLock.Release();
        }
    }

    InteractiveBrowserCredential? BuildInteractiveCredential()
    {
        if (string.IsNullOrWhiteSpace(_entraId.TenantId)) return null;
        var options = new InteractiveBrowserCredentialOptions { TenantId = _entraId.TenantId };
        if (!string.IsNullOrWhiteSpace(_settings.Username)) options.LoginHint = _settings.Username;
        return new InteractiveBrowserCredential(options);
    }

    string SqlAuthConnectionString()
    {
        if (string.IsNullOrWhiteSpace(_settings.Username) || string.IsNullOrWhiteSpace(_settings.Password))
            throw new InvalidOperationException("AzureSql:Username and AzureSql:Password must be configured when AzureSql:AuthenticationMode is SqlAuth.");
        return _settings.SqlAuthConnectionString;
    }

    string ActiveDirectoryPasswordConnectionString()
    {
        if (string.IsNullOrWhiteSpace(_settings.Username) || string.IsNullOrWhiteSpace(_settings.Password))
            throw new InvalidOperationException("AzureSql:Username and AzureSql:Password must be configured when AzureSql:AuthenticationMode is ActiveDirectoryPassword.");
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = _settings.Server,
            InitialCatalog = _settings.Database,
            Encrypt = _settings.Encrypt,
            TrustServerCertificate = _settings.TrustServerCertificate,
            ConnectTimeout = _settings.ConnectionTimeout,
            Authentication = SqlAuthenticationMethod.ActiveDirectoryPassword,
            UserID = _settings.Username,
            Password = _settings.Password,
        };
        return builder.ConnectionString;
    }
}

public sealed class AzureSqlTokenInterceptor(IAzureSqlConnectionFactory factory) : DbConnectionInterceptor
{
    public override InterceptionResult ConnectionOpening(DbConnection connection, ConnectionEventData eventData, InterceptionResult result)
    {
        ApplyToken((SqlConnection)connection).GetAwaiter().GetResult();
        return base.ConnectionOpening(connection, eventData, result);
    }

    public override async ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection, ConnectionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
    {
        await ApplyToken((SqlConnection)connection, cancellationToken);
        return await base.ConnectionOpeningAsync(connection, eventData, result, cancellationToken);
    }

    async Task ApplyToken(SqlConnection connection, CancellationToken cancellationToken = default)
    {
        if (!factory.UsesAccessToken) return;
        var token = await factory.GetAccessTokenAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(token)) connection.AccessToken = token;
    }
}

public static class AzureSqlRegistration
{
    public static WebApplicationBuilder AddSystemScopeDataStore(this WebApplicationBuilder builder)
    {
        builder.Services.Configure<AzureSqlSettings>(builder.Configuration.GetSection("AzureSql"));
        builder.Services.Configure<EntraIdSettings>(builder.Configuration.GetSection("EntraId"));
        if (string.IsNullOrWhiteSpace(builder.Configuration["EntraId:TenantId"]) && !string.IsNullOrWhiteSpace(builder.Configuration["AzureAd:TenantId"]))
            builder.Services.PostConfigure<EntraIdSettings>(s => s.TenantId = builder.Configuration["AzureAd:TenantId"] ?? s.TenantId);

        builder.Services.Configure<DatabaseMigrationSettings>(builder.Configuration.GetSection("DatabaseMigrations"));
        builder.Services.AddSingleton<IAzureSqlConnectionFactory, AzureSqlConnectionFactory>();
        builder.Services.AddSingleton<AzureSqlTokenInterceptor>();
        builder.Services.AddHostedService<DatabaseMigrationHostedService>();

        var explicitConnection = builder.Configuration.GetConnectionString("SystemScope");
        builder.Services.AddDbContext<AppDbContext>((sp, options) =>
        {
            if (!string.IsNullOrWhiteSpace(explicitConnection))
            {
                options.UseSqlServer(explicitConnection);
                return;
            }

            var factory = sp.GetRequiredService<IAzureSqlConnectionFactory>();
            if (factory.IsConfigured)
            {
                options.UseSqlServer(factory.BuildConnectionString());
                if (factory.UsesAccessToken)
                    options.AddInterceptors(sp.GetRequiredService<AzureSqlTokenInterceptor>());
                return;
            }

            options.UseInMemoryDatabase("SystemScopeDevelopment");
        });
        return builder;
    }
}
