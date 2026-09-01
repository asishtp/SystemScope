using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public class LearningPackage
{
    public string SchemaVersion { get; set; } = "";
    public string PackageType { get; set; } = "";
    public string PackageId { get; set; } = "";
    public DateTimeOffset? GeneratedAtUtc { get; set; }
    public string ImportMode { get; set; } = "upsert";
    public LearningPackageSystem System { get; set; } = new();
    public LearningPackageCourse Course { get; set; } = new();
    public List<LearningPackageEvidenceStatus> EvidenceStatuses { get; set; } = [];
    public List<LearningPackageDocument> Documents { get; set; } = [];
    public List<LearningPackageLesson> Lessons { get; set; } = [];
    public List<LearningPackageGlossaryTerm> Glossary { get; set; } = [];
    public LearningPackageDataModel DataModel { get; set; } = new();
    public LearningPackageImportSettings ImportSettings { get; set; } = new();
}

public class LearningPackageSystem
{
    public string SystemKey { get; set; } = "";
    public string Name { get; set; } = "";
    public string LearningFeatureName { get; set; } = "";
}

public class LearningPackageCourse
{
    public string CourseKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "Draft";
    public int DisplayOrder { get; set; }
    public int EstimatedMinutes { get; set; }
    public int Version { get; set; } = 1;
    public List<string> Tags { get; set; } = [];
}

public class LearningPackageEvidenceStatus
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Colour { get; set; } = "";
}

public class LearningPackageDocument
{
    public string DocumentKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Version { get; set; } = "";
    public string Classification { get; set; } = "";
    public bool IsAuthoritative { get; set; }
}

public class LearningPackageLesson
{
    public string LessonKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public int DurationMinutes { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Draft";
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
    public List<string> Objectives { get; set; } = [];
    public List<string> KeyTakeaways { get; set; } = [];
    public List<string> VerificationChecks { get; set; } = [];
    public string ContentMarkdown { get; set; } = "";
    public List<LearningPackageSource> Sources { get; set; } = [];
    public List<LearningPackageQuestion> Questions { get; set; } = [];
}

public class LearningPackageSource
{
    public string DocumentKey { get; set; } = "";
    public int? PageFrom { get; set; }
    public int? PageTo { get; set; }
    public string? SectionName { get; set; }
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
}

public class LearningPackageQuestion
{
    public string QuestionKey { get; set; } = "";
    public string QuestionText { get; set; } = "";
    public string? Explanation { get; set; }
    public int DisplayOrder { get; set; }
    public List<LearningPackageOption> Options { get; set; } = [];
}

public class LearningPackageOption
{
    public string OptionKey { get; set; } = "";
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

public class LearningPackageGlossaryTerm
{
    public string TermKey { get; set; } = "";
    public string Term { get; set; } = "";
    public string ShortDefinition { get; set; } = "";
    public string? DetailedDefinition { get; set; }
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
    public LearningPackageGlossarySource? Source { get; set; }
}

public class LearningPackageGlossarySource
{
    public string DocumentKey { get; set; } = "";
    public int? Page { get; set; }
}

public class LearningPackageDataModel
{
    public List<LearningPackageTable> Tables { get; set; } = [];
    public List<LearningPackageRelationship> Relationships { get; set; } = [];
}

public class LearningPackageTable
{
    public string TableKey { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Domain { get; set; }
    public string? Grain { get; set; }
    public List<string> CandidateKey { get; set; } = [];
    public string EvidenceStatus { get; set; } = "DOCUMENTED";
}

public class LearningPackageRelationship
{
    public string RelationshipKey { get; set; } = "";
    public string FromTableKey { get; set; } = "";
    public string ToTableKey { get; set; } = "";
    public List<LearningPackageRelationshipField> Fields { get; set; } = [];
    public string Cardinality { get; set; } = "one-to-many";
    public string EvidenceStatus { get; set; } = "INFERRED";
}

public class LearningPackageRelationshipField
{
    public string From { get; set; } = "";
    public string To { get; set; } = "";
}

public class LearningPackageImportSettings
{
    public bool ValidateOnly { get; set; }
    public bool PublishLessons { get; set; }
    public bool OverwriteUserProgress { get; set; }
    public bool OverwritePersonalNotes { get; set; }
    public bool AllowEvidenceDowngrade { get; set; }
    public string OnDuplicate { get; set; } = "update-by-stable-key";
    public string OnMissingReference { get; set; } = "reject-item";
    public string TransactionMode { get; set; } = "all-or-nothing";
}

public record LearningImportOptions(bool PublishLessons, string RequestedBy, string FileName, string? IdempotencyKey);

public class LearningImportPreview
{
    public Guid ValidationId { get; set; } = Guid.NewGuid();
    public bool IsValid { get; set; }
    public string PackageId { get; set; } = "";
    public LearningImportSummary Summary { get; set; } = new();
    public List<LearningImportPreviewItem> Items { get; set; } = [];
    public List<LearningImportError> Errors { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
}

public class LearningImportSummary
{
    public int Create { get; set; }
    public int Update { get; set; }
    public int Unchanged { get; set; }
    public int Warnings { get; set; }
    public int Errors { get; set; }
}

public class LearningImportPreviewItem
{
    public string EntityType { get; set; } = "";
    public string? StableKey { get; set; }
    public string Operation { get; set; } = "";
    public string Message { get; set; } = "";
}

public class LearningImportError
{
    public string Code { get; set; } = "";
    public string JsonPath { get; set; } = "";
    public string Message { get; set; } = "";
}

public static class LearningImportService
{
    public const string SupportedSchemaVersion = "1.0";
    public const string PackageType = "system-learning-course";
    public const int MaxPackageBytes = 10 * 1024 * 1024;
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public static readonly HashSet<string> EvidenceKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "DOCUMENTED", "INFERRED", "SCHEMA_VERIFIED",
    };

    public static LearningPackage Parse(string json)
    {
        var package = JsonSerializer.Deserialize<LearningPackage>(json, JsonOptions);
        if (package is null) throw new InvalidOperationException("The learning package is empty.");
        return package;
    }

    public static LearningImportPreview Validate(LearningPackage package, AssessedSystem system, ExistingLearningState existing, bool publishLessons)
    {
        var preview = new LearningImportPreview { PackageId = package.PackageId };
        var errors = preview.Errors;
        var evidenceKeys = package.EvidenceStatuses.Select(x => x.Key).Where(x => !string.IsNullOrWhiteSpace(x)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (evidenceKeys.Count == 0) evidenceKeys = EvidenceKeys;

        if (string.IsNullOrWhiteSpace(package.SchemaVersion) || package.SchemaVersion != SupportedSchemaVersion)
            errors.Add(new LearningImportError { Code = "UNSUPPORTED_SCHEMA", JsonPath = "$.schemaVersion", Message = $"Schema version '{package.SchemaVersion}' is not supported. Expected {SupportedSchemaVersion}." });
        if (!string.Equals(package.PackageType, PackageType, StringComparison.OrdinalIgnoreCase))
            errors.Add(new LearningImportError { Code = "INVALID_PACKAGE_TYPE", JsonPath = "$.packageType", Message = $"Package type must be '{PackageType}'." });
        if (string.IsNullOrWhiteSpace(package.PackageId))
            errors.Add(new LearningImportError { Code = "MISSING_PACKAGE_ID", JsonPath = "$.packageId", Message = "Package ID is required." });
        if (string.IsNullOrWhiteSpace(package.System.SystemKey))
            errors.Add(new LearningImportError { Code = "MISSING_SYSTEM_KEY", JsonPath = "$.system.systemKey", Message = "System key is required." });
        else if (!MatchesSystem(system, package.System.SystemKey))
            errors.Add(new LearningImportError { Code = "SYSTEM_MISMATCH", JsonPath = "$.system.systemKey", Message = $"Package system key '{package.System.SystemKey}' does not match '{system.CatalogKey}'." });
        if (string.IsNullOrWhiteSpace(package.Course.CourseKey))
            errors.Add(new LearningImportError { Code = "MISSING_COURSE_KEY", JsonPath = "$.course.courseKey", Message = "Course key is required." });

        var documentKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < package.Documents.Count; i++)
        {
            var doc = package.Documents[i];
            if (string.IsNullOrWhiteSpace(doc.DocumentKey) || !documentKeys.Add(doc.DocumentKey))
                errors.Add(new LearningImportError { Code = "DUPLICATE_DOCUMENT_KEY", JsonPath = $"$.documents[{i}].documentKey", Message = $"Document key '{doc.DocumentKey}' is missing or duplicated." });
            else
                AddChange(preview, "Document", doc.DocumentKey, existing.Documents.ContainsKey(doc.DocumentKey) ? "Update" : "Create", "Source document will be imported.");
        }

        var lessonKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var displayOrders = new HashSet<int>();
        for (var i = 0; i < package.Lessons.Count; i++)
        {
            var lesson = package.Lessons[i];
            var path = $"$.lessons[{i}]";
            if (string.IsNullOrWhiteSpace(lesson.LessonKey) || !lessonKeys.Add(lesson.LessonKey))
                errors.Add(new LearningImportError { Code = "DUPLICATE_LESSON_KEY", JsonPath = $"{path}.lessonKey", Message = $"Lesson key '{lesson.LessonKey}' is missing or duplicated." });
            if (!displayOrders.Add(lesson.DisplayOrder))
                errors.Add(new LearningImportError { Code = "DUPLICATE_DISPLAY_ORDER", JsonPath = $"{path}.displayOrder", Message = $"Display order {lesson.DisplayOrder} is duplicated." });
            if (string.IsNullOrWhiteSpace(lesson.Title) || string.IsNullOrWhiteSpace(lesson.Summary) || string.IsNullOrWhiteSpace(lesson.ContentMarkdown))
                errors.Add(new LearningImportError { Code = "LESSON_CONTENT_REQUIRED", JsonPath = path, Message = "Title, summary and Markdown content are required." });
            if (lesson.DurationMinutes < 0)
                errors.Add(new LearningImportError { Code = "INVALID_DURATION", JsonPath = $"{path}.durationMinutes", Message = "Duration must be zero or greater." });
            if (!evidenceKeys.Contains(lesson.EvidenceStatus))
                errors.Add(new LearningImportError { Code = "UNKNOWN_EVIDENCE_STATUS", JsonPath = $"{path}.evidenceStatus", Message = $"Evidence status '{lesson.EvidenceStatus}' is not defined." });
            if (ContainsUnsafeContent(lesson.ContentMarkdown))
                errors.Add(new LearningImportError { Code = "UNSAFE_MARKDOWN", JsonPath = $"{path}.contentMarkdown", Message = "Markdown contains disallowed script or external executable content." });
            for (var s = 0; s < lesson.Sources.Count; s++)
            {
                if (!documentKeys.Contains(lesson.Sources[s].DocumentKey) && !existing.Documents.ContainsKey(lesson.Sources[s].DocumentKey))
                    errors.Add(new LearningImportError { Code = "SOURCE_DOCUMENT_NOT_FOUND", JsonPath = $"{path}.sources[{s}].documentKey", Message = $"Document key {lesson.Sources[s].DocumentKey} was not found." });
            }
            var questionKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var q = 0; q < lesson.Questions.Count; q++)
            {
                var question = lesson.Questions[q];
                if (string.IsNullOrWhiteSpace(question.QuestionKey) || !questionKeys.Add(question.QuestionKey))
                    errors.Add(new LearningImportError { Code = "DUPLICATE_QUESTION_KEY", JsonPath = $"{path}.questions[{q}].questionKey", Message = $"Question key '{question.QuestionKey}' is missing or duplicated." });
                if (question.Options.Count < 2)
                    errors.Add(new LearningImportError { Code = "QUESTION_OPTIONS_REQUIRED", JsonPath = $"{path}.questions[{q}].options", Message = "Each question must contain at least two options." });
                if (question.Options.Count(o => o.IsCorrect) != 1)
                    errors.Add(new LearningImportError { Code = "SINGLE_CORRECT_OPTION", JsonPath = $"{path}.questions[{q}].options", Message = "Exactly one option should be correct." });
                if (question.Options.Select(o => o.DisplayOrder).Distinct().Count() != question.Options.Count)
                    errors.Add(new LearningImportError { Code = "DUPLICATE_OPTION_ORDER", JsonPath = $"{path}.questions[{q}].options", Message = "Option display order must be unique within a question." });
            }
            var status = publishLessons ? "Published" : "Draft";
            AddChange(preview, "Lesson", lesson.LessonKey, existing.Lessons.ContainsKey(lesson.LessonKey) ? "Update" : "Create",
                existing.Lessons.ContainsKey(lesson.LessonKey) ? "Existing lesson will be updated." : $"Lesson will be imported as {status.ToLowerInvariant()}.");
        }

        var glossaryKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < package.Glossary.Count; i++)
        {
            var term = package.Glossary[i];
            if (string.IsNullOrWhiteSpace(term.TermKey) || !glossaryKeys.Add(term.TermKey))
                errors.Add(new LearningImportError { Code = "DUPLICATE_TERM_KEY", JsonPath = $"$.glossary[{i}].termKey", Message = $"Glossary term key '{term.TermKey}' is missing or duplicated." });
            if (term.Source is not null && !documentKeys.Contains(term.Source.DocumentKey) && !existing.Documents.ContainsKey(term.Source.DocumentKey))
                errors.Add(new LearningImportError { Code = "SOURCE_DOCUMENT_NOT_FOUND", JsonPath = $"$.glossary[{i}].source.documentKey", Message = $"Document key {term.Source.DocumentKey} was not found." });
            AddChange(preview, "GlossaryTerm", term.TermKey, existing.Glossary.ContainsKey(term.TermKey) ? "Update" : "Create", "Glossary term will be imported.");
        }

        var tableKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < package.DataModel.Tables.Count; i++)
        {
            var table = package.DataModel.Tables[i];
            if (string.IsNullOrWhiteSpace(table.TableKey) || !tableKeys.Add(table.TableKey))
                errors.Add(new LearningImportError { Code = "DUPLICATE_TABLE_KEY", JsonPath = $"$.dataModel.tables[{i}].tableKey", Message = $"Table key '{table.TableKey}' is missing or duplicated." });
            AddChange(preview, "Table", table.TableKey, existing.Tables.ContainsKey(table.TableKey) ? "Update" : "Create", "Data-model table will be imported.");
        }

        var relationshipKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < package.DataModel.Relationships.Count; i++)
        {
            var rel = package.DataModel.Relationships[i];
            var path = $"$.dataModel.relationships[{i}]";
            if (string.IsNullOrWhiteSpace(rel.RelationshipKey) || !relationshipKeys.Add(rel.RelationshipKey))
                errors.Add(new LearningImportError { Code = "DUPLICATE_RELATIONSHIP_KEY", JsonPath = $"{path}.relationshipKey", Message = $"Relationship key '{rel.RelationshipKey}' is missing or duplicated." });
            if (!tableKeys.Contains(rel.FromTableKey) && !existing.Tables.ContainsKey(rel.FromTableKey))
                errors.Add(new LearningImportError { Code = "TABLE_NOT_FOUND", JsonPath = $"{path}.fromTableKey", Message = $"Relationship endpoint '{rel.FromTableKey}' was not found." });
            if (!tableKeys.Contains(rel.ToTableKey) && !existing.Tables.ContainsKey(rel.ToTableKey))
                errors.Add(new LearningImportError { Code = "TABLE_NOT_FOUND", JsonPath = $"{path}.toTableKey", Message = $"Relationship endpoint '{rel.ToTableKey}' was not found." });
            if (rel.Fields.Count == 0 || rel.Fields.Any(f => string.IsNullOrWhiteSpace(f.From) || string.IsNullOrWhiteSpace(f.To)))
                errors.Add(new LearningImportError { Code = "RELATIONSHIP_FIELDS_REQUIRED", JsonPath = $"{path}.fields", Message = "Relationship fields cannot be empty." });
            AddChange(preview, "Relationship", rel.RelationshipKey, existing.Relationships.ContainsKey(rel.RelationshipKey) ? "Update" : "Create", "Relationship will be imported.");
        }

        if (!string.IsNullOrWhiteSpace(package.Course.CourseKey))
            AddChange(preview, "Course", package.Course.CourseKey, existing.Course is null ? "Create" : "Update", existing.Course is null ? "Course will be created." : "Course will be updated.");

        preview.Summary.Errors = errors.Count;
        preview.Summary.Warnings = preview.Warnings.Count;
        preview.Summary.Create = preview.Items.Count(x => x.Operation == "Create");
        preview.Summary.Update = preview.Items.Count(x => x.Operation == "Update");
        preview.IsValid = errors.Count == 0;
        return preview;
    }

    public static async Task<ExistingLearningState> LoadExisting(AppDbContext db, Guid systemId, string? courseKey)
    {
        var course = string.IsNullOrWhiteSpace(courseKey)
            ? await db.LearningCourses.FirstOrDefaultAsync(x => x.SystemId == systemId && !x.Archived)
            : await db.LearningCourses.FirstOrDefaultAsync(x => x.CourseKey == courseKey && !x.Archived);
        var lessons = course is null
            ? []
            : await db.LearningLessons.Where(x => x.CourseId == course.Id && !x.Archived).ToListAsync();
        var documents = await db.LearningDocuments.Where(x => x.SystemId == systemId && !x.Archived).ToListAsync();
        var glossary = await db.LearningGlossaryTerms.Where(x => x.SystemId == systemId && !x.Archived).ToListAsync();
        var tables = await db.LearningDataTables.Where(x => x.SystemId == systemId && !x.Archived).ToListAsync();
        var relationships = await db.LearningRelationships.Where(x => x.SystemId == systemId && !x.Archived).ToListAsync();
        return new ExistingLearningState
        {
            Course = course,
            Lessons = lessons.ToDictionary(x => x.LessonKey, StringComparer.OrdinalIgnoreCase),
            Documents = documents.ToDictionary(x => x.DocumentKey, StringComparer.OrdinalIgnoreCase),
            Glossary = glossary.ToDictionary(x => x.TermKey, StringComparer.OrdinalIgnoreCase),
            Tables = tables.ToDictionary(x => x.TableKey, StringComparer.OrdinalIgnoreCase),
            Relationships = relationships.ToDictionary(x => x.RelationshipKey, StringComparer.OrdinalIgnoreCase),
        };
    }

    public static async Task<LearningImport> Apply(AppDbContext db, AssessedSystem system, LearningPackage package, LearningImportPreview preview, LearningImportOptions options, string json)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(options.IdempotencyKey))
        {
            var prior = await db.LearningImports.Include(x => x.Items).FirstOrDefaultAsync(x => x.IdempotencyKey == options.IdempotencyKey && x.FileHash == hash);
            if (prior is not null) return prior;
        }

        var existing = await LoadExisting(db, system.Id, package.Course.CourseKey);
        var import = new LearningImport
        {
            SystemId = system.Id,
            PackageId = package.PackageId,
            SchemaVersion = package.SchemaVersion,
            FileName = options.FileName,
            FileHash = hash,
            IdempotencyKey = options.IdempotencyKey,
            Status = "Imported",
            RequestedBy = options.RequestedBy,
            RequestedAtUtc = DateTimeOffset.UtcNow,
            CreatedCount = preview.Summary.Create,
            UpdatedCount = preview.Summary.Update,
            UnchangedCount = preview.Summary.Unchanged,
            WarningCount = preview.Summary.Warnings,
            ErrorCount = 0,
        };
        foreach (var item in preview.Items)
        {
            import.Items.Add(new LearningImportItem
            {
                EntityType = item.EntityType,
                StableKey = item.StableKey,
                Operation = item.Operation,
                Status = "Imported",
                Message = item.Message,
            });
        }

        var course = existing.Course ?? new LearningCourse { SystemId = system.Id, CatalogKey = system.CatalogKey, CourseKey = package.Course.CourseKey };
        course.Title = package.Course.Title.Trim();
        course.Description = package.Course.Description.Trim();
        course.Status = options.PublishLessons ? "Published" : "Draft";
        course.DisplayOrder = package.Course.DisplayOrder;
        course.EstimatedMinutes = package.Course.EstimatedMinutes;
        course.Version = package.Course.Version;
        course.Tags = string.Join(",", package.Course.Tags);
        course.CatalogKey = system.CatalogKey;
        if (existing.Course is null) db.LearningCourses.Add(course);

        var documents = new Dictionary<string, LearningDocument>(existing.Documents, StringComparer.OrdinalIgnoreCase);
        foreach (var src in package.Documents)
        {
            if (!documents.TryGetValue(src.DocumentKey, out var doc))
            {
                doc = new LearningDocument { SystemId = system.Id, DocumentKey = src.DocumentKey };
                db.LearningDocuments.Add(doc);
                documents[src.DocumentKey] = doc;
            }
            doc.Title = src.Title.Trim();
            doc.FileName = src.FileName.Trim();
            doc.Version = src.Version.Trim();
            doc.Classification = src.Classification.Trim();
            doc.IsAuthoritative = src.IsAuthoritative;
        }

        var lessons = new Dictionary<string, LearningLesson>(existing.Lessons, StringComparer.OrdinalIgnoreCase);
        foreach (var src in package.Lessons.OrderBy(x => x.DisplayOrder))
        {
            if (!lessons.TryGetValue(src.LessonKey, out var lesson))
            {
                lesson = new LearningLesson { CourseId = course.Id, LessonKey = src.LessonKey };
                db.LearningLessons.Add(lesson);
                lessons[src.LessonKey] = lesson;
            }
            lesson.CourseId = course.Id;
            lesson.Title = src.Title.Trim();
            lesson.Summary = src.Summary.Trim();
            lesson.ContentMarkdown = SanitizeMarkdown(src.ContentMarkdown);
            lesson.ObjectivesJson = JsonSerializer.Serialize(src.Objectives);
            lesson.KeyTakeawaysJson = JsonSerializer.Serialize(src.KeyTakeaways);
            lesson.VerificationChecksJson = JsonSerializer.Serialize(src.VerificationChecks);
            lesson.DurationMinutes = src.DurationMinutes;
            lesson.DisplayOrder = src.DisplayOrder;
            lesson.Status = options.PublishLessons ? "Published" : "Draft";
            lesson.EvidenceStatus = src.EvidenceStatus;
            lesson.PublishedVersion = options.PublishLessons ? Math.Max(1, lesson.PublishedVersion) : lesson.PublishedVersion;

            if (db.Entry(lesson).State != EntityState.Added)
            {
                var currentSources = await db.LessonSources.Where(x => x.LessonId == lesson.Id).ToListAsync();
                db.LessonSources.RemoveRange(currentSources);
                var currentQuestions = await db.LessonQuestions.Include(x => x.Options).Where(x => x.LessonId == lesson.Id).ToListAsync();
                foreach (var question in currentQuestions)
                    db.LessonQuestionOptions.RemoveRange(question.Options);
                db.LessonQuestions.RemoveRange(currentQuestions);
            }
            foreach (var source in src.Sources)
            {
                if (!documents.TryGetValue(source.DocumentKey, out var document)) continue;
                db.LessonSources.Add(new LessonSource
                {
                    LessonId = lesson.Id,
                    DocumentId = document.Id,
                    PageFrom = source.PageFrom,
                    PageTo = source.PageTo,
                    SectionName = source.SectionName,
                    EvidenceStatus = source.EvidenceStatus,
                });
            }
            foreach (var question in src.Questions.OrderBy(x => x.DisplayOrder))
            {
                var q = new LessonQuestion
                {
                    LessonId = lesson.Id,
                    QuestionKey = question.QuestionKey,
                    QuestionText = question.QuestionText.Trim(),
                    Explanation = question.Explanation?.Trim(),
                    DisplayOrder = question.DisplayOrder,
                };
                foreach (var option in question.Options.OrderBy(x => x.DisplayOrder))
                {
                    q.Options.Add(new LessonQuestionOption
                    {
                        OptionKey = option.OptionKey,
                        OptionText = option.Text.Trim(),
                        IsCorrect = option.IsCorrect,
                        DisplayOrder = option.DisplayOrder,
                    });
                }
                db.LessonQuestions.Add(q);
            }
        }

        foreach (var src in package.Glossary)
        {
            if (!existing.Glossary.TryGetValue(src.TermKey, out var term))
            {
                term = new LearningGlossaryTerm { SystemId = system.Id, TermKey = src.TermKey };
                db.LearningGlossaryTerms.Add(term);
                existing.Glossary[src.TermKey] = term;
            }
            term.Term = src.Term.Trim();
            term.ShortDefinition = src.ShortDefinition.Trim();
            term.DetailedDefinition = src.DetailedDefinition?.Trim();
            term.EvidenceStatus = src.EvidenceStatus;
            if (src.Source is not null && documents.TryGetValue(src.Source.DocumentKey, out var document))
            {
                term.SourceDocumentId = document.Id;
                term.SourcePage = src.Source.Page;
            }
        }

        var tables = new Dictionary<string, LearningDataTable>(existing.Tables, StringComparer.OrdinalIgnoreCase);
        foreach (var src in package.DataModel.Tables)
        {
            if (!tables.TryGetValue(src.TableKey, out var table))
            {
                table = new LearningDataTable { SystemId = system.Id, TableKey = src.TableKey };
                db.LearningDataTables.Add(table);
                tables[src.TableKey] = table;
            }
            table.Name = src.Name.Trim();
            table.Domain = src.Domain;
            table.Grain = src.Grain;
            table.CandidateKeyJson = JsonSerializer.Serialize(src.CandidateKey);
            table.EvidenceStatus = src.EvidenceStatus;
        }

        foreach (var src in package.DataModel.Relationships)
        {
            if (!tables.TryGetValue(src.FromTableKey, out var from) || !tables.TryGetValue(src.ToTableKey, out var to)) continue;
            if (!existing.Relationships.TryGetValue(src.RelationshipKey, out var rel))
            {
                rel = new LearningRelationship { SystemId = system.Id, RelationshipKey = src.RelationshipKey };
                db.LearningRelationships.Add(rel);
                existing.Relationships[src.RelationshipKey] = rel;
            }
            rel.FromTableId = from.Id;
            rel.ToTableId = to.Id;
            rel.FieldsJson = JsonSerializer.Serialize(src.Fields);
            rel.Cardinality = src.Cardinality;
            rel.EvidenceStatus = src.EvidenceStatus;
        }

        import.CompletedAtUtc = DateTimeOffset.UtcNow;
        db.LearningImports.Add(import);
        await db.SaveChangesAsync();
        return import;
    }

    public static string? FindSeedPackagePath()
    {
        var names = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "learning", "Learn_GWDB_Import_Package.json"),
            Path.Combine(AppContext.BaseDirectory, "Learn_GWDB_Import_Package.json"),
        };
        foreach (var name in names)
            if (File.Exists(name)) return name;

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            foreach (var relative in new[]
            {
                Path.Combine("docs", "feature", "gwdb", "2. Learn_GWDB_Import_Package.json"),
                Path.Combine("docs", "feature", "gwdb", "Learn_GWDB_Import_Package.json"),
                Path.Combine("docs", "feature", "gwdb", "1. Learn_GWDB_Import_Package.json"),
                Path.Combine("learning", "Learn_GWDB_Import_Package.json"),
            })
            {
                var candidate = Path.Combine(dir.FullName, relative);
                if (File.Exists(candidate)) return candidate;
            }
            dir = dir.Parent;
        }
        return null;
    }

    public static bool MatchesSystem(AssessedSystem system, string systemKey) =>
        system.CatalogKey.Equals(systemKey, StringComparison.OrdinalIgnoreCase)
        || system.Acronym.Equals(systemKey, StringComparison.OrdinalIgnoreCase);

    static void AddChange(LearningImportPreview preview, string entityType, string? key, string operation, string message) =>
        preview.Items.Add(new LearningImportPreviewItem { EntityType = entityType, StableKey = key, Operation = operation, Message = message });

    static bool ContainsUnsafeContent(string markdown)
    {
        if (string.IsNullOrEmpty(markdown)) return false;
        return Regex.IsMatch(markdown, @"<\s*script|javascript:|data:text/html|<\s*iframe", RegexOptions.IgnoreCase);
    }

    public static string SanitizeMarkdown(string markdown)
    {
        if (string.IsNullOrEmpty(markdown)) return "";
        var cleaned = Regex.Replace(markdown, @"<\s*script[\s\S]*?<\s*/\s*script\s*>", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"javascript:", "", RegexOptions.IgnoreCase);
        return cleaned.Trim();
    }
}

public class ExistingLearningState
{
    public LearningCourse? Course { get; set; }
    public Dictionary<string, LearningLesson> Lessons { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, LearningDocument> Documents { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, LearningGlossaryTerm> Glossary { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, LearningDataTable> Tables { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, LearningRelationship> Relationships { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public static class LearningSeed
{
    public static async Task Apply(AppDbContext db)
    {
        if (await db.LearningCourses.AnyAsync()) return;
        var system = await db.Systems.FirstOrDefaultAsync(x => x.CatalogKey == "gwdb" && !x.Archived);
        if (system is null) return;
        var path = LearningImportService.FindSeedPackagePath();
        if (path is null) return;
        var json = await File.ReadAllTextAsync(path);
        var package = LearningImportService.Parse(json);
        var existing = await LearningImportService.LoadExisting(db, system.Id, package.Course.CourseKey);
        var preview = LearningImportService.Validate(package, system, existing, publishLessons: true);
        if (!preview.IsValid)
            throw new InvalidOperationException("Learn GWDB seed package failed validation: " + string.Join("; ", preview.Errors.Select(e => e.Message)));
        await LearningImportService.Apply(db, system, package, preview, new LearningImportOptions(true, "seed", Path.GetFileName(path), "seed-learn-gwdb-v1"), json);
    }
}
