namespace SystemScope.Api;

public class MasterSystem : Record
{
    public string Name { get; set; } = "";
    public string Acronym { get; set; } = "";
    public string CatalogKey { get; set; } = "";
    public string Description { get; set; } = "";
    public string BusinessPurpose { get; set; } = "";
    public string BusinessCapabilities { get; set; } = "";
    public string BusinessOwner { get; set; } = "";
    public string TechnicalOwner { get; set; } = "";
    public string SupportTeam { get; set; } = "";
    public string UserGroups { get; set; } = "";
    public int? UserCount { get; set; }
    public Criticality Criticality { get; set; } = Criticality.Moderate;
    public string AvailabilityExpectations { get; set; } = "";
    public string LifecycleStatus { get; set; } = "Active";
    public string Vendor { get; set; } = "";
    public string Product { get; set; } = "";
    public StateClassification StateClassification { get; set; } = StateClassification.Current;
    public string Tags { get; set; } = "";
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string DataClassification { get; set; } = "OFFICIAL";
    [System.Text.Json.Serialization.JsonIgnore]
    public List<AssessedSystem> ProjectSystems { get; set; } = [];
}

public class ScanAssessment : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public Guid MasterSystemId { get; set; }
    public AssessmentStatus Status { get; set; } = AssessmentStatus.InProgress;
    public bool IncludeInRfi { get; set; } = true;
    public bool IncludeInDocument { get; set; } = true;
    public string Assessor { get; set; } = "";
    public string Reviewer { get; set; } = "";
    public string AssessmentLead { get; set; } = "";
    public DateTimeOffset? LastValidatedAt { get; set; }
    public string? LastValidatedBy { get; set; }
    public int InformationCompleteness { get; set; }
    public int ValidationCompleteness { get; set; }
    public int DocumentReadiness { get; set; }
    public List<ScanDomainState> Domains { get; set; } = [];
}

public class ScanDomainState : Record
{
    public Guid ScanAssessmentId { get; set; }
    public ScanDomainKind Kind { get; set; }
    public DomainRequirement Requirement { get; set; } = DomainRequirement.Required;
    public string Summary { get; set; } = "";
    public int Completeness { get; set; }
    public int EvidenceCount { get; set; }
    public int GapCount { get; set; }
    public DateTimeOffset? LastUpdatedAt { get; set; }
    public DateTimeOffset? LastValidatedAt { get; set; }
}

public class ScanFact : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public ScanDomainKind Domain { get; set; }
    public string Attribute { get; set; } = "";
    public string Value { get; set; } = "";
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public ClaimType ClaimType { get; set; } = ClaimType.ExplicitStatement;
    public string Confidence { get; set; } = "Unconfirmed";
    public Guid? EvidenceId { get; set; }
    public string EvidenceExcerpt { get; set; } = "";
    public string SourceLocation { get; set; } = "";
    public VisibilityClass Visibility { get; set; } = VisibilityClass.General;
    public InformationState State { get; set; } = InformationState.Current;
    public string ChangeReason { get; set; } = "";
    public string? Speaker { get; set; }
}

public class ApplicationComponent : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Name { get; set; } = "";
    public string ComponentType { get; set; } = "Application";
    public string Technology { get; set; } = "";
    public string Version { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string EnvironmentName { get; set; } = "";
    public string Owner { get; set; } = "";
    public string LifecycleStatus { get; set; } = "Active";
    public string SupportStatus { get; set; } = "";
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public InformationState State { get; set; } = InformationState.Current;
}

public class SystemDatabase : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Product { get; set; } = "";
    public string Edition { get; set; } = "";
    public string Version { get; set; } = "";
    public string DatabaseName { get; set; } = "";
    public string InstanceName { get; set; } = "";
    public string HostingLocation { get; set; } = "";
    public string OperatingSystem { get; set; } = "";
    public string Schemas { get; set; } = "";
    public string SharedOrDedicated { get; set; } = "";
    public string ApproximateSize { get; set; } = "";
    public string AnnualGrowth { get; set; } = "";
    public int? MajorTableCount { get; set; }
    public string StoredProcedures { get; set; } = "";
    public string Triggers { get; set; } = "";
    public string DatabaseLinks { get; set; } = "";
    public string ScheduledJobs { get; set; } = "";
    public string HighAvailability { get; set; } = "";
    public string BackupArrangement { get; set; } = "";
    public string RecoveryObjectives { get; set; } = "";
    public string EncryptionAtRest { get; set; } = "";
    public string EncryptionInTransit { get; set; } = "";
    public string VendorSupportStatus { get; set; } = "";
    public string PerformanceIssues { get; set; } = "";
    public string TechnicalDebt { get; set; } = "";
    public string Owner { get; set; } = "";
    public string SupportTeam { get; set; } = "";
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public InformationState State { get; set; } = InformationState.Current;
}

public class InfrastructureAsset : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Name { get; set; } = "";
    public string AssetType { get; set; } = "Server";
    public string HostingModel { get; set; } = "OnPremises";
    public string Location { get; set; } = "";
    public string OperatingSystem { get; set; } = "";
    public string EnvironmentName { get; set; } = "Production";
    public string NetworkZone { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string Owner { get; set; } = "";
    public bool EndOfLife { get; set; }
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public InformationState State { get; set; } = InformationState.Current;
}

public class DataFlow : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Source { get; set; } = "";
    public string Destination { get; set; } = "";
    public string DataSet { get; set; } = "";
    public string BusinessPurpose { get; set; } = "";
    public string Direction { get; set; } = "Outbound";
    public string Transformation { get; set; } = "";
    public string StoragePoints { get; set; } = "";
    public string Frequency { get; set; } = "";
    public string SecurityClassification { get; set; } = "OFFICIAL";
    public string Owner { get; set; } = "";
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public InformationState State { get; set; } = InformationState.Current;
}

public class BatchProcess : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Name { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string Schedule { get; set; } = "";
    public string Timezone { get; set; } = "Australia/Brisbane";
    public string UpstreamDependency { get; set; } = "";
    public string DownstreamDependency { get; set; } = "";
    public string Input { get; set; } = "";
    public string Output { get; set; } = "";
    public string RuntimeTechnology { get; set; } = "";
    public string TypicalDuration { get; set; } = "";
    public string FailureBehaviour { get; set; } = "";
    public string RetryProcess { get; set; } = "";
    public string Monitoring { get; set; } = "";
    public string OperationalOwner { get; set; } = "";
    public string Criticality { get; set; } = "Moderate";
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public InformationState State { get; set; } = InformationState.Current;
}

public class DataDomainRecord : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Name { get; set; } = "";
    public string BusinessDescription { get; set; } = "";
    public string AuthoritativeSystem { get; set; } = "";
    public string PrincipalEntities { get; set; } = "";
    public string ApproximateVolume { get; set; } = "";
    public string HistoricalDepth { get; set; } = "";
    public string Classification { get; set; } = "OFFICIAL";
    public string RetentionRequirement { get; set; } = "";
    public string DataOwner { get; set; } = "";
    public string DownstreamConsumers { get; set; } = "";
    public string MigrationRequirement { get; set; } = "";
    public QualityRating Completeness { get; set; } = QualityRating.NotAssessed;
    public QualityRating Accuracy { get; set; } = QualityRating.NotAssessed;
    public QualityRating Consistency { get; set; } = QualityRating.NotAssessed;
    public QualityRating Validity { get; set; } = QualityRating.NotAssessed;
    public QualityRating Timeliness { get; set; } = QualityRating.NotAssessed;
    public QualityRating Uniqueness { get; set; } = QualityRating.NotAssessed;
    public QualityRating ReferentialIntegrity { get; set; } = QualityRating.NotAssessed;
    public string KnownDuplicates { get; set; } = "";
    public string MissingMandatoryValues { get; set; } = "";
    public string InvalidCodes { get; set; } = "";
    public string OrphanedRecords { get; set; } = "";
    public string ManualCorrectionProcess { get; set; } = "";
    public string ReconciliationProcess { get; set; } = "";
    public string QualityOwner { get; set; } = "";
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
}

public class SecurityControl : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Name { get; set; } = "";
    public string Area { get; set; } = "Access";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "Unknown";
    public VisibilityClass Visibility { get; set; } = VisibilityClass.Internal;
    public Guid? EvidenceId { get; set; }
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
}

public class InformationGap : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public ScanDomainKind Domain { get; set; }
    public string MissingInformation { get; set; } = "";
    public string ReasonRequired { get; set; } = "";
    public Priority Priority { get; set; } = Priority.Should;
    public string MarketScanImpact { get; set; } = "";
    public string AssignedOwner { get; set; } = "";
    public DateOnly? DueDate { get; set; }
    public GapStatus Status { get; set; } = GapStatus.Open;
    public string Resolution { get; set; } = "";
    public Guid? EvidenceId { get; set; }
}

public class ExtractedClaim : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public ScanDomainKind Domain { get; set; }
    public string Statement { get; set; } = "";
    public string? Speaker { get; set; }
    public string EvidenceExcerpt { get; set; } = "";
    public string SourceLocation { get; set; } = "";
    public string Confidence { get; set; } = "Medium";
    public ClaimType ClaimType { get; set; } = ClaimType.ExplicitStatement;
    public ValidationStatus Validation { get; set; } = ValidationStatus.Captured;
    public string AnalystDecision { get; set; } = "Pending";
    public string ReviewComment { get; set; } = "";
    public Guid? EvidenceId { get; set; }
    public string VisibilityLabel { get; set; } = "Market scan";
    public string ReviewerAssigned { get; set; } = "";
    public InformationState State { get; set; } = InformationState.Current;
}

public class ValidationRequest : Record
{
    public Guid ProjectId { get; set; }
    public Guid AssessedSystemId { get; set; }
    public string Reference { get; set; } = "";
    public string Title { get; set; } = "";
    public string RequestedBy { get; set; } = "";
    public string Reviewer { get; set; } = "";
    public DateOnly DueDate { get; set; }
    public string Status { get; set; } = "Open";
    public string Context { get; set; } = "";
    public List<ValidationItem> Items { get; set; } = [];
}

public class ValidationItem : Record
{
    public Guid ValidationRequestId { get; set; }
    public Guid? ClaimId { get; set; }
    public ScanDomainKind Domain { get; set; }
    public string Statement { get; set; } = "";
    public string Confidence { get; set; } = "Medium";
    public string Status { get; set; } = "Pending";
    public string Decision { get; set; } = "";
    public string Comment { get; set; } = "";
    public string EvidenceTitle { get; set; } = "";
    public string EvidenceExcerpt { get; set; } = "";
    public string SourceLocation { get; set; } = "";
}

public class GeneratedDocument : Record
{
    public Guid ProjectId { get; set; }
    public Guid? DesignTemplateId { get; set; }
    public DocumentDesignTemplate? DesignTemplate { get; set; }
    public string Title { get; set; } = "";
    public string TemplateName { get; set; } = "Market scan";
    public string TemplateVersion { get; set; } = "1.0";
    public string Audience { get; set; } = "Internal";
    public string StateScope { get; set; } = "Current";
    public string AssessmentVersion { get; set; } = "";
    public string SnapshotJson { get; set; } = "{}";
    public byte[] FileBytes { get; set; } = [];
    public string FileName { get; set; } = "market-scan.docx";
    public string Status { get; set; } = "Generated";
    public string GeneratedBy { get; set; } = "";
    public bool IncludeDiagrams { get; set; } = true;
    public bool IncludeFindings { get; set; } = true;
    public bool IncludeGaps { get; set; } = true;
    public bool IncludeSecurityAppendix { get; set; }
    public string Warnings { get; set; } = "";
    public Guid? AssessedSystemId { get; set; }
    public string CatalogKey { get; set; } = "";
    public string VersionLabel { get; set; } = "v0.1";
    public string Format { get; set; } = "Word";
    public string ApprovalState { get; set; } = "Not submitted";
    public string Approver { get; set; } = "";
    public int PageCount { get; set; }
    public int FileSizeBytes { get; set; }
    public int Readiness { get; set; }
    public string ActivityJson { get; set; } = "[]";
    public string ChecksumSha256 { get; set; } = "";
    public string RecordId { get; set; } = "";
    public string Classification { get; set; } = "OFFICIAL";
    public string VisibilityScope { get; set; } = "Water Monitoring Systems";
    public string PublicationNote { get; set; } = "";
    public DateOnly? ReviewDate { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public string PublishedVersion { get; set; } = "";
    public int RetentionYears { get; set; } = 7;
    public bool SearchIndexed { get; set; }
    public bool AllowDownload { get; set; } = true;
    public bool ShowOnProfile { get; set; } = true;
    public bool NotifyMembers { get; set; } = true;
    public bool AllowExternal { get; set; }
    public bool Locked { get; set; }
    public string ApprovalComment { get; set; } = "";
    public DateTimeOffset? ApprovedAt { get; set; }
    public int ViewCount { get; set; }
    public int DownloadCount { get; set; }
    public string Summary { get; set; } = "";
    public List<DocumentComment> Comments { get; set; } = [];
}

[System.ComponentModel.DataAnnotations.Schema.Table("DocumentDesignTemplates")]
public class DocumentDesignTemplate : Record
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "";
    public string FileName { get; set; } = "template.docx";
    public string ContentType { get; set; } = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    public byte[] FileBytes { get; set; } = [];
    public string UploadedBy { get; set; } = "";
    public bool IsDefault { get; set; }
}

public class DocumentComment : Record
{
    public Guid GeneratedDocumentId { get; set; }
    public int SectionNumber { get; set; }
    public string Section { get; set; } = "";
    public string Author { get; set; } = "";
    public string Domain { get; set; } = "";
    public string Text { get; set; } = "";
    public string Status { get; set; } = "Unresolved";
}

public enum StateClassification { Current, Future }
public enum ScanDomainKind { Architecture, Database, Infrastructure, Integrations, DataQuality, Security, Operations, Limitations }
public enum DomainRequirement { Required, Optional, Deferred }
public enum ValidationStatus { Captured, AiExtracted, AnalystReviewed, SmeReviewRequested, SmeValidated, TechnicalReviewed, SecurityReviewed, Approved, DocumentReady, Published }
public enum ClaimType { ExplicitStatement, Inference, Assumption, Unknown, Conflict }
public enum InformationState { Current, Future, Suspected, Retired }
public enum GapStatus { Open, Assigned, AwaitingResponse, Resolved, AcceptedLimitation, DeferredByScope, NotApplicable }
public enum QualityRating { Good, Acceptable, Poor, Unknown, NotAssessed, NotApplicable }
public enum VisibilityClass { General, Internal, Restricted, SecurityAppendixOnly, Excluded }
