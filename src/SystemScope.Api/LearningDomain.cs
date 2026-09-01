using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace SystemScope.Api;

public class LearningCourse : Record
{
    public Guid SystemId { get; set; }
    public string CatalogKey { get; set; } = "";
    public string CourseKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string Status { get; set; } = "Draft";
    public int DisplayOrder { get; set; }
    public int EstimatedMinutes { get; set; }
    public int Version { get; set; } = 1;
    public string Tags { get; set; } = "";
    public List<LearningLesson> Lessons { get; set; } = [];
}

public class LearningLesson : Record
{
    public Guid CourseId { get; set; }
    public string LessonKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Summary { get; set; }
    public string ContentMarkdown { get; set; } = "";
    public string ObjectivesJson { get; set; } = "[]";
    public string KeyTakeawaysJson { get; set; } = "[]";
    public string VerificationChecksJson { get; set; } = "[]";
    public int? DurationMinutes { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Draft";
    public string? EvidenceStatus { get; set; }
    public int PublishedVersion { get; set; } = 1;
    public List<LessonSource> Sources { get; set; } = [];
    public List<LessonQuestion> Questions { get; set; } = [];

    [NotMapped]
    public string[] Objectives => JsonSerializer.Deserialize<string[]>(ObjectivesJson) ?? [];
    [NotMapped]
    public string[] KeyTakeaways => JsonSerializer.Deserialize<string[]>(KeyTakeawaysJson) ?? [];
    [NotMapped]
    public string[] VerificationChecks => JsonSerializer.Deserialize<string[]>(VerificationChecksJson) ?? [];
}

public class LearningDocument : Record
{
    public Guid SystemId { get; set; }
    public string DocumentKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Version { get; set; } = "";
    public string Classification { get; set; } = "";
    public bool IsAuthoritative { get; set; }
}

public class LessonSource : Record
{
    public Guid LessonId { get; set; }
    public Guid DocumentId { get; set; }
    public int? PageFrom { get; set; }
    public int? PageTo { get; set; }
    public string? SectionName { get; set; }
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
    public string? SourceNote { get; set; }
    public LearningDocument? Document { get; set; }
}

public class UserLessonProgress
{
    public string UserId { get; set; } = "";
    public Guid LessonId { get; set; }
    public int ProgressPercentage { get; set; }
    public string Status { get; set; } = "NotStarted";
    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? LastAccessedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public string? LastPosition { get; set; }
}

public class LearningBookmark : Record
{
    public string UserId { get; set; } = "";
    public Guid SystemId { get; set; }
    public Guid? LessonId { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Label { get; set; }
}

public class LearningNote : Record
{
    public string UserId { get; set; } = "";
    public Guid SystemId { get; set; }
    public Guid? LessonId { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string NoteText { get; set; } = "";
}

public class LearningGlossaryTerm : Record
{
    public Guid SystemId { get; set; }
    public string TermKey { get; set; } = "";
    public string Term { get; set; } = "";
    public string ShortDefinition { get; set; } = "";
    public string? DetailedDefinition { get; set; }
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
    public Guid? SourceDocumentId { get; set; }
    public int? SourcePage { get; set; }
}

public class LessonQuestion : Record
{
    public Guid LessonId { get; set; }
    public string QuestionKey { get; set; } = "";
    public string QuestionText { get; set; } = "";
    public string? Explanation { get; set; }
    public int DisplayOrder { get; set; }
    public List<LessonQuestionOption> Options { get; set; } = [];
}

public class LessonQuestionOption : Record
{
    public Guid QuestionId { get; set; }
    public string OptionKey { get; set; } = "";
    public string OptionText { get; set; } = "";
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

public class LearningDataTable : Record
{
    public Guid SystemId { get; set; }
    public string TableKey { get; set; } = "";
    public string Name { get; set; } = "";
    public string? PhysicalName { get; set; }
    public string? Description { get; set; }
    public string? Domain { get; set; }
    public string? Grain { get; set; }
    public string CandidateKeyJson { get; set; } = "[]";
    public string EvidenceStatus { get; set; } = "DOCUMENTED";

    [NotMapped]
    public string[] CandidateKey => JsonSerializer.Deserialize<string[]>(CandidateKeyJson) ?? [];
}

public class LearningRelationship : Record
{
    public Guid SystemId { get; set; }
    public string RelationshipKey { get; set; } = "";
    public Guid FromTableId { get; set; }
    public Guid ToTableId { get; set; }
    public string FieldsJson { get; set; } = "[]";
    public string Cardinality { get; set; } = "one-to-many";
    public string EvidenceStatus { get; set; } = "INFERRED";
}

public class LearningImport : Record
{
    public Guid SystemId { get; set; }
    public string PackageId { get; set; } = "";
    public string SchemaVersion { get; set; } = "";
    public string FileName { get; set; } = "";
    public string FileHash { get; set; } = "";
    public string? IdempotencyKey { get; set; }
    public string Status { get; set; } = "Validated";
    public string RequestedBy { get; set; } = "";
    public DateTimeOffset RequestedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public int CreatedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int UnchangedCount { get; set; }
    public int WarningCount { get; set; }
    public int ErrorCount { get; set; }
    public List<LearningImportItem> Items { get; set; } = [];
}

public class LearningImportItem : Record
{
    public Guid ImportId { get; set; }
    public string EntityType { get; set; } = "";
    public string? StableKey { get; set; }
    public string Operation { get; set; } = "";
    public string Status { get; set; } = "";
    public string? JsonPath { get; set; }
    public string? ErrorCode { get; set; }
    public string? Message { get; set; }
}
