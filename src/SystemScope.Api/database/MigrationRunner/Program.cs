using System.Data.Common;
using System.Diagnostics;
using System.Security.Cryptography;
using Azure.Core;
using Azure.Identity;
using Microsoft.Data.SqlClient;

var options = ParseArgs(args);
var connectionString = RequireOption(options, "connection-string");
var migrationsPath = RequireOption(options, "migrations-path");
var appliedBy = options.GetValueOrDefault("applied-by");
var accessToken = options.GetValueOrDefault("access-token");
var interactiveUserId = options.GetValueOrDefault("interactive-user-id");
var tenantId = options.GetValueOrDefault("tenant-id");
var planOnly = options.ContainsKey("plan");

if (!Directory.Exists(migrationsPath))
{
    throw new DirectoryNotFoundException($"Migrations path '{migrationsPath}' does not exist.");
}

var migrationFiles = GetMigrationFiles(migrationsPath);

Console.WriteLine($"Target database: {DescribeConnectionTarget(connectionString)}");
Console.WriteLine($"Migrations path: {migrationsPath}");
Console.WriteLine(planOnly ? "Mode: plan only; no changes will be applied." : "Mode: apply pending migrations.");

if (migrationFiles.Count == 0)
{
    Console.WriteLine($"No migration files found in '{migrationsPath}'.");
    return;
}

if (string.IsNullOrWhiteSpace(accessToken) && !string.IsNullOrWhiteSpace(interactiveUserId))
{
    accessToken = await GetInteractiveAccessTokenAsync(interactiveUserId, tenantId);
}

await using var connection = new SqlConnection(NormalizeConnectionString(connectionString, hasAccessToken: !string.IsNullOrWhiteSpace(accessToken)));
if (!string.IsNullOrWhiteSpace(accessToken))
{
    connection.AccessToken = accessToken;
}

try
{
    await connection.OpenAsync();
}
catch (SqlException ex) when (IsLoginFailure(ex))
{
    var authMode = !string.IsNullOrWhiteSpace(accessToken)
        ? !string.IsNullOrWhiteSpace(interactiveUserId)
            ? $"interactive browser sign-in for {interactiveUserId}"
            : "an Azure CLI access token"
        : "the connection string authentication settings";

    Console.Error.WriteLine($"Azure SQL login failed while connecting to {DescribeConnectionTarget(connectionString)} using {authMode}.");
    Console.Error.WriteLine("The token was acquired, but Azure SQL rejected the authenticated Entra principal.");
    Console.Error.WriteLine("Check that you signed in with the intended account and that the target database has a user or Entra group for that principal with the required migration permissions.");
    Console.Error.WriteLine("For interactive auth, set AZURE_SQL_USER_ID/-UserId to your real UPN. Do not leave sample values such as user@contoso.com or your.email@organisation.gov.au.");
    Console.Error.WriteLine($"SQL error {ex.Number}, state {ex.State}, client connection id {ex.ClientConnectionId}");
    Environment.ExitCode = 2;
    return;
}

if (planOnly)
{
    var appliedMigrations = await GetAppliedMigrationsAsync(connection);
    var plan = BuildMigrationPlan(migrationFiles, appliedMigrations);
    WritePlan(plan);
    if (plan.ChecksumMismatches.Count > 0)
    {
        throw new InvalidOperationException("One or more applied migrations have checksum mismatches. Do not edit applied migrations; add a new migration.");
    }

    return;
}

var lockAcquired = false;
var appliedCount = 0;

try
{
    await EnsureJournalTableAsync(connection);
    lockAcquired = await AcquireMigrationLockAsync(connection);

    var appliedMigrations = await GetAppliedMigrationsAsync(connection);
    var plan = BuildMigrationPlan(migrationFiles, appliedMigrations);

    if (plan.ChecksumMismatches.Count > 0)
    {
        WritePlan(plan);
        throw new InvalidOperationException("One or more applied migrations have checksum mismatches. Do not edit applied migrations; add a new migration.");
    }

    foreach (var migration in plan.Applied)
    {
        Console.WriteLine($"Skipping already applied migration {migration.MigrationId}.");
    }

    foreach (var migration in plan.Pending)
    {
        await ApplyMigrationAsync(connection, migration, appliedBy);
        appliedCount++;
    }

    Console.WriteLine($"Database migrations are up to date. Applied {appliedCount}, skipped {plan.Applied.Count}, pending 0.");
}
finally
{
    if (lockAcquired)
    {
        try
        {
            await ReleaseMigrationLockAsync(connection);
        }
        catch
        {
            // The session may already be closed or the lock may have been released by SQL Server.
        }
    }
}

static IReadOnlyList<MigrationFile> GetMigrationFiles(string migrationsPath)
{
    return Directory.GetFiles(migrationsPath, "*.sql")
        .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
        .Select(path => new MigrationFile(
            Path.GetFileNameWithoutExtension(path),
            Path.GetFileName(path),
            path,
            GetFileSha256(path)))
        .ToArray();
}

static MigrationPlan BuildMigrationPlan(IReadOnlyList<MigrationFile> migrationFiles, IReadOnlyList<AppliedMigration> appliedMigrations)
{
    var appliedById = appliedMigrations.ToDictionary(migration => migration.MigrationId, StringComparer.OrdinalIgnoreCase);
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
        {
            checksumMismatches.Add(new ChecksumMismatch(migration, appliedMigration));
            continue;
        }

        applied.Add(appliedMigration);
    }

    return new MigrationPlan(pending, applied, checksumMismatches);
}

static void WritePlan(MigrationPlan plan)
{
    Console.WriteLine("Migration plan:");
    Console.WriteLine($"  Pending: {plan.Pending.Count}");
    foreach (var migration in plan.Pending)
    {
        Console.WriteLine($"    + {migration.MigrationId}");
    }

    Console.WriteLine($"  Already applied: {plan.Applied.Count}");
    foreach (var migration in plan.Applied)
    {
        Console.WriteLine($"    = {migration.MigrationId}");
    }

    Console.WriteLine($"  Checksum mismatches: {plan.ChecksumMismatches.Count}");
    foreach (var mismatch in plan.ChecksumMismatches)
    {
        Console.WriteLine($"    ! {mismatch.Migration.MigrationId}");
        Console.WriteLine($"      applied: {mismatch.Applied.Checksum}");
        Console.WriteLine($"      file:    {mismatch.Migration.Checksum}");
    }
}

static async Task ApplyMigrationAsync(SqlConnection connection, MigrationFile migration, string? appliedBy)
{
    Console.WriteLine($"Applying migration {migration.MigrationId}...");
    var sql = await File.ReadAllTextAsync(migration.Path);
    var batches = SplitSqlBatches(sql);
    var stopwatch = Stopwatch.StartNew();

    await using var transaction = await connection.BeginTransactionAsync();
    try
    {
        foreach (var batch in batches)
        {
            await ExecuteNonQueryAsync(connection, (SqlTransaction)transaction, batch);
        }

        await RecordMigrationAsync(connection, (SqlTransaction)transaction, migration.MigrationId, migration.Name, migration.Checksum, appliedBy, stopwatch.ElapsedMilliseconds);
        await transaction.CommitAsync();
        stopwatch.Stop();
        Console.WriteLine($"Applied migration {migration.MigrationId} in {stopwatch.ElapsedMilliseconds} ms.");
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}

static async Task EnsureJournalTableAsync(SqlConnection connection)
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
""");
}

static async Task<bool> AcquireMigrationLockAsync(SqlConnection connection)
{
    var lockResult = await ExecuteScalarAsync(connection, null, """
DECLARE @result INT;
EXEC @result = sp_getapplock
    @Resource = 'SystemScope.DatabaseMigrations',
    @LockMode = 'Exclusive',
    @LockOwner = 'Session',
    @LockTimeout = 60000;
SELECT @result;
""");

    if (Convert.ToInt32(lockResult) < 0)
    {
        throw new InvalidOperationException($"Could not acquire database migration lock. sp_getapplock returned {lockResult}.");
    }

    return true;
}

static async Task ReleaseMigrationLockAsync(SqlConnection connection)
{
    await ExecuteNonQueryAsync(connection, null, """
EXEC sp_releaseapplock
    @Resource = 'SystemScope.DatabaseMigrations',
    @LockOwner = 'Session';
""");
}

static async Task<bool> JournalTableExistsAsync(SqlConnection connection)
{
    var result = await ExecuteScalarAsync(connection, null, """
SELECT CASE
    WHEN OBJECT_ID('dbo.App_Schema_Migrations', 'U') IS NULL THEN CAST(0 AS BIT)
    ELSE CAST(1 AS BIT)
END;
""");
    return Convert.ToBoolean(result);
}

static async Task<IReadOnlyList<AppliedMigration>> GetAppliedMigrationsAsync(SqlConnection connection)
{
    if (!await JournalTableExistsAsync(connection))
    {
        return [];
    }

    var migrations = new List<AppliedMigration>();
    await using var command = connection.CreateCommand();
    command.CommandText = """
SELECT [MigrationId], [Name], [Checksum], [AppliedAt], [AppliedBy], [ExecutionMilliseconds]
FROM dbo.App_Schema_Migrations
ORDER BY [MigrationId];
""";
    command.CommandTimeout = 0;

    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
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

static Dictionary<string, string?> ParseArgs(string[] args)
{
    var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i++)
    {
        if (!args[i].StartsWith("--", StringComparison.Ordinal))
        {
            continue;
        }

        var key = args[i][2..];
        if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
        {
            values[key] = null;
            continue;
        }

        values[key] = args[++i];
    }

    return values;
}

static string RequireOption(IReadOnlyDictionary<string, string?> options, string key)
{
    if (!options.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
    {
        throw new ArgumentException($"Missing required option --{key}.");
    }

    return value;
}

static async Task<string> GetInteractiveAccessTokenAsync(string interactiveUserId, string? tenantId)
{
    Console.WriteLine($"Getting Azure SQL access token with interactive browser sign-in for {interactiveUserId}...");

    var credentialOptions = new InteractiveBrowserCredentialOptions
    {
        LoginHint = interactiveUserId
    };

    if (!string.IsNullOrWhiteSpace(tenantId))
    {
        credentialOptions.TenantId = tenantId;
    }

    var credential = new InteractiveBrowserCredential(credentialOptions);
    var accessToken = await credential.GetTokenAsync(new TokenRequestContext(["https://database.windows.net/.default"]));
    return accessToken.Token;
}

static string NormalizeConnectionString(string connectionString, bool hasAccessToken)
{
    if (!hasAccessToken)
    {
        return connectionString;
    }

    var builder = new DbConnectionStringBuilder
    {
        ConnectionString = connectionString
    };
    builder.Remove("Authentication");
    builder.Remove("User ID");
    builder.Remove("UID");
    builder.Remove("Password");
    builder.Remove("PWD");
    return builder.ConnectionString;
}

static string DescribeConnectionTarget(string connectionString)
{
    try
    {
        var builder = new DbConnectionStringBuilder
        {
            ConnectionString = connectionString
        };
        var server = GetConnectionStringValue(builder, "Server", "Data Source", "Address", "Addr", "Network Address") ?? "(unknown server)";
        var database = GetConnectionStringValue(builder, "Database", "Initial Catalog") ?? "(unknown database)";
        return $"{server}/{database}";
    }
    catch
    {
        return "(could not parse connection target)";
    }
}

static string? GetConnectionStringValue(DbConnectionStringBuilder builder, params string[] keys)
{
    foreach (var requestedKey in keys)
    {
        foreach (var key in builder.Keys.Cast<string>())
        {
            if (string.Equals(key, requestedKey, StringComparison.OrdinalIgnoreCase))
            {
                return Convert.ToString(builder[key]);
            }
        }
    }

    return null;
}

static bool IsLoginFailure(SqlException exception)
{
    return exception.Errors.Cast<SqlError>().Any(error => error.Number is 18456 or 18470);
}

static async Task<object?> ExecuteScalarAsync(SqlConnection connection, SqlTransaction? transaction, string commandText)
{
    await using var command = connection.CreateCommand();
    command.CommandText = commandText;
    command.CommandTimeout = 0;
    command.Transaction = transaction;
    return await command.ExecuteScalarAsync();
}

static async Task ExecuteNonQueryAsync(SqlConnection connection, SqlTransaction? transaction, string commandText)
{
    await using var command = connection.CreateCommand();
    command.CommandText = commandText;
    command.CommandTimeout = 0;
    command.Transaction = transaction;
    await command.ExecuteNonQueryAsync();
}

static async Task RecordMigrationAsync(SqlConnection connection, SqlTransaction transaction, string migrationId, string name, string checksum, string? appliedBy, long executionMilliseconds)
{
    await using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandTimeout = 0;
    command.CommandText = """
INSERT INTO dbo.App_Schema_Migrations
(
    [MigrationId],
    [Name],
    [Checksum],
    [AppliedAt],
    [AppliedBy],
    [ExecutionMilliseconds]
)
VALUES
(
    @MigrationId,
    @Name,
    @Checksum,
    SYSUTCDATETIME(),
    @AppliedBy,
    @ExecutionMilliseconds
);
""";
    command.Parameters.Add("@MigrationId", System.Data.SqlDbType.NVarChar, 255).Value = migrationId;
    command.Parameters.Add("@Name", System.Data.SqlDbType.NVarChar, 255).Value = name;
    command.Parameters.Add("@Checksum", System.Data.SqlDbType.NVarChar, 64).Value = checksum;
    command.Parameters.Add("@AppliedBy", System.Data.SqlDbType.NVarChar, 255).Value =
        string.IsNullOrWhiteSpace(appliedBy) ? DBNull.Value : appliedBy;
    command.Parameters.Add("@ExecutionMilliseconds", System.Data.SqlDbType.BigInt).Value = executionMilliseconds;
    await command.ExecuteNonQueryAsync();
}

static IReadOnlyList<string> SplitSqlBatches(string sql)
{
    var batches = new List<string>();
    var current = new System.Text.StringBuilder();

    foreach (var line in sql.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
    {
        if (System.Text.RegularExpressions.Regex.IsMatch(line, @"^\s*GO\s*(?:--.*)?$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            AddCurrentBatch();
            continue;
        }

        current.AppendLine(line);
    }

    AddCurrentBatch();
    return batches;

    void AddCurrentBatch()
    {
        var batch = current.ToString().Trim();
        if (batch.Length > 0)
        {
            batches.Add(batch);
        }

        current.Clear();
    }
}

static string GetNullableString(SqlDataReader reader, string columnName)
{
    var ordinal = reader.GetOrdinal(columnName);
    return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
}

static string GetFileSha256(string path)
{
    using var stream = File.OpenRead(path);
    var hash = SHA256.HashData(stream);
    return Convert.ToHexString(hash).ToLowerInvariant();
}

internal sealed record MigrationFile(string MigrationId, string Name, string Path, string Checksum);

internal sealed record AppliedMigration(string MigrationId, string Name, string Checksum, DateTime AppliedAt, string AppliedBy, long ExecutionMilliseconds);

internal sealed record ChecksumMismatch(MigrationFile Migration, AppliedMigration Applied);

internal sealed record MigrationPlan(IReadOnlyList<MigrationFile> Pending, IReadOnlyList<AppliedMigration> Applied, IReadOnlyList<ChecksumMismatch> ChecksumMismatches);
