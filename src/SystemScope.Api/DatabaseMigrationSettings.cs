namespace SystemScope.Api;

public class DatabaseMigrationSettings
{
    public bool RunOnStartup { get; set; }
    public string MigrationsPath { get; set; } = "database/migrations";
    public string AppliedBy { get; set; } = "SystemScope.AppStartup";
    public bool FailStartupOnError { get; set; } = true;
}
