using System.Data;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace SystemScope.Api;

public sealed class DatabaseMigrationHostedService : IHostedService
{
    public const string LockResource = "SystemScope.DatabaseMigrations";

    readonly DatabaseMigrationSettings _settings;
    readonly IAzureSqlConnectionFactory _connectionFactory;
    readonly IServiceScopeFactory _scopeFactory;
    readonly IConfiguration _configuration;
    readonly IWebHostEnvironment _environment;
    readonly ILogger<DatabaseMigrationHostedService> _logger;

    public DatabaseMigrationHostedService(
        IOptions<DatabaseMigrationSettings> settings,
        IAzureSqlConnectionFactory connectionFactory,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<DatabaseMigrationHostedService> logger)
    {
        _settings = settings.Value;
        _connectionFactory = connectionFactory;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var explicitSql = _configuration.GetConnectionString("SystemScope");
            var useSql = _connectionFactory.IsConfigured || !string.IsNullOrWhiteSpace(explicitSql);

            if (useSql)
            {
                if (_settings.RunOnStartup)
                    await RunMigrationsAsync(cancellationToken);
                else
                    _logger.LogInformation("Database startup migrations are disabled. Apply them with database/Run-Migrations.ps1.");
            }
            else
            {
                _logger.LogInformation("No Azure SQL configuration; creating the in-memory schema.");
                await db.Database.EnsureCreatedAsync(cancellationToken);
            }

            await SeedData.Apply(db);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database startup failed.");
            if (_settings.FailStartupOnError) throw;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task RunMigrationsAsync(CancellationToken cancellationToken = default)
    {
        var migrationsPath = ResolveMigrationsPath();
        if (!Directory.Exists(migrationsPath))
            throw new DirectoryNotFoundException($"Migrations path '{migrationsPath}' does not exist.");

        var migrationFiles = GetMigrationFiles(migrationsPath);
        if (migrationFiles.Count == 0)
        {
            _logger.LogInformation("No database migration files found at {MigrationsPath}.", migrationsPath);
            return;
        }

        _logger.LogInformation("Running database migrations from {MigrationsPath}.", migrationsPath);
        await using var connection = await OpenSqlConnectionAsync(cancellationToken);
        await EnsureJournalTableAsync(connection, cancellationToken);
        await AcquireMigrationLockAsync(connection, cancellationToken);
        try
        {
            var appliedMigrations = await GetAppliedMigrationsAsync(connection, cancellationToken);
            var plan = BuildMigrationPlan(migrationFiles, appliedMigrations);
            if (plan.ChecksumMismatches.Count > 0)
            {
                var mismatches = string.Join(", ", plan.ChecksumMismatches.Select(m =>
                    $"{m.Migration.MigrationId} applied={m.Applied.Checksum} file={m.Migration.Checksum}"));
                throw new InvalidOperationException(
                    $"One or more applied migrations have checksum mismatches. Do not edit applied migrations; add a new migration. {mismatches}");
            }

            if (plan.Pending.Count == 0)
            {
                _logger.LogInformation("Database migrations are up to date. Already applied: {AppliedCount}.", plan.Applied.Count);
                return;
            }

            _logger.LogInformation(
                "Applying {PendingCount} pending database migration(s). Already applied: {AppliedCount}.",
                plan.Pending.Count, plan.Applied.Count);

            foreach (var migration in plan.Pending)
                await ApplyMigrationAsync(connection, migration, cancellationToken);

            _logger.LogInformation("Database migrations complete. Applied {PendingCount} migration(s).", plan.Pending.Count);
        }
        finally
        {
            await ReleaseMigrationLockAsync(connection, cancellationToken);
        }
    }

    async Task<SqlConnection> OpenSqlConnectionAsync(CancellationToken cancellationToken)
    {
        var explicitSql = _configuration.GetConnectionString("SystemScope");
        if (!string.IsNullOrWhiteSpace(explicitSql))
        {
            var connection = new SqlConnection(explicitSql);
            await connection.OpenAsync(cancellationToken);
            return connection;
        }
        return await _connectionFactory.OpenConnectionAsync(cancellationToken);
    }

    string ResolveMigrationsPath()
    {
        if (Path.IsPathRooted(_settings.MigrationsPath))
            return _settings.MigrationsPath;

        var fromContentRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, _settings.MigrationsPath));
        if (Directory.Exists(fromContentRoot)) return fromContentRoot;

        var fromBase = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, _settings.MigrationsPath));
        if (Directory.Exists(fromBase)) return fromBase;

        return fromContentRoot;
    }

    static IReadOnlyList<MigrationFile> GetMigrationFiles(string migrationsPath) =>
        Directory.GetFiles(migrationsPath, "*.sql")
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
            .Select(path => new MigrationFile(
                Path.GetFileNameWithoutExtension(path)!,
                Path.GetFileName(path)!,
                path,
                GetFileSha256(path)))
            .ToArray();

    static MigrationPlan BuildMigrationPlan(
        IReadOnlyList<MigrationFile> migrationFiles,
        IReadOnlyList<AppliedMigration> appliedMigrations)
    {
        var appliedById = appliedMigrations.ToDictionary(x => x.MigrationId, StringComparer.OrdinalIgnoreCase);
        var pending = new List<MigrationFile>();
        var applied = new List<AppliedMigration>();
        var checksumMismatches = new List<ChecksumMismatch>();
        foreach (var migration in migrationFiles)
        {
            if (!appliedById.TryGetValue(migration.MigrationId, out var appliedMigration))
            {
                pending.Add(migration);
                continue;
            }
            if (!string.Equals(appliedMigration.Checksum, migration.Checksum, StringComparison.OrdinalIgnoreCase))
                checksumMismatches.Add(new ChecksumMismatch(migration, appliedMigration));
            else
                applied.Add(appliedMigration);
        }
        return new MigrationPlan(pending, applied, checksumMismatches);
    }

    async Task ApplyMigrationAsync(SqlConnection connection, MigrationFile migration, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Applying database migration {MigrationId}.", migration.MigrationId);
        var sql = await File.ReadAllTextAsync(migration.Path, cancellationToken);
        var batches = SplitSqlBatches(sql);
        var stopwatch = Stopwatch.StartNew();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var batch in batches)
                await ExecuteNonQueryAsync(connection, transaction, batch, cancellationToken);
            await RecordMigrationAsync(connection, transaction, migration.MigrationId, migration.Name, migration.Checksum, stopwatch.ElapsedMilliseconds, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            stopwatch.Stop();
            _logger.LogInformation("Applied database migration {MigrationId} in {ElapsedMilliseconds} ms.", migration.MigrationId, stopwatch.ElapsedMilliseconds);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    static async Task EnsureJournalTableAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, null, """
IF OBJECT_ID('dbo.App_Schema_Migrations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.App_Schema_Migrations
    (
        [MigrationId] NVARCHAR(255) NOT NULL CONSTRAINT PK_App_Schema_Migrations PRIMARY KEY,
        [Name] NVARCHAR(255) NOT NULL,
        [Checksum] NVARCHAR(64) NOT NULL,
        [AppliedAt] DATETIME2 NOT NULL CONSTRAINT DF_App_Schema_Migrations_AppliedAt DEFAULT SYSUTCDATETIME(),
        [AppliedBy] NVARCHAR(255) NULL,
        [ExecutionMilliseconds] BIGINT NOT NULL
    );
END;
""", cancellationToken);
    }

    static async Task AcquireMigrationLockAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var lockResult = await ExecuteScalarAsync(connection, null, $"""
DECLARE @result INT;
EXEC @result = sp_getapplock
    @Resource = '{LockResource}',
    @LockMode = 'Exclusive',
    @LockOwner = 'Session',
    @LockTimeout = 60000;
SELECT @result;
""", cancellationToken);
        if (Convert.ToInt32(lockResult) < 0)
            throw new InvalidOperationException($"Could not acquire database migration lock. sp_getapplock returned {lockResult}.");
    }

    static async Task ReleaseMigrationLockAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        await ExecuteNonQueryAsync(connection, null, $"""
EXEC sp_releaseapplock
    @Resource = '{LockResource}',
    @LockOwner = 'Session';
""", cancellationToken);
    }

    static async Task<IReadOnlyList<AppliedMigration>> GetAppliedMigrationsAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var migrations = new List<AppliedMigration>();
        await using var command = connection.CreateCommand();
        command.CommandText = """
SELECT [MigrationId], [Name], [Checksum], [AppliedAt], [AppliedBy], [ExecutionMilliseconds]
FROM dbo.App_Schema_Migrations
ORDER BY [MigrationId];
""";
        command.CommandTimeout = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            migrations.Add(new AppliedMigration(
                reader.GetString(reader.GetOrdinal("MigrationId")),
                reader.GetString(reader.GetOrdinal("Name")),
                reader.GetString(reader.GetOrdinal("Checksum")),
                reader.GetDateTime(reader.GetOrdinal("AppliedAt")),
                GetNullableString(reader, "AppliedBy"),
                reader.GetInt64(reader.GetOrdinal("ExecutionMilliseconds"))));
        }
        return migrations;
    }

    async Task RecordMigrationAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string migrationId,
        string name,
        string checksum,
        long executionMilliseconds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandTimeout = 0;
        command.CommandText = """
INSERT INTO dbo.App_Schema_Migrations
([MigrationId], [Name], [Checksum], [AppliedAt], [AppliedBy], [ExecutionMilliseconds])
VALUES (@MigrationId, @Name, @Checksum, SYSUTCDATETIME(), @AppliedBy, @ExecutionMilliseconds);
""";
        command.Parameters.Add("@MigrationId", SqlDbType.NVarChar, 255).Value = migrationId;
        command.Parameters.Add("@Name", SqlDbType.NVarChar, 255).Value = name;
        command.Parameters.Add("@Checksum", SqlDbType.NVarChar, 64).Value = checksum;
        command.Parameters.Add("@AppliedBy", SqlDbType.NVarChar, 255).Value =
            string.IsNullOrWhiteSpace(_settings.AppliedBy) ? DBNull.Value : _settings.AppliedBy;
        command.Parameters.Add("@ExecutionMilliseconds", SqlDbType.BigInt).Value = executionMilliseconds;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    static async Task<object?> ExecuteScalarAsync(SqlConnection connection, SqlTransaction? transaction, string commandText, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        command.CommandTimeout = 0;
        command.Transaction = transaction;
        return await command.ExecuteScalarAsync(cancellationToken);
    }

    static async Task ExecuteNonQueryAsync(SqlConnection connection, SqlTransaction? transaction, string commandText, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        command.CommandTimeout = 0;
        command.Transaction = transaction;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    static IReadOnlyList<string> SplitSqlBatches(string sql)
    {
        var batches = new List<string>();
        var current = new StringBuilder();
        foreach (var line in sql.Split(["\r\n", "\n"], StringSplitOptions.None))
        {
            if (Regex.IsMatch(line, @"^\s*GO\s*(?:--.*)?$", RegexOptions.IgnoreCase))
            {
                AddCurrent();
                continue;
            }
            current.AppendLine(line);
        }
        AddCurrent();
        return batches;

        void AddCurrent()
        {
            var batch = current.ToString().Trim();
            if (batch.Length > 0) batches.Add(batch);
            current.Clear();
        }
    }

    static string GetNullableString(SqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? "" : reader.GetString(ordinal);
    }

    static string GetFileSha256(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    public sealed record MigrationFile(string MigrationId, string Name, string Path, string Checksum);
    sealed record AppliedMigration(string MigrationId, string Name, string Checksum, DateTime AppliedAt, string AppliedBy, long ExecutionMilliseconds);
    sealed record ChecksumMismatch(MigrationFile Migration, AppliedMigration Applied);
    sealed record MigrationPlan(IReadOnlyList<MigrationFile> Pending, IReadOnlyList<AppliedMigration> Applied, IReadOnlyList<ChecksumMismatch> ChecksumMismatches);
}
