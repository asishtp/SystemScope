using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class WorkflowApi
{
    public static void MapWorkflow(this RouteGroupBuilder api)
    {
        api.MapGet("/documents/by-key/{key}", async (string key, AppDbContext db) =>
        {
            var system = await db.Systems.FirstOrDefaultAsync(x => x.CatalogKey == key);
            if (system is null) return Results.NotFound();
            var docs = await db.GeneratedDocuments.Include(x => x.Comments).Where(x => x.AssessedSystemId == system.Id || x.CatalogKey == key || (x.ProjectId == system.ProjectId && x.AssessedSystemId == null))
                .OrderByDescending(x => x.CreatedAt).ToListAsync();
            var scan = await db.ScanAssessments.FirstOrDefaultAsync(x => x.AssessedSystemId == system.Id);
            var project = await db.Projects.FindAsync(system.ProjectId);
            var latest = docs.FirstOrDefault();
            return Results.Ok(new
            {
                system = new { system.Id, system.Name, system.Acronym, system.CatalogKey, system.ProjectId, projectName = project?.Name },
                latestVersion = latest?.VersionLabel ?? "v0.0",
                documentStatus = latest?.Status ?? "None",
                snapshotDate = latest?.CreatedAt ?? scan?.UpdatedAt,
                generatedCount = docs.Count,
                readiness = latest?.Readiness ?? scan?.DocumentReadiness ?? 0,
                documents = docs.Select(d => new
                {
                    d.Id,
                    d.Title,
                    d.VersionLabel,
                    d.Format,
                    d.Status,
                    d.GeneratedBy,
                    d.CreatedAt,
                    d.FileName,
                    d.Audience,
                    d.TemplateName,
                    d.TemplateVersion,
                    d.AssessmentVersion,
                    d.ApprovalState,
                    d.Approver,
                    d.PageCount,
                    d.FileSizeBytes,
                    d.Readiness,
                    d.Warnings,
                    d.ChecksumSha256,
                    d.RecordId,
                    d.Classification,
                    d.VisibilityScope,
                    d.PublicationNote,
                    d.ReviewDate,
                    d.PublishedAt,
                    d.PublishedVersion,
                    d.RetentionYears,
                    d.Locked,
                    d.ApprovalComment,
                    d.ApprovedAt,
                    comments = d.Comments.Select(c => new { c.Id, c.SectionNumber, c.Section, c.Author, c.Domain, c.Text, c.Status }),
                    activity = ParseActivity(d.ActivityJson),
                }),
            });
        });

        api.MapGet("/documents/{id:guid}/review", async (Guid id, AppDbContext db) =>
        {
            var doc = await db.GeneratedDocuments.Include(x => x.Comments).FirstOrDefaultAsync(x => x.Id == id);
            if (doc is null) return Results.NotFound();
            return Results.Ok(new
            {
                doc.Id,
                doc.Title,
                doc.VersionLabel,
                doc.Status,
                doc.ApprovalState,
                doc.GeneratedBy,
                doc.CreatedAt,
                doc.PageCount,
                doc.Readiness,
                doc.Approver,
                requestedBy = doc.GeneratedBy,
                submitted = doc.UpdatedAt,
                due = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
                comments = doc.Comments.OrderBy(c => c.SectionNumber).Select(c => new { c.Id, c.SectionNumber, c.Section, c.Author, c.Domain, c.Text, c.Status }),
            });
        });

        api.MapPost("/documents/{id:guid}/comments", async (Guid id, DocumentCommentInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            if (doc.Locked) return Results.ValidationProblem(new Dictionary<string, string[]> { ["document"] = ["The approved file is locked."] });
            var comment = new DocumentComment { GeneratedDocumentId = id, SectionNumber = i.SectionNumber, Section = i.Section, Author = u.Identity?.Name ?? "Reviewer", Domain = i.Domain ?? "", Text = i.Text.Trim(), Status = "Unresolved" };
            db.DocumentComments.Add(comment);
            await audit.Record(db, u, "Comment", "GeneratedDocument", id, i.Text, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Created($"/api/documents/{id}/comments/{comment.Id}", comment);
        });

        api.MapPost("/documents/{id:guid}/decision", async (Guid id, DocumentDecisionInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            doc.ApprovalState = i.Decision switch
            {
                "Approve" or "ApproveWithConditions" => "Approved",
                "RequestChanges" => "Changes requested",
                "Reject" => "Rejected",
                _ => doc.ApprovalState
            };
            if (doc.ApprovalState == "Approved")
            {
                doc.Status = "Approved";
                doc.Approver = string.IsNullOrWhiteSpace(doc.Approver) ? (u.Identity?.Name ?? "Michael") : doc.Approver;
                doc.ApprovedAt = DateTimeOffset.UtcNow;
                doc.Locked = true;
                AppendActivity(doc, $"{doc.Approver} approved {doc.VersionLabel}");
            }
            else
            {
                doc.Locked = false;
                AppendActivity(doc, $"{i.Decision}: {i.Comment}");
            }
            doc.ApprovalComment = i.Comment ?? "";
            await audit.Record(db, u, i.Decision, "GeneratedDocument", doc.Id, i.Comment, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.Status, doc.ApprovalState, doc.Locked, doc.VersionLabel });
        });

        api.MapPost("/documents/{id:guid}/publish", async (Guid id, PublishInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var source = await db.GeneratedDocuments.FindAsync(id);
            if (source is null) return Results.NotFound();
            if (source.ApprovalState != "Approved")
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["approval"] = ["Only an approved document can be published."] });
            ApplyPublication(source, i);
            source.Locked = true;
            var published = new GeneratedDocument
            {
                ProjectId = source.ProjectId,
                AssessedSystemId = source.AssessedSystemId,
                CatalogKey = source.CatalogKey,
                Title = string.IsNullOrWhiteSpace(i.Title) ? source.Title : i.Title.Trim(),
                TemplateName = source.TemplateName,
                TemplateVersion = source.TemplateVersion,
                Audience = source.Audience,
                StateScope = source.StateScope,
                AssessmentVersion = source.AssessmentVersion,
                VersionLabel = "v1.0",
                PublishedVersion = "v1.0",
                Format = i.IncludePdf ? "PDF" : source.Format,
                FileBytes = source.FileBytes,
                FileName = $"{source.CatalogKey}-v1.0.docx",
                Status = "Published",
                ApprovalState = "Published",
                GeneratedBy = u.Identity?.Name ?? source.GeneratedBy,
                PageCount = source.PageCount,
                FileSizeBytes = source.FileBytes.Length,
                Readiness = 100,
                ChecksumSha256 = Convert.ToHexString(SHA256.HashData(source.FileBytes)),
                RecordId = string.IsNullOrWhiteSpace(source.RecordId) ? $"DOC-{source.CatalogKey.ToUpperInvariant()}-0001" : source.RecordId,
                Classification = source.Classification,
                VisibilityScope = source.VisibilityScope,
                PublicationNote = source.PublicationNote,
                ReviewDate = source.ReviewDate,
                PublishedAt = DateTimeOffset.UtcNow,
                RetentionYears = 7,
                SearchIndexed = source.SearchIndexed,
                AllowDownload = source.AllowDownload,
                ShowOnProfile = source.ShowOnProfile,
                Locked = true,
                Approver = source.Approver,
                ApprovedAt = source.ApprovedAt,
                ActivityJson = JsonSerializer.Serialize(new[] { new { at = DateTimeOffset.UtcNow, text = "Published immutable version v1.0" } }),
            };
            source.Status = "Superseded";
            db.GeneratedDocuments.Add(published);
            await audit.Record(db, u, "Publish", "GeneratedDocument", published.Id, "Published v1.0", source.ProjectId);
            await db.SaveChangesAsync();
            return Results.Created($"/api/documents/{published.Id}", new { published.Id, published.VersionLabel, published.ChecksumSha256, published.RecordId, published.PublishedAt });
        });

        api.MapPost("/documents/{id:guid}/submit", async (Guid id, SubmitApprovalInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            if (doc.Locked) return Results.ValidationProblem(new Dictionary<string, string[]> { ["document"] = ["A locked document cannot be re-submitted."] });
            doc.ApprovalState = "Submitted";
            doc.Status = "Draft";
            doc.Approver = string.IsNullOrWhiteSpace(i.Approver) ? "Michael" : i.Approver.Trim();
            AppendActivity(doc, $"Submitted for approval to {doc.Approver}");
            await audit.Record(db, u, "Submit", "GeneratedDocument", doc.Id, i.Comment ?? "Submitted for approval", doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.ApprovalState, doc.Approver, doc.VersionLabel });
        });

        api.MapPost("/documents/{id:guid}/copy", async (Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var source = await db.GeneratedDocuments.FindAsync(id);
            if (source is null) return Results.NotFound();
            var siblings = await db.GeneratedDocuments.Where(x => x.AssessedSystemId == source.AssessedSystemId).ToListAsync();
            var next = siblings.Count + 1;
            var copy = CloneDocument(source, $"v0.{next}", "Draft", "Not submitted", u.Identity?.Name ?? source.GeneratedBy);
            copy.Locked = false;
            copy.ApprovalState = "Not submitted";
            copy.Status = "Draft";
            copy.ActivityJson = JsonSerializer.Serialize(new[] { new { at = DateTimeOffset.UtcNow, text = $"Copy of {source.VersionLabel} created as {copy.VersionLabel}" } });
            db.GeneratedDocuments.Add(copy);
            await audit.Record(db, u, "Copy", "GeneratedDocument", copy.Id, copy.VersionLabel, source.ProjectId);
            await db.SaveChangesAsync();
            return Results.Created($"/api/documents/{copy.Id}", new { copy.Id, copy.VersionLabel });
        });

        api.MapPost("/documents/{id:guid}/archive", async (Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            doc.Status = "Archived";
            AppendActivity(doc, $"{doc.VersionLabel} archived");
            await audit.Record(db, u, "Archive", "GeneratedDocument", doc.Id, doc.VersionLabel, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.Status });
        });

        api.MapPut("/documents/{id:guid}/publication", async (Guid id, PublishInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            ApplyPublication(doc, i);
            AppendActivity(doc, "Publication settings saved");
            await audit.Record(db, u, "PublicationSettings", "GeneratedDocument", doc.Id, i.Title ?? doc.Title, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.Classification, doc.VisibilityScope, doc.ReviewDate, doc.PublicationNote });
        });

        api.MapPost("/documents/{id:guid}/comments/{commentId:guid}/resolve", async (Guid id, Guid commentId, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var comment = await db.DocumentComments.FirstOrDefaultAsync(x => x.Id == commentId && x.GeneratedDocumentId == id);
            if (comment is null) return Results.NotFound();
            comment.Status = "Resolved";
            await audit.Record(db, u, "ResolveComment", "DocumentComment", comment.Id, comment.Text, null);
            await db.SaveChangesAsync();
            return Results.Ok(comment);
        });

        api.MapGet("/documents/compare/{key}", async (string key, string? left, string? right, AppDbContext db) =>
        {
            var docs = await db.GeneratedDocuments.Where(x => x.CatalogKey == key).OrderByDescending(x => x.CreatedAt).ToListAsync();
            var a = docs.FirstOrDefault(d => d.VersionLabel == left) ?? docs.ElementAtOrDefault(0);
            var b = docs.FirstOrDefault(d => d.VersionLabel == right) ?? docs.ElementAtOrDefault(1);
            if (a is null || b is null) return Results.Ok(new { findingsAdded = 0, findingsValidated = 0, sectionUpdated = 0, securityChanges = 0, left, right });
            var leftActivity = ParseActivity(a.ActivityJson);
            return Results.Ok(new
            {
                left = a.VersionLabel,
                right = b.VersionLabel,
                findingsAdded = Math.Max(0, a.PageCount - b.PageCount) + 4,
                findingsValidated = a.Readiness > b.Readiness ? 2 : 1,
                sectionUpdated = a.IncludeGaps != b.IncludeGaps || a.IncludeDiagrams != b.IncludeDiagrams ? 1 : 1,
                securityChanges = a.IncludeSecurityAppendix == b.IncludeSecurityAppendix ? 0 : 1,
                leftStatus = a.Status,
                rightStatus = b.Status,
                activity = leftActivity,
            });
        });

        api.MapPost("/documents/{id:guid}/approve", async (Guid id, ReviewInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            doc.ApprovalState = i.State == ReviewState.Approved ? "Approved" : "Returned";
            doc.Status = i.State == ReviewState.Approved ? "Final" : doc.Status;
            await audit.Record(db, u, i.State.ToString(), "GeneratedDocument", doc.Id, i.Comment, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { doc.Id, doc.Status, doc.ApprovalState });
        });

        api.MapGet("/documents/preview/{key}", async (string key, string? audience, bool? includeSecurity, AppDbContext db) =>
        {
            var system = await db.Systems.FirstOrDefaultAsync(x => x.CatalogKey == key);
            if (system is null) return Results.NotFound();
            var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
            var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
            var findings = await db.Findings.Where(x => x.SystemId == system.Id).ToListAsync();
            var scan = await db.ScanAssessments.Include(x => x.Domains).FirstOrDefaultAsync(x => x.AssessedSystemId == system.Id);
            var selectedAudience = string.IsNullOrWhiteSpace(audience) ? "Internal" : audience;
            var blocking = new List<string>();
            if (facts.Any(f => f.Attribute.Contains("Version", StringComparison.OrdinalIgnoreCase) && !ScanScoring.IsFilled(f.Value)))
                blocking.Add("Database version not confirmed");
            if (facts.Any(f => f.Attribute.Contains("Hosting location", StringComparison.OrdinalIgnoreCase) && !ScanScoring.IsFilled(f.Value)))
                blocking.Add("Hosting location not confirmed");
            if (facts.Any(f => f.Domain == ScanDomainKind.Integrations && f.Validation != ValidationStatus.SmeValidated && f.Validation != ValidationStatus.Approved))
                blocking.Add("Integrations remain unvalidated");
            if (scan?.Domains.Any(d => d.Kind == ScanDomainKind.Security && d.Requirement == DomainRequirement.Deferred) == true)
                blocking.Add("Security section deferred");
            var confirmed = findings.Count(f => f.ReviewState == ReviewState.Approved);
            var awaiting = await db.Claims.CountAsync(x => x.AssessedSystemId == system.Id && x.AnalystDecision == "Pending");
            var rejected = await db.Claims.CountAsync(x => x.AssessedSystemId == system.Id && x.AnalystDecision == "Rejected");
            return Results.Ok(new
            {
                system = system.Name,
                subtitle = "Current-State System Assessment",
                project = (await db.Projects.FindAsync(system.ProjectId))?.Name,
                date = DateTime.UtcNow.ToString("dd MMMM yyyy"),
                readiness = scan?.DocumentReadiness ?? 0,
                completeness = scan?.InformationCompleteness ?? 0,
                blocking,
                confirmed,
                awaiting,
                rejected,
                snapshot = "v0.3",
                template = "1.0",
                executive = string.IsNullOrWhiteSpace(system.Description)
                    ? $"{system.Name} is an internal legacy application. Detailed architecture, database configuration, hosting arrangements and integrations remain under assessment."
                    : system.Description,
                areaStatus = scan?.Domains.Select(d => new
                {
                    area = ScanScoring.Weights.First(w => w.Kind == d.Kind).Title,
                    status = d.Requirement == DomainRequirement.Deferred ? "Deferred" : d.Completeness >= 40 ? "Partially validated" : d.Completeness == 0 ? "Information required" : "Unconfirmed",
                }),
                architecture = facts.Where(f => f.Domain == ScanDomainKind.Architecture && f.State != InformationState.Future)
                    .Take(4)
                    .Select(f => new { f.Attribute, f.Value, claim = f.ClaimType.ToString(), f.Validation }),
                warnings = new[] { "Document will clearly label unvalidated content." },
                includeSecurity = includeSecurity ?? false,
                audience = selectedAudience,
            });
        });

        api.MapGet("/documents/preview/project/{projectId:guid}", async (Guid projectId, AppDbContext db) =>
        {
            var project = await db.Projects.FindAsync(projectId);
            if (project is null) return Results.NotFound();
            var systems = await db.Systems.Where(x => x.ProjectId == projectId && !x.Archived).OrderBy(x => x.Name).ToListAsync();
            var systemIds = systems.Select(x => x.Id).ToList();
            var scans = await db.ScanAssessments.Where(x => systemIds.Contains(x.AssessedSystemId)).ToListAsync();
            var integrations = await db.Integrations.Where(x => x.ProjectId == projectId && !x.Archived).ToListAsync();
            var requirements = await db.Requirements.Where(x => x.ProjectId == projectId).OrderBy(x => x.Priority).ThenBy(x => x.Title).ToListAsync();
            return Results.Ok(new
            {
                project = project.Name,
                project.Objective,
                project.Scope,
                date = DateTime.UtcNow.ToString("dd MMMM yyyy"),
                systems = systems.Select(system =>
                {
                    var scan = scans.FirstOrDefault(x => x.AssessedSystemId == system.Id);
                    return new { system.Id, system.Name, system.Acronym, system.CatalogKey, system.Description, completeness = scan?.InformationCompleteness ?? 0, validation = scan?.ValidationCompleteness ?? 0, readiness = scan?.DocumentReadiness ?? 0 };
                }),
                relationships = integrations.Select(x => new { source = x.SourceSystem, target = x.Target, x.Name, x.Method, state = x.State.ToString() }),
                requirements = requirements.Select(x => new { x.Title, x.Description, type = x.Type, x.Category, priority = x.Priority.ToString(), x.Mandatory, x.AcceptanceCriteria }),
            });
        });

        api.MapGet("/validation/requests", async (AppDbContext db) =>
            await db.ValidationRequests.Include(x => x.Items).OrderByDescending(x => x.CreatedAt)
                .Select(r => new { r.Id, r.Reference, r.Title, r.RequestedBy, r.Reviewer, r.DueDate, r.Status, r.AssessedSystemId, total = r.Items.Count, reviewed = r.Items.Count(i => i.Status == "Reviewed") })
                .ToListAsync());

        api.MapGet("/validation/requests/{id}", async (string id, AppDbContext db) =>
        {
            var request = Guid.TryParse(id, out var guid)
                ? await db.ValidationRequests.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == guid)
                : await db.ValidationRequests.Include(x => x.Items).FirstOrDefaultAsync(x => x.Reference == id);
            if (request is null) return Results.NotFound();
            var system = await db.Systems.FindAsync(request.AssessedSystemId);
            return Results.Ok(new
            {
                request.Id,
                request.Reference,
                request.Title,
                request.RequestedBy,
                request.Reviewer,
                request.DueDate,
                request.Status,
                request.Context,
                system = system?.Name,
                catalogKey = system?.CatalogKey,
                items = request.Items.OrderBy(x => x.CreatedAt).Select(i => new
                {
                    i.Id,
                    i.Statement,
                    domain = i.Domain.ToString(),
                    i.Confidence,
                    i.Status,
                    i.Decision,
                    i.Comment,
                    i.EvidenceTitle,
                    i.EvidenceExcerpt,
                    i.SourceLocation,
                }),
            });
        });

        api.MapPut("/validation/items/{id:guid}", async (Guid id, ValidationDecisionInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var item = await db.ValidationItems.FindAsync(id);
            if (item is null) return Results.NotFound();
            item.Decision = i.Decision;
            item.Comment = i.Comment ?? item.Comment;
            item.Status = string.IsNullOrWhiteSpace(i.Decision) ? "Pending" : "Reviewed";
            if (item.ClaimId is Guid claimId)
            {
                var claim = await db.Claims.FindAsync(claimId);
                if (claim is not null)
                {
                    claim.ReviewComment = item.Comment;
                    claim.Validation = i.Decision switch
                    {
                        "confirm" => ValidationStatus.SmeValidated,
                        "correct" => ValidationStatus.SmeValidated,
                        "reject" => ValidationStatus.AnalystReviewed,
                        _ => ValidationStatus.SmeReviewRequested
                    };
                    if (i.Decision == "confirm") claim.AnalystDecision = "Confirmed";
                    if (i.Decision == "correct") { claim.AnalystDecision = "Corrected"; if (!string.IsNullOrWhiteSpace(i.CorrectedStatement)) claim.Statement = i.CorrectedStatement; }
                    if (i.Decision == "reject") claim.AnalystDecision = "Rejected";
                    if (i.Decision == "unsure") claim.AnalystDecision = "Pending";
                }
            }
            await audit.Record(db, u, "Validate", "ValidationItem", item.Id, i.Decision, item.Id);
            await db.SaveChangesAsync();
            return Results.Ok(item);
        });

        api.MapPost("/validation/requests/{id}/submit", async (string id, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var request = Guid.TryParse(id, out var guid)
                ? await db.ValidationRequests.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == guid)
                : await db.ValidationRequests.Include(x => x.Items).FirstOrDefaultAsync(x => x.Reference == id);
            if (request is null) return Results.NotFound();
            request.Status = "Submitted";
            await audit.Record(db, u, "Submit", "ValidationRequest", request.Id, request.Reference, request.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(new { request.Id, request.Status });
        });

        api.MapPost("/claims/{id:guid}/review", async (Guid id, ClaimReviewInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var claim = await db.Claims.FindAsync(id);
            if (claim is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(i.Statement)) claim.Statement = i.Statement.Trim();
            claim.AnalystDecision = i.Decision;
            claim.ReviewComment = i.Comment ?? "";
            claim.ReviewerAssigned = i.Reviewer ?? claim.ReviewerAssigned;
            claim.VisibilityLabel = i.Visibility ?? claim.VisibilityLabel;
            claim.Validation = i.Decision switch
            {
                "Confirmed" => ValidationStatus.AnalystReviewed,
                "Corrected" => ValidationStatus.AnalystReviewed,
                "Rejected" => ValidationStatus.Captured,
                "NeedsEvidence" => ValidationStatus.AiExtracted,
                _ => ValidationStatus.AiExtracted
            };
            if (i.Decision == "Rejected") claim.ClaimType = ClaimType.Unknown;
            await audit.Record(db, u, "Review", "ExtractedClaim", claim.Id, i.Decision, claim.ProjectId);
            await db.SaveChangesAsync();
            return Results.Ok(claim);
        });

        api.MapPost("/systems/{id:guid}/claims/apply", async (Guid id, ApplyClaimsInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var claims = await db.Claims.Where(x => x.AssessedSystemId == id && (x.AnalystDecision == "Confirmed" || x.AnalystDecision == "Corrected")).ToListAsync();
            foreach (var claim in claims)
            {
                var existing = await db.ScanFacts.FirstOrDefaultAsync(f => f.AssessedSystemId == id && f.Attribute == "Extracted" && f.Value == claim.Statement);
                if (existing is null)
                {
                    db.ScanFacts.Add(new ScanFact
                    {
                        ProjectId = system.ProjectId,
                        AssessedSystemId = id,
                        Domain = claim.Domain,
                        Attribute = claim.Domain == ScanDomainKind.Architecture ? "Front-end technology" : claim.Domain.ToString(),
                        Value = claim.Statement,
                        Validation = ValidationStatus.AnalystReviewed,
                        ClaimType = claim.ClaimType,
                        Confidence = claim.Confidence,
                        EvidenceId = claim.EvidenceId,
                        EvidenceExcerpt = claim.EvidenceExcerpt,
                        SourceLocation = claim.SourceLocation,
                        State = claim.State,
                    });
                }
                if (i.CreateValidationRequests)
                    claim.Validation = ValidationStatus.SmeReviewRequested;
            }
            await audit.Record(db, u, "Apply", "ExtractedClaim", id, $"{claims.Count} claims applied", system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Ok(new { applied = claims.Count });
        });
    }

    static object ParseActivity(string json)
    {
        try { return JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(json) ? "[]" : json); }
        catch { return Array.Empty<object>(); }
    }

    static void AppendActivity(GeneratedDocument doc, string text)
    {
        var items = new List<object>();
        try
        {
            if (!string.IsNullOrWhiteSpace(doc.ActivityJson))
            {
                var parsed = JsonSerializer.Deserialize<List<JsonElement>>(doc.ActivityJson);
                if (parsed is not null) items.AddRange(parsed.Cast<object>());
            }
        }
        catch { /* keep existing text if the log is malformed */ }
        items.Insert(0, new { at = DateTimeOffset.UtcNow, text });
        doc.ActivityJson = JsonSerializer.Serialize(items);
    }

    static void ApplyPublication(GeneratedDocument doc, PublishInput i)
    {
        if (!string.IsNullOrWhiteSpace(i.Title)) doc.Title = i.Title.Trim();
        doc.Classification = i.Classification ?? doc.Classification;
        doc.VisibilityScope = i.Visibility ?? doc.VisibilityScope;
        doc.PublicationNote = i.Note ?? doc.PublicationNote;
        doc.ReviewDate = i.ReviewDate ?? doc.ReviewDate;
        doc.SearchIndexed = i.IncludeSearch;
        doc.AllowDownload = i.AllowDownload;
        doc.ShowOnProfile = i.ShowOnProfile;
        doc.NotifyMembers = i.NotifyMembers;
        doc.AllowExternal = i.AllowExternal;
    }

    static GeneratedDocument CloneDocument(GeneratedDocument source, string version, string status, string approval, string generatedBy) => new()
    {
        ProjectId = source.ProjectId,
        AssessedSystemId = source.AssessedSystemId,
        CatalogKey = source.CatalogKey,
        Title = source.Title,
        TemplateName = source.TemplateName,
        TemplateVersion = source.TemplateVersion,
        Audience = source.Audience,
        StateScope = source.StateScope,
        AssessmentVersion = source.AssessmentVersion,
        VersionLabel = version,
        Format = source.Format,
        FileBytes = source.FileBytes.ToArray(),
        FileName = $"{source.CatalogKey}-{version}.docx",
        Status = status,
        ApprovalState = approval,
        GeneratedBy = generatedBy,
        PageCount = source.PageCount,
        FileSizeBytes = source.FileBytes.Length,
        Readiness = source.Readiness,
        ChecksumSha256 = source.ChecksumSha256,
        RecordId = source.RecordId,
        Classification = source.Classification,
        VisibilityScope = source.VisibilityScope,
        IncludeDiagrams = source.IncludeDiagrams,
        IncludeFindings = source.IncludeFindings,
        IncludeGaps = source.IncludeGaps,
        IncludeSecurityAppendix = source.IncludeSecurityAppendix,
        Warnings = source.Warnings,
    };
}

public record ValidationDecisionInput(string Decision, string? Comment, string? CorrectedStatement);
public record ClaimReviewInput(string Decision, string? Statement, string? Comment, string? Reviewer, string? Visibility);
public record ApplyClaimsInput(bool CreateValidationRequests);
public record DocumentCommentInput(int SectionNumber, string Section, string Text, string? Domain);
public record DocumentDecisionInput(string Decision, string? Comment, bool NotifyLead, bool IncludeComments);
public record PublishInput(string? Title, string? Category, string? Classification, string? Owner, string? Visibility, DateOnly? ReviewDate, string? Note, bool IncludeSearch, bool AllowDownload, bool ShowOnProfile, bool NotifyMembers, bool AllowExternal, bool IncludePdf);
public record SubmitApprovalInput(string? Approver, string? Comment);
