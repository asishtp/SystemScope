namespace SystemScope.Api;

public class AzureSqlSettings
{
    public string Server { get; set; } = "";
    public string Database { get; set; } = "";
    public string AuthenticationMode { get; set; } = "EntraId";
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool Encrypt { get; set; } = true;
    public bool TrustServerCertificate { get; set; }
    public int ConnectionTimeout { get; set; } = 30;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Server) && !string.IsNullOrWhiteSpace(Database);

    public string ConnectionString =>
        $"Server={Server};Database={Database};Encrypt={Encrypt};TrustServerCertificate={TrustServerCertificate};Connection Timeout={ConnectionTimeout};";

    public string SqlAuthConnectionString =>
        $"{ConnectionString}User ID={Username};Password={Password};";
}

public class EntraIdSettings
{
    public string TenantId { get; set; } = "";
    public string Authority { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string ApiClientId { get; set; } = "";
    public string Audience { get; set; } = "";
    public string Scope { get; set; } = "";
}
