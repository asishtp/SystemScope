using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemScope.Api;

public enum CapabilityLevel { L1 = 1, L2 = 2, L3 = 3 }

public enum CapabilityCoverageRole { Provides = 0, Supports = 1, Consumes = 2 }

[Table("BusinessCapabilities")]
public class BusinessCapability : Record
{
    [MaxLength(64)]
    public string CatalogKey { get; set; } = "";
    [MaxLength(200)]
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid? ParentId { get; set; }
    public CapabilityLevel Level { get; set; } = CapabilityLevel.L1;
    [MaxLength(100)]
    public string Domain { get; set; } = "";
    [MaxLength(100)]
    public string Category { get; set; } = "";
    public Criticality Criticality { get; set; } = Criticality.Moderate;
    public string Owner { get; set; } = "";
    public int? DefaultMaturityScore { get; set; }
}

[Table("SystemCapabilities")]
public class SystemCapability : Record
{
    public Guid MasterSystemId { get; set; }
    public Guid CapabilityId { get; set; }
    public CapabilityCoverageRole Role { get; set; } = CapabilityCoverageRole.Provides;
    public int? MaturityScore { get; set; }
    public string Notes { get; set; } = "";
    public InformationState State { get; set; } = InformationState.Current;
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public Guid? EvidenceId { get; set; }
}

public record CapabilityInput(
    string Name,
    string? CatalogKey,
    string? Description,
    Guid? ParentId,
    CapabilityLevel? Level,
    string? Domain,
    string? Category,
    Criticality Criticality,
    string? Owner,
    int? DefaultMaturityScore);

public record SystemCapabilityInput(
    Guid CapabilityId,
    CapabilityCoverageRole Role,
    int? MaturityScore,
    InformationState State,
    ValidationStatus Validation,
    string? Notes,
    Guid? EvidenceId);

public enum InformationAssetClassification { Public = 0, Internal = 1, Sensitive = 2, Restricted = 3 }

public enum InformationAssetRole { SystemOfRecord = 0, Producer = 1, Consumer = 2, Custodian = 3 }

[Table("InformationAssets")]
public class InformationAsset : Record
{
    [MaxLength(64)]
    public string CatalogKey { get; set; } = "";
    [MaxLength(200)]
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string BusinessDefinition { get; set; } = "";
    public string DataOwner { get; set; } = "";
    public string Steward { get; set; } = "";
    public InformationAssetClassification Classification { get; set; } = InformationAssetClassification.Internal;
    public string RetentionPeriod { get; set; } = "";
    public string RegulatoryRequirements { get; set; } = "";
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public Guid? EvidenceId { get; set; }
}

[Table("SystemInformationAssets")]
public class SystemInformationAsset : Record
{
    public Guid MasterSystemId { get; set; }
    public Guid InformationAssetId { get; set; }
    public InformationAssetRole Role { get; set; } = InformationAssetRole.SystemOfRecord;
    public InformationState State { get; set; } = InformationState.Current;
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public string Notes { get; set; } = "";
    public Guid? EvidenceId { get; set; }
}

[Table("CapabilityInformationAssets")]
public class CapabilityInformationAsset : Record
{
    public Guid CapabilityId { get; set; }
    public Guid InformationAssetId { get; set; }
    public string Notes { get; set; } = "";
}

public record InformationAssetInput(
    string Name,
    string? CatalogKey,
    string? Description,
    string? BusinessDefinition,
    string? DataOwner,
    string? Steward,
    InformationAssetClassification Classification,
    string? RetentionPeriod,
    string? RegulatoryRequirements,
    ValidationStatus Validation,
    Guid? EvidenceId);

public record SystemInformationAssetInput(
    Guid InformationAssetId,
    InformationAssetRole Role,
    InformationState State,
    ValidationStatus Validation,
    string? Notes,
    Guid? EvidenceId);

public record CapabilityInformationAssetInput(Guid InformationAssetId, string? Notes);

public enum IntegrationType { Api = 0, Batch = 1, FileTransfer = 2, DatabaseLink = 3, EventDriven = 4, Manual = 5 }

[Table("IntegrationCatalogs")]
public class IntegrationCatalog : Record
{
    [MaxLength(64)]
    public string CatalogKey { get; set; } = "";
    [MaxLength(200)]
    public string Name { get; set; } = "";
    public string Purpose { get; set; } = "";
    public Guid? SourceMasterSystemId { get; set; }
    public Guid? TargetMasterSystemId { get; set; }
    public string SourceLabel { get; set; } = "";
    public string TargetLabel { get; set; } = "";
    public IntegrationType IntegrationType { get; set; } = IntegrationType.Api;
    [MaxLength(100)]
    public string Protocol { get; set; } = "";
    [MaxLength(100)]
    public string DataFormat { get; set; } = "";
    public string Frequency { get; set; } = "";
    public string Criticality { get; set; } = "Moderate";
    public string SupportTeam { get; set; } = "";
}

public record IntegrationCatalogInput(
    string Name,
    string? CatalogKey,
    string? Purpose,
    Guid? SourceMasterSystemId,
    Guid? TargetMasterSystemId,
    string? SourceLabel,
    string? TargetLabel,
    IntegrationType IntegrationType,
    string? Protocol,
    string? DataFormat,
    string? Frequency,
    string? Criticality,
    string? SupportTeam);

public static class IntegrationTypes
{
    public static (IntegrationType Type, string Protocol, string Format) FromMethod(string? method)
    {
        var m = (method ?? "").Trim();
        var lower = m.ToLowerInvariant();
        if (string.IsNullOrEmpty(lower) || lower == "api") return (IntegrationType.Api, "HTTPS", "");
        if (lower == "unknown") return (IntegrationType.Manual, "", "");
        if (lower == "application module") return (IntegrationType.Manual, "Oracle Forms module", "");
        if (lower == "application workflow") return (IntegrationType.Manual, "", "");
        if (lower.Contains("batch") || lower.Contains("job")) return (IntegrationType.Batch, "", "");
        if (lower.Contains("sftp")) return (IntegrationType.FileTransfer, "SFTP", "");
        if (lower.Contains("ftp")) return (IntegrationType.FileTransfer, "FTP", "");
        if (lower.Contains("file")) return (IntegrationType.FileTransfer, "", "");
        if (lower.Contains("dblink") || lower.Contains("database link")) return (IntegrationType.DatabaseLink, "Oracle DB link", "Relational");
        if (lower.Contains("event") || lower.Contains("queue") || lower.Contains("service bus")) return (IntegrationType.EventDriven, "", "");
        return (IntegrationType.Manual, m, "");
    }

    public static void ApplyMapped(Integration item, string? method, IntegrationType? type, string? protocol, string? format)
    {
        var mapped = FromMethod(method);
        item.IntegrationType = type ?? mapped.Type;
        item.Protocol = string.IsNullOrWhiteSpace(protocol) ? mapped.Protocol : protocol.Trim();
        item.DataFormat = string.IsNullOrWhiteSpace(format) ? mapped.Format : format.Trim();
    }

    public static void CopyFromCatalog(Integration item, IntegrationCatalog catalog)
    {
        item.CatalogId = catalog.Id;
        item.Name = catalog.Name;
        item.BusinessPurpose = catalog.Purpose;
        item.SourceSystem = catalog.SourceLabel;
        item.Target = catalog.TargetLabel;
        item.IntegrationType = catalog.IntegrationType;
        item.Protocol = catalog.Protocol;
        item.DataFormat = catalog.DataFormat;
        item.Frequency = catalog.Frequency;
        item.Criticality = catalog.Criticality;
        if (!string.IsNullOrWhiteSpace(catalog.SupportTeam)) item.Owner = catalog.SupportTeam;
    }
}

public enum EvidenceEntityType
{
    System = 0,
    Capability = 1,
    InformationAsset = 2,
    Integration = 3,
    Finding = 4,
    Requirement = 5,
}

[Table("EvidenceLinks")]
public class EvidenceLink : Record
{
    public Guid EvidenceId { get; set; }
    public EvidenceEntityType EntityType { get; set; }
    public Guid EntityId { get; set; }
    public string Excerpt { get; set; } = "";
    public string SourceLocation { get; set; } = "";
    public Guid ProjectId { get; set; }
}

public record EvidenceLinkInput(EvidenceEntityType EntityType, Guid EntityId, string? Excerpt, string? SourceLocation);
