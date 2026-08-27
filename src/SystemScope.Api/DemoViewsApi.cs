using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class DemoViewsApi
{
    public static void MapDemoViews(this RouteGroupBuilder api)
    {
        api.MapGet("/scan/profile/{key}", async (string key, AppDbContext db) =>
        {
            var system = await db.Systems.Include(x => x.Integrations).FirstOrDefaultAsync(x => x.CatalogKey == key);
            if (system is null) return Results.NotFound();
            var payload = await ScanWorkspace.Payload(db, system);
            var scan = await db.ScanAssessments.Include(x => x.Domains).FirstAsync(x => x.AssessedSystemId == system.Id);
            var project = await db.Projects.FindAsync(system.ProjectId);
            var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
            var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
            var claims = await db.Claims.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
            var findings = await db.Findings.Where(x => x.SystemId == system.Id).OrderByDescending(x => x.UpdatedAt).ToListAsync();
            var evidence = await db.Evidence.Where(x => x.SystemId == system.Id).OrderByDescending(x => x.UpdatedAt).ToListAsync();
            var documents = await db.GeneratedDocuments.Where(x => x.AssessedSystemId == system.Id).OrderByDescending(x => x.CreatedAt).ToListAsync();
            var audit = await db.AuditEvents.Where(x => x.ProjectId == system.ProjectId).OrderByDescending(x => x.Timestamp).Take(12).ToListAsync();
            var openGaps = gaps.Where(g => ScanScoring.IsOpenGap(g.Status)).ToList();
            var mustGaps = openGaps.Where(g => g.Priority == Priority.Must).ToList();
            var confirmed = claims.Count(c => c.AnalystDecision is "Confirmed" or "Corrected") + findings.Count(f => f.ReviewState == ReviewState.Approved);
            var awaiting = claims.Count(c => c.AnalystDecision is "Pending" or "" || c.Validation == ValidationStatus.SmeReviewRequested);
            string TechStatus(string attribute)
            {
                var fact = facts.FirstOrDefault(f => f.Attribute.Equals(attribute, StringComparison.OrdinalIgnoreCase));
                if (fact is null) return "Information gap";
                if (fact.State == InformationState.Future) return "Proposed";
                if (fact.ClaimType == ClaimType.Inference) return "Inferred";
                if (fact.Validation == ValidationStatus.SmeReviewRequested) return "To confirm";
                if (fact.ClaimType == ClaimType.ExplicitStatement && fact.Confidence is "High") return "Confirmed";
                if (!ScanScoring.IsFilled(fact.Value)) return fact.Value is "Unknown" ? "Unvalidated" : "Information gap";
                if (fact.Value.Equals("Unknown", StringComparison.OrdinalIgnoreCase)) return "Unvalidated";
                return fact.Validation.ToString();
            }
            var technology = new (string Attribute, string Fallback)[]
            {
                ("Front-end technology", "Unknown"),
                ("Database product", "Unknown"),
                ("Architecture style", "Unknown"),
                ("Application server", "Unknown"),
                ("Reporting technology", "Unknown"),
            }.Select(row =>
            {
                var fact = facts.FirstOrDefault(f => f.Attribute.Equals(row.Attribute, StringComparison.OrdinalIgnoreCase));
                var label = row.Attribute switch
                {
                    "Front-end technology" => "Front end",
                    "Database product" => "Database",
                    "Architecture style" => "Architecture",
                    "Application server" => "Application server",
                    "Reporting technology" => "Reporting",
                    _ => row.Attribute,
                };
                return new { name = label, value = fact?.Value ?? row.Fallback, status = TechStatus(row.Attribute) };
            });
            var relationships = new[]
            {
                new { name = "Groundwater", detail = "Similar application pattern", status = "Awaiting validation", catalogKey = "gwdb" },
                new { name = "WMIP", detail = "Possible downstream publication", status = "Rejected claim or Unconfirmed", catalogKey = "" },
                new { name = "External portal", detail = "Future-state requirement", status = "Proposed", catalogKey = "" },
                new { name = "Internal reviewer application", detail = "Future-state requirement", status = "Confirmed need", catalogKey = "" },
            };
            var published = documents.Where(d => d.Status == "Published" && d.ShowOnProfile).Select(d => new
            {
                d.Id,
                d.Title,
                d.VersionLabel,
                d.PublishedVersion,
                d.Classification,
                d.Status,
                d.RecordId,
                d.PublishedAt,
                d.FileName,
                d.Format,
            });
            var priority = new[]
            {
                "Confirm Oracle Forms version",
                "Confirm Oracle Database version and schemas",
                "Identify hosting model and environments",
                "Identify upstream and downstream systems",
                "Confirm business owner",
            }.Select(title => openGaps.FirstOrDefault(g => g.MissingInformation.Equals(title, StringComparison.OrdinalIgnoreCase))
                ?? mustGaps.FirstOrDefault(g => g.MissingInformation.Contains(title, StringComparison.OrdinalIgnoreCase)))
            .Where(g => g is not null).Cast<InformationGap>().DistinctBy(g => g.Id).Take(5)
            .Select(g => new { g.Id, g.MissingInformation, domain = g.Domain.ToString(), status = g.Status.ToString() });
            if (!priority.Any())
                priority = mustGaps.Take(5).Select(g => new { g.Id, g.MissingInformation, domain = g.Domain.ToString(), status = g.Status.ToString() });

            var masterId = system.MasterSystemId;
            var capabilities = await (
                from link in db.SystemCapabilities
                join cap in db.BusinessCapabilities on link.CapabilityId equals cap.Id
                where masterId != null && link.MasterSystemId == masterId && !link.Archived && !cap.Archived
                orderby cap.Level, cap.Name
                select new
                {
                    link.Id,
                    capabilityId = cap.Id,
                    cap.CatalogKey,
                    cap.Name,
                    level = cap.Level.ToString(),
                    cap.Domain,
                    role = link.Role.ToString(),
                    link.MaturityScore,
                    state = link.State.ToString(),
                    validation = link.Validation.ToString(),
                }).ToListAsync();
            var informationAssets = await (
                from link in db.SystemInformationAssets
                join asset in db.InformationAssets on link.InformationAssetId equals asset.Id
                where masterId != null && link.MasterSystemId == masterId && !link.Archived && !asset.Archived
                orderby asset.Name
                select new
                {
                    link.Id,
                    informationAssetId = asset.Id,
                    asset.CatalogKey,
                    asset.Name,
                    classification = asset.Classification.ToString(),
                    role = link.Role.ToString(),
                    state = link.State.ToString(),
                    validation = link.Validation.ToString(),
                }).ToListAsync();
            return Results.Ok(new
            {
                workspace = payload,
                profile = new
                {
                    breadcrumb = new[] { "Systems", project?.Name ?? "Water Monitoring Systems", system.Name },
                    summary = string.IsNullOrWhiteSpace(system.Description)
                        ? $"{system.Name} is an internal legacy application supporting Water Monitoring Systems."
                        : system.Description,
                    validationLabel = scan.InformationCompleteness >= 40 ? "Partially validated" : "In assessment",
                    classification = system.DataClassification,
                    lifecycle = system.Lifecycle,
                    criticality = system.CatalogKey == "aquis" ? "To be confirmed" : system.Criticality.ToString(),
                    businessOwner = string.IsNullOrWhiteSpace(system.BusinessOwner) ? "To be confirmed" : system.BusinessOwner,
                    technicalOwner = system.TechnicalOwner,
                    assessmentLead = scan.AssessmentLead,
                    projectManager = "Michael",
                    lastUpdated = scan.UpdatedAt,
                    informationCompleteness = scan.InformationCompleteness,
                    validationCompleteness = scan.ValidationCompleteness,
                    documentReadiness = scan.DocumentReadiness,
                    confirmed,
                    awaiting,
                    openGaps = mustGaps.Count == 0 ? openGaps.Count : mustGaps.Count,
                    lastAssessed = scan.UpdatedAt,
                    technology,
                    relationships,
                    domains = scan.Domains.Select(d =>
                    {
                        var meta = ScanScoring.Weights.First(w => w.Kind == d.Kind);
                        return new
                        {
                            kind = d.Kind.ToString(),
                            title = meta.Title,
                            d.Completeness,
                            d.EvidenceCount,
                            d.GapCount,
                            requirement = d.Requirement.ToString(),
                            d.Summary,
                            status = d.Requirement == DomainRequirement.Deferred ? "Deferred" : d.Completeness == 0 ? "Not assessed" : null,
                        };
                    }),
                    priorityGaps = priority,
                    publishedDocuments = published,
                    findings = findings.Take(8).Select(f => new
                    {
                        f.Id,
                        f.Title,
                        type = f.Type.ToString(),
                        domain = f.Domain?.ToString() ?? "—",
                        f.Confidence,
                        sources = f.EvidenceId is null ? 0 : 2,
                        status = f.ReviewState == ReviewState.Approved ? "Confirmed" : f.Type == FindingType.InformationGap ? "Open" : f.Validation.ToString(),
                    }),
                    evidence = evidence.Take(8).Select(e => new
                    {
                        e.Id,
                        e.Title,
                        e.SourceType,
                        e.Completeness,
                        e.UpdatedAt,
                        e.Url,
                        links = db.EvidenceLinks.Where(l => l.EvidenceId == e.Id && !l.Archived).Select(l => new { entityType = l.EntityType.ToString(), l.EntityId }).ToList(),
                    }),
                    activity = audit.Select(a => new { a.Timestamp, a.ActorName, a.Action, a.EntityType, a.Detail }),
                    capabilities,
                    informationAssets,
                },
            });
        });

        api.MapGet("/search", async (string q, Guid? projectId, AppDbContext db) =>
        {
            var page = await SearchIndex.Page(db, q, projectId);
            return Results.Ok(page.Results.Select(r => new { r.Id, r.ProjectId, r.Type, r.Title, r.Detail, r.System, r.Status, r.Evidence }));
        });

        api.MapGet("/search/page", async (string q, Guid? projectId, AppDbContext db) =>
        {
            var started = DateTime.UtcNow;
            var page = await SearchIndex.Page(db, q, projectId);
            return Results.Ok(new
            {
                query = (q ?? "").Trim(),
                total = page.Results.Count,
                tookMs = Math.Max(1, (int)(DateTime.UtcNow - started).TotalMilliseconds),
                facets = page.Facets,
                insights = page.Insights,
                related = page.Related,
                saved = new[]
                {
                    "Oracle technology across systems",
                    "Unconfirmed infrastructure",
                    "Published market-scan documents",
                },
                results = page.Results,
            });
        });

        api.MapGet("/documents/published/{recordId}", async (string recordId, AppDbContext db) =>
        {
            var doc = await db.GeneratedDocuments.Include(x => x.Comments)
                .Where(x => x.RecordId == recordId && x.Status == "Published")
                .OrderByDescending(x => x.PublishedAt)
                .FirstOrDefaultAsync()
                ?? await db.GeneratedDocuments.Include(x => x.Comments)
                    .Where(x => x.RecordId == recordId)
                    .OrderByDescending(x => x.CreatedAt)
                    .FirstOrDefaultAsync();
            if (doc is null) return Results.NotFound();
            doc.ViewCount++;
            await db.SaveChangesAsync();
            var system = doc.AssessedSystemId is Guid sid ? await db.Systems.FindAsync(sid) : await db.Systems.FirstOrDefaultAsync(x => x.CatalogKey == doc.CatalogKey);
            var project = await db.Projects.FindAsync(doc.ProjectId);
            var scan = system is null ? null : await db.ScanAssessments.Include(x => x.Domains).FirstOrDefaultAsync(x => x.AssessedSystemId == system.Id);
            var findings = system is null ? 0 : await db.Findings.CountAsync(x => x.SystemId == system.Id);
            var evidence = system is null ? 0 : await db.Evidence.CountAsync(x => x.SystemId == system.Id);
            var hits = new[]
            {
                new { section = "4. System architecture & technical design", text = $"{system?.Name ?? "The system"} is an internal legacy application using an Oracle Forms front end.", page = 6, status = "Confirmed" },
                new { section = "Application components", text = "AQUIS Forms | User interface | Oracle Forms | Version unknown", page = 6, status = "" },
                new { section = "Executive summary", text = "The system currently relies on Oracle Forms and an Oracle Database.", page = 2, status = "" },
            };
            return Results.Ok(new
            {
                doc.Id,
                doc.Title,
                doc.RecordId,
                doc.VersionLabel,
                publishedVersion = string.IsNullOrWhiteSpace(doc.PublishedVersion) ? "v1.0" : doc.PublishedVersion,
                doc.Status,
                doc.Classification,
                doc.VisibilityScope,
                doc.Format,
                doc.PageCount,
                doc.FileSizeBytes,
                doc.ChecksumSha256,
                doc.RetentionYears,
                doc.ReviewDate,
                doc.PublishedAt,
                doc.GeneratedBy,
                doc.Approver,
                doc.ApprovalComment,
                doc.PublicationNote,
                doc.TemplateName,
                doc.TemplateVersion,
                assessmentSnapshot = "v0.3",
                owner = doc.GeneratedBy,
                views = doc.ViewCount,
                downloads = doc.DownloadCount,
                catalogKey = doc.CatalogKey,
                systemName = system?.Name,
                projectName = project?.Name,
                findingCount = findings,
                evidenceCount = evidence,
                activity = ParseActivity(doc.ActivityJson),
                coverage = scan?.Domains.Select(d => new
                {
                    area = ScanScoring.Weights.First(w => w.Kind == d.Kind).Title,
                    status = d.Requirement == DomainRequirement.Deferred ? "Deferred" : d.Completeness >= 30 ? "Partially validated" : d.Completeness == 0 ? "Information required" : "Unconfirmed",
                }),
                hits,
                overview = doc.PublicationNote,
            });
        });
    }

    static object[] ParseActivity(string json)
    {
        try { return System.Text.Json.JsonSerializer.Deserialize<object[]>(json) ?? []; }
        catch { return []; }
    }
}

public static class SearchIndex
{
    public record Hit(
        Guid Id,
        Guid ProjectId,
        string Type,
        string Title,
        string Detail,
        string System,
        string Status,
        string Evidence,
        string CatalogKey,
        string[] Badges,
        int? Completeness,
        DateTimeOffset? UpdatedAt);

    public record PageResult(List<Hit> Results, object Facets, object Insights, string[] Related);

    public static async Task<PageResult> Page(AppDbContext db, string? query, Guid? projectId)
    {
        var q = (query ?? "").Trim();
        if (q.Length < 2) return new PageResult([], new { systems = 0, assessments = 0, findings = 0, evidence = 0, documents = 0, integrations = 0 }, new { systems = 0, summary = "" }, []);

        bool Match(params string?[] parts) => parts.Any(p => !string.IsNullOrWhiteSpace(p) && p!.Contains(q, StringComparison.OrdinalIgnoreCase));
        var hits = new List<Hit>();

        var systems = await db.Systems.Where(x => projectId == null || x.ProjectId == projectId).ToListAsync();
        var scans = await db.ScanAssessments.Include(x => x.Domains).ToListAsync();
        foreach (var s in systems.Where(x => Match(x.Name, x.Acronym, x.Description, x.Tags, x.Vendor, x.Product, x.BusinessPurpose)))
        {
            var scan = scans.FirstOrDefault(sc => sc.AssessedSystemId == s.Id);
            hits.Add(new Hit(s.Id, s.ProjectId, "System", s.Name,
                string.IsNullOrWhiteSpace(s.Description) ? $"{s.Name} system record." : s.Description,
                s.Acronym, scan is null ? s.Lifecycle : "In assessment", "",
                s.CatalogKey,
                new[] { "Oracle Forms", s.Lifecycle }.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray(),
                scan?.InformationCompleteness, scan?.UpdatedAt ?? s.UpdatedAt));
        }

        foreach (var s in systems)
        {
            var scan = scans.FirstOrDefault(sc => sc.AssessedSystemId == s.Id);
            if (scan is null) continue;
            if (Match(s.Name, s.Description, s.Product, s.Tags) || scan.Domains.Any(d => Match(d.Summary)))
            {
                hits.Add(new Hit(scan.Id, s.ProjectId, "Assessment", $"{s.Name} current-state assessment",
                    s.Description, s.Acronym, "Partially validated", $"{scan.Domains.Sum(d => d.GapCount)} gaps",
                    s.CatalogKey, ["In assessment"], scan.InformationCompleteness, scan.UpdatedAt));
            }
            foreach (var domain in scan.Domains.Where(d => Match(d.Summary)))
            {
                var title = ScanScoring.Weights.First(w => w.Kind == domain.Kind).Title;
                hits.Add(new Hit(domain.Id, s.ProjectId, "Assessment", $"{title} — {s.Name}",
                    domain.Summary, s.Acronym, domain.Completeness >= 30 ? "Partially validated" : "In progress",
                    $"{domain.GapCount} gaps", s.CatalogKey, [title], domain.Completeness, domain.LastUpdatedAt));
            }
        }

        var findings = await db.Findings.Where(x => projectId == null || x.ProjectId == projectId).ToListAsync();
        foreach (var f in findings.Where(x => Match(x.Title, x.Description, x.Owner, x.Recommendation)))
        {
            var system = systems.FirstOrDefault(s => s.Id == f.SystemId);
            hits.Add(new Hit(f.Id, f.ProjectId, "Finding", f.Title, f.Description, system?.Name ?? f.Owner,
                f.ReviewState == ReviewState.Approved ? "Confirmed" : f.Type.ToString(),
                f.EvidenceId is null ? "No evidence" : "2 sources",
                system?.CatalogKey ?? "", new[] { f.Confidence + " confidence" }, null, f.UpdatedAt));
        }

        var evidence = await db.Evidence.Where(x => projectId == null || x.ProjectId == projectId).ToListAsync();
        foreach (var e in evidence.Where(x => Match(x.Title, x.Source, x.SourceType, x.Participants)))
        {
            var system = systems.FirstOrDefault(s => s.Id == e.SystemId);
            hits.Add(new Hit(e.Id, e.ProjectId, "Evidence", e.Title,
                $"{e.SourceType} · {e.Participants}", system?.Name ?? "", e.Completeness, e.SourceType,
                system?.CatalogKey ?? "", new[] { e.SourceType, e.Completeness }, null, e.UpdatedAt));
        }

        var documents = await db.GeneratedDocuments.Where(x => projectId == null || x.ProjectId == projectId).ToListAsync();
        foreach (var d in documents.Where(x => (x.SearchIndexed || x.Status == "Published") && Match(x.Title, x.RecordId, x.CatalogKey, x.PublicationNote, x.Summary, x.Warnings)))
        {
            hits.Add(new Hit(d.Id, d.ProjectId, "Document", d.Title,
                string.IsNullOrWhiteSpace(d.PublicationNote)
                    ? $"{d.VersionLabel} · {d.Classification} · {d.VisibilityScope}"
                    : d.PublicationNote,
                d.CatalogKey, d.Status, d.RecordId, d.CatalogKey,
                new[] { d.Status, d.Classification }.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray(),
                d.Readiness, d.PublishedAt ?? d.CreatedAt));
        }

        var integrations = await db.Integrations.Where(x => projectId == null || x.ProjectId == projectId).ToListAsync();
        foreach (var i in integrations.Where(x => Match(x.Name, x.Target, x.Method, x.Technology, x.SourceSystem, x.BusinessPurpose, x.InformationExchanged)))
        {
            var system = systems.FirstOrDefault(s => s.Id == i.SystemId);
            hits.Add(new Hit(i.Id, i.ProjectId, "Integration", i.Name,
                $"{i.SourceSystem} → {i.Target}. {i.BusinessPurpose}", system?.Name ?? i.Owner,
                i.Validation == ValidationStatus.SmeReviewRequested ? "Awaiting validation" : i.State.ToString(),
                i.Validation.ToString(), system?.CatalogKey ?? "", new[] { i.State.ToString() }, null, i.UpdatedAt));
        }

        var ranked = hits
            .GroupBy(h => h.Id)
            .Select(g => g.First())
            .Take(40)
            .ToList();

        var systemHits = ranked.Where(h => h.Type == "System").Select(h => h.Title).Distinct().ToList();
        var facets = new
        {
            systems = ranked.Count(h => h.Type == "System"),
            assessments = ranked.Count(h => h.Type == "Assessment"),
            findings = ranked.Count(h => h.Type == "Finding"),
            evidence = ranked.Count(h => h.Type == "Evidence"),
            documents = ranked.Count(h => h.Type == "Document"),
            integrations = ranked.Count(h => h.Type == "Integration"),
        };
        var insights = new
        {
            systems = systemHits.Count,
            names = systemHits,
            summary = systemHits.Count == 0
                ? $"No systems matched '{q}'."
                : $"{string.Join(" and ", systemHits)} contain matching {q} references.",
            architecture = ranked.Count(h => h.Type is "Assessment" or "Fact" or "Finding"),
            evidence = ranked.Count(h => h.Type == "Evidence"),
            documents = ranked.Count(h => h.Type == "Document"),
            integrations = ranked.Count(h => h.Type == "Integration"),
        };
        var related = new[] { $"{q} versions", "Legacy client/server applications", "Groundwater dependencies", "Applications awaiting validation" };
        return new PageResult(ranked, facets, insights, related);
    }
}
