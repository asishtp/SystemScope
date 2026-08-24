using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class ScanApi
{
    public static void MapScan(this RouteGroupBuilder api)
    {
        api.MapGet("/scan/systems", async (AppDbContext db) =>
        {
            var masters = await db.MasterSystems.Include(x => x.ProjectSystems).OrderBy(x => x.Name).ToListAsync();
            var scans = await db.ScanAssessments.ToListAsync();
            return masters.Select(m =>
            {
                var related = scans.Where(s => s.MasterSystemId == m.Id).ToList();
                var info = related.Count == 0 ? 0 : (int)Math.Round(related.Average(s => s.InformationCompleteness));
                return new
                {
                    m.Id,
                    m.Name,
                    m.Acronym,
                    m.CatalogKey,
                    m.Description,
                    m.BusinessPurpose,
                    m.BusinessOwner,
                    m.TechnicalOwner,
                    m.SupportTeam,
                    criticality = m.Criticality.ToString(),
                    lifecycle = m.LifecycleStatus,
                    m.Vendor,
                    m.Product,
                    state = m.StateClassification.ToString(),
                    m.Tags,
                    m.DataClassification,
                    projects = m.ProjectSystems.Select(s => new { s.Id, s.ProjectId, s.CatalogKey }),
                    informationCompleteness = info,
                    validationCompleteness = related.Count == 0 ? 0 : (int)Math.Round(related.Average(s => s.ValidationCompleteness)),
                    documentReadiness = related.Count == 0 ? 0 : (int)Math.Round(related.Average(s => s.DocumentReadiness)),
                    updatedAt = related.Select(s => s.UpdatedAt).Append(m.UpdatedAt).Max(),
                };
            });
        });

        api.MapPost("/scan/systems", async (MasterSystemInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            if (string.IsNullOrWhiteSpace(i.Name)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["A system name is required."] });
            var key = string.IsNullOrWhiteSpace(i.CatalogKey) ? ScanWorkspace.Slug(i.Acronym ?? "", i.Name) : i.CatalogKey.Trim().ToLowerInvariant();
            if (await db.MasterSystems.AnyAsync(x => x.CatalogKey == key || (x.Acronym == i.Acronym && x.Name == i.Name)))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["system"] = ["A system with this name or key already exists."] });
            var m = new MasterSystem
            {
                Name = i.Name.Trim(),
                Acronym = (i.Acronym ?? "").Trim(),
                CatalogKey = key,
                Description = (i.Description ?? "").Trim(),
                BusinessPurpose = (i.BusinessPurpose ?? "").Trim(),
                BusinessCapabilities = (i.BusinessCapabilities ?? "").Trim(),
                BusinessOwner = (i.BusinessOwner ?? "").Trim(),
                TechnicalOwner = (i.TechnicalOwner ?? "").Trim(),
                SupportTeam = (i.SupportTeam ?? "").Trim(),
                UserGroups = (i.UserGroups ?? "").Trim(),
                UserCount = i.UserCount,
                Criticality = i.Criticality,
                AvailabilityExpectations = (i.AvailabilityExpectations ?? "").Trim(),
                LifecycleStatus = string.IsNullOrWhiteSpace(i.LifecycleStatus) ? "Active" : i.LifecycleStatus.Trim(),
                Vendor = (i.Vendor ?? "").Trim(),
                Product = (i.Product ?? "").Trim(),
                StateClassification = i.StateClassification,
                Tags = (i.Tags ?? "").Trim(),
                DataClassification = string.IsNullOrWhiteSpace(i.DataClassification) ? "OFFICIAL" : i.DataClassification.Trim(),
            };
            db.MasterSystems.Add(m);
            await audit.Record(db, u, "Create", "MasterSystem", m.Id, m.Name);
            await db.SaveChangesAsync();
            return Results.Created($"/api/scan/systems/{m.Id}", m);
        });

        api.MapPut("/scan/systems/{id:guid}", async (Guid id, MasterSystemInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var m = await db.MasterSystems.FindAsync(id);
            if (m is null) return Results.NotFound();
            m.Name = i.Name.Trim();
            m.Acronym = (i.Acronym ?? "").Trim();
            m.Description = (i.Description ?? "").Trim();
            m.BusinessPurpose = (i.BusinessPurpose ?? "").Trim();
            m.BusinessCapabilities = (i.BusinessCapabilities ?? "").Trim();
            m.BusinessOwner = (i.BusinessOwner ?? "").Trim();
            m.TechnicalOwner = (i.TechnicalOwner ?? "").Trim();
            m.SupportTeam = (i.SupportTeam ?? "").Trim();
            m.UserGroups = (i.UserGroups ?? "").Trim();
            m.UserCount = i.UserCount;
            m.Criticality = i.Criticality;
            m.AvailabilityExpectations = (i.AvailabilityExpectations ?? "").Trim();
            m.LifecycleStatus = string.IsNullOrWhiteSpace(i.LifecycleStatus) ? m.LifecycleStatus : i.LifecycleStatus.Trim();
            m.Vendor = (i.Vendor ?? "").Trim();
            m.Product = (i.Product ?? "").Trim();
            m.StateClassification = i.StateClassification;
            m.Tags = (i.Tags ?? "").Trim();
            m.DataClassification = string.IsNullOrWhiteSpace(i.DataClassification) ? m.DataClassification : i.DataClassification.Trim();
            await audit.Record(db, u, "Update", "MasterSystem", m.Id, m.Name);
            await db.SaveChangesAsync();
            return Results.Ok(m);
        });

        api.MapPost("/projects/{id:guid}/scope", async (Guid id, ScopeInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var project = await db.Projects.FindAsync(id);
            var master = await db.MasterSystems.FindAsync(i.MasterSystemId);
            if (project is null || master is null) return Results.NotFound();
            if (await db.Systems.AnyAsync(x => x.ProjectId == id && x.MasterSystemId == master.Id))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["system"] = ["This system is already in scope."] });
            var s = CopyMaster(id, master);
            db.Systems.Add(s);
            await db.SaveChangesAsync();
            await ScanWorkspace.Ensure(db, s);
            await audit.Record(db, u, "Create", "System", s.Id, s.Name, id);
            await db.SaveChangesAsync();
            return Results.Created($"/api/systems/{s.Id}", s);
        });

        api.MapGet("/scan/assessments", async (Guid? projectId, AppDbContext db) =>
        {
            var q = db.ScanAssessments.Include(x => x.Domains).AsQueryable();
            if (projectId is { } pid) q = q.Where(x => x.ProjectId == pid);
            var scans = await q.OrderByDescending(x => x.UpdatedAt).ToListAsync();
            var systems = await db.Systems.ToListAsync();
            var projects = await db.Projects.ToListAsync();
            var gaps = await db.InformationGaps.ToListAsync();
            return scans.Select(s =>
            {
                var system = systems.FirstOrDefault(x => x.Id == s.AssessedSystemId);
                var project = projects.FirstOrDefault(x => x.Id == s.ProjectId);
                return new
                {
                    s.Id,
                    s.ProjectId,
                    projectName = project?.Name,
                    s.AssessedSystemId,
                    catalogKey = system?.CatalogKey,
                    systemName = system?.Name,
                    acronym = system?.Acronym,
                    businessOwner = system?.BusinessOwner,
                    technicalOwner = system?.TechnicalOwner,
                    s.AssessmentLead,
                    status = s.Status.ToString(),
                    s.IncludeInRfi,
                    s.InformationCompleteness,
                    s.ValidationCompleteness,
                    s.DocumentReadiness,
                    openGaps = gaps.Count(g => g.AssessedSystemId == s.AssessedSystemId && ScanScoring.IsOpenGap(g.Status)),
                    lastUpdated = s.UpdatedAt,
                    domains = s.Domains.Select(d => new { kind = d.Kind.ToString(), d.Completeness, requirement = d.Requirement.ToString(), d.Summary }),
                };
            });
        });

        api.MapGet("/scan/by-key/{key}", async (string key, AppDbContext db) =>
        {
            var system = await db.Systems.Include(x => x.Integrations).FirstOrDefaultAsync(x => x.CatalogKey == key);
            if (system is null) return Results.NotFound();
            return Results.Ok(await ScanWorkspace.Payload(db, system));
        });

        api.MapGet("/systems/{id:guid}/scan", async (Guid id, AppDbContext db) =>
        {
            var system = await db.Systems.Include(x => x.Integrations).FirstOrDefaultAsync(x => x.Id == id);
            if (system is null) return Results.NotFound();
            return Results.Ok(await ScanWorkspace.Payload(db, system));
        });

        api.MapPut("/systems/{id:guid}/scan", async (Guid id, ScanUpdateInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            if (i.BusinessOwner is not null) system.BusinessOwner = i.BusinessOwner.Trim();
            if (i.TechnicalOwner is not null) system.TechnicalOwner = i.TechnicalOwner.Trim();
            if (i.BusinessPurpose is not null) system.BusinessPurpose = i.BusinessPurpose.Trim();
            if (i.Description is not null) system.Description = i.Description.Trim();
            if (i.SupportTeam is not null) system.SupportTeam = i.SupportTeam.Trim();
            if (i.Lifecycle is not null) system.Lifecycle = i.Lifecycle.Trim();
            if (i.Vendor is not null) system.Vendor = i.Vendor.Trim();
            if (i.Product is not null) system.Product = i.Product.Trim();
            if (i.Tags is not null) system.Tags = i.Tags.Trim();
            if (i.DataClassification is not null) system.DataClassification = i.DataClassification.Trim();
            var scan = await ScanWorkspace.Ensure(db, system);
            if (i.AssessmentLead is not null) scan.AssessmentLead = i.AssessmentLead.Trim();
            if (i.Assessor is not null) scan.Assessor = i.Assessor.Trim();
            if (i.IncludeInRfi is { } rfi) scan.IncludeInRfi = rfi;
            if (i.IncludeInDocument is { } doc) scan.IncludeInDocument = doc;
            if (i.Status is { } status) scan.Status = status;
            if (system.MasterSystemId is Guid mid)
            {
                var master = await db.MasterSystems.FindAsync(mid);
                if (master is not null)
                {
                    master.BusinessOwner = system.BusinessOwner;
                    master.TechnicalOwner = system.TechnicalOwner;
                    master.Description = system.Description;
                    master.BusinessPurpose = system.BusinessPurpose;
                    master.SupportTeam = system.SupportTeam;
                    master.LifecycleStatus = system.Lifecycle;
                    master.Vendor = system.Vendor;
                    master.Product = system.Product;
                    master.Tags = system.Tags;
                    master.DataClassification = system.DataClassification;
                }
            }
            await audit.Record(db, u, "Update", "ScanAssessment", scan.Id, system.Name, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, system.Id);
            return Results.Ok(await ScanWorkspace.Payload(db, system));
        });

        api.MapPut("/scan/domains/{id:guid}", async (Guid id, DomainUpdateInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var domain = await db.ScanDomains.FindAsync(id);
            if (domain is null) return Results.NotFound();
            if (i.Requirement is { } req) domain.Requirement = req;
            if (i.Summary is not null) domain.Summary = i.Summary.Trim();
            domain.LastUpdatedAt = DateTimeOffset.UtcNow;
            var scan = await db.ScanAssessments.FindAsync(domain.ScanAssessmentId);
            await audit.Record(db, u, "Update", "ScanDomain", domain.Id, domain.Kind.ToString(), scan?.ProjectId);
            await db.SaveChangesAsync();
            if (scan is not null) await ScanWorkspace.Recalculate(db, scan.AssessedSystemId);
            return Results.Ok(domain);
        });

        api.MapPost("/systems/{id:guid}/facts", async (Guid id, FactInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var fact = new ScanFact
            {
                ProjectId = system.ProjectId,
                AssessedSystemId = id,
                Domain = i.Domain,
                Attribute = i.Attribute.Trim(),
                Value = (i.Value ?? "").Trim(),
                Validation = i.Validation,
                ClaimType = i.ClaimType,
                Confidence = string.IsNullOrWhiteSpace(i.Confidence) ? "Unconfirmed" : i.Confidence,
                EvidenceId = i.EvidenceId,
                EvidenceExcerpt = (i.EvidenceExcerpt ?? "").Trim(),
                SourceLocation = (i.SourceLocation ?? "").Trim(),
                Visibility = i.Visibility,
                State = i.State,
                ChangeReason = (i.ChangeReason ?? "").Trim(),
                Speaker = i.Speaker,
            };
            db.ScanFacts.Add(fact);
            await audit.Record(db, u, "Create", "ScanFact", fact.Id, fact.Attribute, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Created($"/api/facts/{fact.Id}", fact);
        });

        api.MapPut("/facts/{id:guid}", async (Guid id, FactInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var fact = await db.ScanFacts.FindAsync(id);
            if (fact is null) return Results.NotFound();
            fact.Attribute = i.Attribute.Trim();
            fact.Value = (i.Value ?? "").Trim();
            fact.Validation = i.Validation;
            fact.ClaimType = i.ClaimType;
            fact.Confidence = string.IsNullOrWhiteSpace(i.Confidence) ? fact.Confidence : i.Confidence;
            fact.EvidenceId = i.EvidenceId;
            fact.EvidenceExcerpt = (i.EvidenceExcerpt ?? "").Trim();
            fact.SourceLocation = (i.SourceLocation ?? "").Trim();
            fact.Visibility = i.Visibility;
            fact.State = i.State;
            fact.ChangeReason = (i.ChangeReason ?? "").Trim();
            fact.Speaker = i.Speaker;
            await audit.Record(db, u, "Update", "ScanFact", fact.Id, fact.Attribute, fact.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, fact.AssessedSystemId);
            return Results.Ok(fact);
        });

        api.MapPost("/claims/{id:guid}/validate", async (Guid id, ClaimValidationInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var claim = await db.Claims.FindAsync(id);
            if (claim is null) return Results.NotFound();
            if (i.Action == "confirm-correction" && !string.IsNullOrWhiteSpace(i.CorrectedStatement))
            {
                db.AuditEvents.Add(new AuditEvent { ProjectId = claim.ProjectId, ActorId = u.FindFirstValue(ClaimTypes.NameIdentifier) ?? "local-user", ActorName = u.Identity?.Name ?? "Local Assessment Lead", Action = "Correct", EntityType = "ExtractedClaim", EntityId = claim.Id, Detail = $"Original: {claim.Statement}" });
                claim.Statement = i.CorrectedStatement.Trim();
            }
            claim.Validation = i.Action switch
            {
                "confirm" or "confirm-correction" => ValidationStatus.SmeValidated,
                "reject" => ValidationStatus.AnalystReviewed,
                "unsure" => ValidationStatus.SmeReviewRequested,
                "request-evidence" => ValidationStatus.SmeReviewRequested,
                _ => claim.Validation
            };
            if (i.Action == "reject") claim.ClaimType = ClaimType.Unknown;
            claim.ReviewComment = (i.Comment ?? "").Trim();
            await audit.Record(db, u, "Validate", "ExtractedClaim", claim.Id, i.Action, claim.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, claim.AssessedSystemId);
            return Results.Ok(claim);
        });

        api.MapPost("/systems/{id:guid}/evidence/analyse", async (Guid id, AnalyseInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u, IConfiguration config) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            if (!Uri.TryCreate(i.Url, UriKind.Absolute, out var uri) || uri.Scheme != "https")
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["url"] = ["Evidence must use an HTTPS link."] });
            var hosts = config.GetSection("Evidence:ApprovedHosts").Get<string[]>() ?? [];
            if (hosts.Length > 0 && !hosts.Any(h => uri.Host.Equals(h, StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("." + h, StringComparison.OrdinalIgnoreCase)))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["url"] = ["The evidence repository is not approved."] });
            var evidence = new Evidence
            {
                ProjectId = system.ProjectId,
                SystemId = id,
                Title = i.Title.Trim(),
                Url = i.Url,
                Source = (i.Source ?? "").Trim(),
                SourceType = string.IsNullOrWhiteSpace(i.SourceType) ? "Document" : i.SourceType,
                Completeness = string.IsNullOrWhiteSpace(i.Completeness) ? "Partial" : i.Completeness,
                Reliability = string.IsNullOrWhiteSpace(i.Reliability) ? "Medium" : i.Reliability,
                Confidentiality = string.IsNullOrWhiteSpace(i.Confidentiality) ? "Internal" : i.Confidentiality,
                Participants = i.Participants ?? "",
                Classification = "OFFICIAL",
                ProcessingStatus = i.ExtractClaims ? "Extracted" : "Registered",
                EvidenceDate = DateOnly.TryParse(i.EvidenceDate, out var d) ? d : null,
            };
            db.Evidence.Add(evidence);
            var claims = new List<ExtractedClaim>();
            if (i.ExtractClaims || i.ExtractTechnologies)
            {
                claims.Add(new ExtractedClaim { ProjectId = system.ProjectId, AssessedSystemId = id, Domain = ScanDomainKind.Architecture, Statement = $"{system.Name} uses an Oracle Forms front end.", Speaker = i.Source, EvidenceExcerpt = i.Description ?? i.Title, SourceLocation = "00:23", Confidence = "High", ClaimType = ClaimType.ExplicitStatement, Validation = ValidationStatus.AiExtracted, EvidenceId = evidence.Id });
                claims.Add(new ExtractedClaim { ProjectId = system.ProjectId, AssessedSystemId = id, Domain = ScanDomainKind.Database, Statement = $"{system.Name} is likely supported by Oracle Database.", Speaker = "Extraction", EvidenceExcerpt = "Inferred from Oracle Forms; independent evidence required.", Confidence = "Medium", ClaimType = ClaimType.Inference, Validation = ValidationStatus.AiExtracted, EvidenceId = evidence.Id });
            }
            if (i.ExtractIntegrations)
                claims.Add(new ExtractedClaim { ProjectId = system.ProjectId, AssessedSystemId = id, Domain = ScanDomainKind.Integrations, Statement = $"{system.Name} may share data or infrastructure with Groundwater.", Confidence = "Low", ClaimType = ClaimType.Unknown, Validation = ValidationStatus.AiExtracted, EvidenceId = evidence.Id });
            if (i.ExtractGaps)
            {
                db.InformationGaps.Add(new InformationGap { ProjectId = system.ProjectId, AssessedSystemId = id, Domain = ScanDomainKind.Architecture, MissingInformation = $"What business functions does {system.Name} support?", ReasonRequired = "Extracted from incomplete source", Priority = Priority.Must, MarketScanImpact = "Blocks system overview", Status = GapStatus.Open });
            }
            if (!i.AutoValidate)
            {
                foreach (var claim in claims) claim.Validation = ValidationStatus.AiExtracted;
            }
            else
            {
                foreach (var claim in claims) claim.Validation = ValidationStatus.SmeReviewRequested;
            }
            db.Claims.AddRange(claims);
            await audit.Record(db, u, i.ExtractClaims ? "Extract" : "Create", "Evidence", evidence.Id, evidence.Title, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Created($"/api/evidence/{evidence.Id}", new { evidence.Id, claims = claims.Count, note = "Proposed claims require analyst review and are not approved facts." });
        });

        MapRegister<ApplicationComponent, ComponentInput>(api, "/components", db => db.Components,
            (system, i) => new ApplicationComponent { ProjectId = system.ProjectId, AssessedSystemId = system.Id, Name = i.Name.Trim(), ComponentType = i.ComponentType, Technology = i.Technology, Version = i.Version, Purpose = i.Purpose, EnvironmentName = i.EnvironmentName, Owner = i.Owner, LifecycleStatus = i.LifecycleStatus, SupportStatus = i.SupportStatus, EvidenceId = i.EvidenceId, Validation = i.Validation, State = i.State },
            (item, i) => { item.Name = i.Name.Trim(); item.ComponentType = i.ComponentType; item.Technology = i.Technology; item.Version = i.Version; item.Purpose = i.Purpose; item.EnvironmentName = i.EnvironmentName; item.Owner = i.Owner; item.LifecycleStatus = i.LifecycleStatus; item.SupportStatus = i.SupportStatus; item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; item.State = i.State; });

        api.MapGet("/systems/{id:guid}/databases", async (Guid id, AppDbContext db) => await db.SystemDatabases.Where(x => x.AssessedSystemId == id && !x.Archived).ToListAsync());
        api.MapPost("/systems/{id:guid}/databases", async (Guid id, DatabaseInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var item = ApplyDatabase(new SystemDatabase { ProjectId = system.ProjectId, AssessedSystemId = id }, i);
            db.SystemDatabases.Add(item);
            await audit.Record(db, u, "Create", "SystemDatabase", item.Id, item.Product, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Created($"/api/databases/{item.Id}", item);
        });
        api.MapPut("/databases/{id:guid}", async (Guid id, DatabaseInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var item = await db.SystemDatabases.FindAsync(id);
            if (item is null) return Results.NotFound();
            ApplyDatabase(item, i);
            await audit.Record(db, u, "Update", "SystemDatabase", item.Id, item.Product, item.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, item.AssessedSystemId);
            return Results.Ok(item);
        });

        MapSimple<InfrastructureAsset, InfraInput>(api, "/infrastructure", db => db.InfrastructureAssets, (s, i) => ApplyInfra(new InfrastructureAsset { ProjectId = s.ProjectId, AssessedSystemId = s.Id }, i), ApplyInfra);
        MapSimple<DataFlow, FlowInput>(api, "/data-flows", db => db.DataFlows, (s, i) => ApplyFlow(new DataFlow { ProjectId = s.ProjectId, AssessedSystemId = s.Id }, i), ApplyFlow);
        MapSimple<BatchProcess, BatchInput>(api, "/batches", db => db.BatchProcesses, (s, i) => ApplyBatch(new BatchProcess { ProjectId = s.ProjectId, AssessedSystemId = s.Id }, i), ApplyBatch);
        MapSimple<DataDomainRecord, DataDomainInput>(api, "/data-domains", db => db.DataDomains, (s, i) => ApplyData(new DataDomainRecord { ProjectId = s.ProjectId, AssessedSystemId = s.Id }, i), ApplyData);
        MapSimple<SecurityControl, SecurityInput>(api, "/security-controls", db => db.SecurityControls, (s, i) => ApplySecurity(new SecurityControl { ProjectId = s.ProjectId, AssessedSystemId = s.Id }, i), ApplySecurity);

        api.MapGet("/gaps", async (Guid? projectId, Guid? systemId, AppDbContext db) =>
            await db.InformationGaps.Where(x => (projectId == null || x.ProjectId == projectId) && (systemId == null || x.AssessedSystemId == systemId)).OrderBy(x => x.Status).ThenBy(x => x.Priority).ToListAsync());
        api.MapPost("/systems/{id:guid}/gaps", async (Guid id, GapInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var gap = new InformationGap
            {
                ProjectId = system.ProjectId,
                AssessedSystemId = id,
                Domain = i.Domain,
                MissingInformation = i.MissingInformation.Trim(),
                ReasonRequired = (i.ReasonRequired ?? "").Trim(),
                Priority = i.Priority,
                MarketScanImpact = (i.MarketScanImpact ?? "").Trim(),
                AssignedOwner = (i.AssignedOwner ?? "").Trim(),
                DueDate = i.DueDate,
                Status = i.Status,
            };
            db.InformationGaps.Add(gap);
            await audit.Record(db, u, "Create", "InformationGap", gap.Id, gap.MissingInformation, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Created($"/api/gaps/{gap.Id}", gap);
        });
        api.MapPut("/gaps/{id:guid}", async (Guid id, GapInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var gap = await db.InformationGaps.FindAsync(id);
            if (gap is null) return Results.NotFound();
            gap.MissingInformation = i.MissingInformation.Trim();
            gap.ReasonRequired = (i.ReasonRequired ?? "").Trim();
            gap.Priority = i.Priority;
            gap.MarketScanImpact = (i.MarketScanImpact ?? "").Trim();
            gap.AssignedOwner = (i.AssignedOwner ?? "").Trim();
            gap.DueDate = i.DueDate;
            gap.Status = i.Status;
            gap.Resolution = (i.Resolution ?? "").Trim();
            gap.EvidenceId = i.EvidenceId;
            await audit.Record(db, u, "Update", "InformationGap", gap.Id, gap.Status.ToString(), gap.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, gap.AssessedSystemId);
            return Results.Ok(gap);
        });

        api.MapGet("/scan/integrations", async (Guid? projectId, AppDbContext db) =>
        {
            var q = db.Integrations.Where(x => !x.Archived);
            if (projectId is { } pid) q = q.Where(x => x.ProjectId == pid);
            var items = await q.OrderBy(x => x.Name).ToListAsync();
            var systems = await db.Systems.ToDictionaryAsync(x => x.Id, x => x);
            return items.Select(x => new
            {
                x.Id,
                x.ProjectId,
                x.SystemId,
                systemName = systems.TryGetValue(x.SystemId, out var s) ? s.Name : "",
                x.Name,
                x.SourceSystem,
                x.Target,
                x.BusinessPurpose,
                x.Direction,
                x.InformationExchanged,
                state = x.State.ToString(),
                x.Method,
                x.Technology,
                x.Frequency,
                x.Owner,
                x.Monitoring,
                x.Criticality,
                validation = x.Validation.ToString(),
            });
        });

        api.MapPut("/integrations/{id:guid}", async (Guid id, IntegrationScanInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var item = await db.Integrations.FindAsync(id);
            if (item is null) return Results.NotFound();
            ApplyIntegration(item, i);
            await audit.Record(db, u, "Update", "Integration", item.Id, item.Name, item.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, item.SystemId);
            return Results.Ok(item);
        });

        api.MapGet("/documents", async (Guid? projectId, AppDbContext db) =>
            await db.GeneratedDocuments.Where(x => projectId == null || x.ProjectId == projectId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new { x.Id, x.ProjectId, x.Title, x.TemplateName, x.TemplateVersion, x.Audience, x.StateScope, x.AssessmentVersion, x.Status, x.GeneratedBy, x.CreatedAt, x.FileName, x.Warnings, x.IncludeSecurityAppendix })
                .ToListAsync());

        api.MapGet("/documents/{id:guid}/file", async (Guid id, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var doc = await db.GeneratedDocuments.FindAsync(id);
            if (doc is null) return Results.NotFound();
            doc.DownloadCount++;
            await audit.Record(db, u, "Download", "GeneratedDocument", doc.Id, doc.Title, doc.ProjectId);
            await db.SaveChangesAsync();
            return Results.File(doc.FileBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc.FileName);
        });

        api.MapPost("/documents", async (DocumentInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var project = await db.Projects.Include(x => x.Systems).FirstOrDefaultAsync(x => x.Id == i.ProjectId);
            if (project is null) return Results.NotFound();
            var selected = project.Systems.Where(s => i.SystemIds.Count == 0 || i.SystemIds.Contains(s.Id)).ToList();
            if (selected.Count == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["systems"] = ["Select at least one system in scope."] });
            var audience = string.IsNullOrWhiteSpace(i.Audience) ? "Internal" : i.Audience;
            var includeSecurity = i.IncludeSecurityAppendix;
            var warnings = new List<string>();
            var sections = new List<MarketScanDocument.SystemSection>();
            foreach (var system in selected)
            {
                var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
                var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == system.Id).ToListAsync();
                var findings = await db.Findings.Where(x => x.SystemId == system.Id).ToListAsync();
                var evidence = await db.Evidence.Where(x => x.SystemId == system.Id).ToListAsync();
                var scan = await db.ScanAssessments.Include(x => x.Domains).FirstOrDefaultAsync(x => x.AssessedSystemId == system.Id);
                if (facts.Any(f => f.Validation is not ValidationStatus.Approved and not ValidationStatus.DocumentReady and not ValidationStatus.SmeValidated && ScanScoring.IsFilled(f.Value) && f.State == InformationState.Current))
                    warnings.Add($"{system.Name} still contains unvalidated current-state statements. They are labelled and not presented as facts.");
                if (scan?.Domains.Any(d => d.Requirement == DomainRequirement.Deferred) == true)
                    warnings.Add($"{system.Name} has domains deferred by scope; those scores are excluded from completeness.");
                var currentFacts = facts.Where(f => f.State != InformationState.Future && ScanNarrative.Visible(f, audience, includeSecurity)).ToList();
                var futureFacts = facts.Where(f => f.State == InformationState.Future && ScanNarrative.Visible(f, audience, includeSecurity)).ToList();
                List<string> Block(ScanDomainKind kind)
                {
                    var lines = currentFacts.Where(f => f.Domain == kind).Select(f => ScanNarrative.FactLine(f, audience)).ToList();
                    var future = futureFacts.Where(f => f.Domain == kind).Select(f => ScanNarrative.FactLine(f, audience)).ToList();
                    if (future.Count > 0)
                    {
                        lines.Add("Future-state items (not current-state facts):");
                        lines.AddRange(future);
                    }
                    return lines;
                }
                var includedFindings = i.IncludeFindings
                    ? findings.Where(f => f.IncludeInDocument && f.ReviewState == ReviewState.Approved).Select(f => new MarketScanDocument.FindingLine(f.Title, f.Severity.ToString(), f.Description)).ToList()
                    : [];
                if (i.IncludeFindings && findings.Any(f => f.IncludeInDocument && f.ReviewState != ReviewState.Approved))
                    warnings.Add($"{system.Name} has findings that are not approved and were omitted from the document.");
                var includedGaps = i.IncludeGaps
                    ? gaps.Where(g => g.Status != GapStatus.NotApplicable).Select(g => new MarketScanDocument.GapLine(g.MissingInformation, g.Status.ToString(), g.MarketScanImpact)).ToList()
                    : [];
                var flowLines = (await db.DataFlows.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync())
                    .Select(f => $"Data flow {f.DataSet}: {f.Source} → {f.Destination} ({f.State}).").ToList();
                flowLines.AddRange((await db.BatchProcesses.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync())
                    .Select(b => $"Batch process {b.Name}: schedule {(string.IsNullOrWhiteSpace(b.Schedule) ? "unknown" : b.Schedule)}, owner {(string.IsNullOrWhiteSpace(b.OperationalOwner) ? "unknown" : b.OperationalOwner)}."));
                if (flowLines.Count == 0)
                    flowLines.Add("Batch processes and data flows have not been confirmed. Unknown processing is an information gap, not a negative finding.");
                sections.Add(new MarketScanDocument.SystemSection(
                    system.Name,
                    string.IsNullOrWhiteSpace(system.Description) ? $"{system.Name} is in scope. Detailed purpose requires further validation." : system.Description,
                    Block(ScanDomainKind.Architecture),
                    Block(ScanDomainKind.Database),
                    Block(ScanDomainKind.Infrastructure),
                    Block(ScanDomainKind.Integrations),
                    flowLines,
                    Block(ScanDomainKind.DataQuality),
                    Block(ScanDomainKind.Security),
                    Block(ScanDomainKind.Operations),
                    Block(ScanDomainKind.Limitations),
                    includedFindings,
                    includedGaps,
                    evidence.Select(e => $"{e.Title} ({e.SourceType}, {e.Completeness}, {e.Source})").ToList()));
            }
            var version = $"scan-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}";
            var selectedIds = selected.Select(s => s.Id).ToHashSet();
            var relationships = i.IncludeDiagrams
                ? await db.Integrations.Where(x => x.ProjectId == project.Id && !x.Archived && selectedIds.Contains(x.SystemId)).ToListAsync()
                : [];
            var selectedNames = selected.SelectMany(s => new[] { s.Name, s.Acronym, s.CatalogKey }.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => (Key: v.Trim(), System: s)))
                .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase).ToDictionary(x => x.Key, x => x.First().System, StringComparer.OrdinalIgnoreCase);
            var relationshipLines = relationships.Where(x => selectedNames.ContainsKey(x.Target.Trim())).Select(x =>
            {
                var source = selected.First(s => s.Id == x.SystemId).Name;
                var target = selectedNames[x.Target.Trim()].Name;
                return $"{source} → {target}: {x.Name}; method {(string.IsNullOrWhiteSpace(x.Method) ? "not recorded" : x.Method)}; direction {x.Direction}; status {x.State}.";
            }).ToList();
            var requirementLines = i.IncludeRequirements
                ? await db.Requirements.Where(x => x.ProjectId == project.Id).OrderBy(x => x.Priority).ThenBy(x => x.Title)
                    .Select(x => new MarketScanDocument.RequirementLine(x.Title, x.Description, x.Type, x.Category, x.Priority.ToString(), x.Mandatory, x.AcceptanceCriteria)).ToListAsync()
                : [];
            var model = new MarketScanDocument.DocumentModel(
                $"{project.Name}",
                "Market scan",
                "1.0",
                version,
                DateTimeOffset.UtcNow,
                audience,
                i.StateScope ?? "Current",
                $"This market scan covers {selected.Count} system(s) in {project.Name}. Completeness and validation remain in progress where information gaps are listed. Unknown values are not treated as negative findings.",
                $"{project.Objective} Scope: {project.Scope} Exclusions: {project.Exclusions}",
                $"Landscape: water monitoring systems. Systems in this edition: {string.Join(", ", selected.Select(s => s.Acronym == "" ? s.Name : $"{s.Name} ({s.Acronym})"))}.",
                includeSecurity,
                i.IncludeGaps,
                warnings,
                sections,
                relationshipLines,
                requirementLines);
            var bytes = MarketScanDocument.Word(model);
            var primary = selected[0];
            var isPortfolio = selected.Count > 1;
            var documentKey = isPortfolio ? ScanWorkspace.Slug("", project.Name) : primary.CatalogKey;
            var previous = await db.GeneratedDocuments.Where(x => isPortfolio ? x.ProjectId == project.Id && x.AssessedSystemId == null : x.AssessedSystemId == primary.Id).ToListAsync();
            foreach (var old in previous.Where(x => x.Status == "Draft")) old.Status = "Superseded";
            var nextVersion = previous.Count + 1;
            var readinessScan = await db.ScanAssessments.FirstOrDefaultAsync(x => x.AssessedSystemId == primary.Id);
            var doc = new GeneratedDocument
            {
                ProjectId = project.Id,
                AssessedSystemId = isPortfolio ? null : primary.Id,
                CatalogKey = documentKey,
                Title = isPortfolio ? $"{project.Name} Technical Landscape Assessment" : $"{primary.Name} Current-State System Assessment",
                TemplateName = isPortfolio ? "Technical Landscape Assessment v1.0" : "Market Scan v1.0",
                TemplateVersion = "1.0",
                Audience = audience,
                StateScope = i.StateScope ?? "Current",
                AssessmentVersion = version,
                VersionLabel = $"v0.{nextVersion}",
                Format = string.Equals(i.Format, "PDF", StringComparison.OrdinalIgnoreCase) ? "PDF" : "Word",
                SnapshotJson = ScanWorkspace.Snapshot(new { project.Id, systems = selected.Select(s => s.Id), version, warnings }),
                FileBytes = bytes,
                FileName = $"{documentKey}-v0.{nextVersion}.docx",
                Status = "Draft",
                ApprovalState = "Not submitted",
                GeneratedBy = u.Identity?.Name ?? "Local Assessment Lead",
                IncludeDiagrams = i.IncludeDiagrams,
                IncludeFindings = i.IncludeFindings,
                IncludeGaps = i.IncludeGaps,
                IncludeSecurityAppendix = includeSecurity,
                Warnings = string.Join(" ", warnings),
                PageCount = 12,
                FileSizeBytes = bytes.Length,
                Readiness = readinessScan?.DocumentReadiness ?? 0,
                ChecksumSha256 = Convert.ToHexString(SHA256.HashData(bytes)),
                RecordId = $"DOC-{documentKey.ToUpperInvariant()}-0001",
                ActivityJson = JsonSerializer.Serialize(new[] { new { at = DateTimeOffset.UtcNow, text = $"v0.{nextVersion} generated from assessment snapshot" } }),
            };
            db.GeneratedDocuments.Add(doc);
            await audit.Record(db, u, "Generate", "GeneratedDocument", doc.Id, doc.Title, project.Id);
            await db.SaveChangesAsync();
            return Results.Created($"/api/documents/{doc.Id}", new { doc.Id, doc.Title, doc.FileName, doc.Warnings, doc.AssessmentVersion, doc.CreatedAt });
        });

        api.MapGet("/systems/{id:guid}/preview", async (Guid id, string? audience, bool includeSecurityAppendix, AppDbContext db) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == id).ToListAsync();
            var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == id).ToListAsync();
            var findings = await db.Findings.Where(x => x.SystemId == id).ToListAsync();
            var selectedAudience = string.IsNullOrWhiteSpace(audience) ? "Internal" : audience;
            var sections = ScanScoring.Weights.Select(w => new
            {
                kind = w.Kind.ToString(),
                w.Title,
                paragraphs = facts.Where(f => f.Domain == w.Kind && ScanNarrative.Visible(f, selectedAudience, includeSecurityAppendix)).Select(f => ScanNarrative.FactLine(f, selectedAudience)).ToList(),
            });
            return Results.Ok(new
            {
                system = system.Name,
                audience = selectedAudience,
                sections,
                findings = findings.Where(f => f.IncludeInDocument && f.ReviewState == ReviewState.Approved).Select(f => new { f.Title, f.Severity, f.Description }),
                gaps = gaps.Select(g => new { g.MissingInformation, g.Status, g.MarketScanImpact }),
                warnings = facts.Any(f => !ScanScoring.CountsAsValidated(f.Validation) && ScanScoring.IsFilled(f.Value))
                    ? new[] { "Unvalidated statements are labelled and must not be published as facts." }
                    : Array.Empty<string>(),
            });
        });
    }

    public static async Task<object> Dashboard(AppDbContext db, Guid? projectId = null)
    {
        var projects = await db.Projects.Where(x => !x.Archived).OrderByDescending(x => x.UpdatedAt).ToListAsync();
        var selected = projectId is { } requested ? projects.FirstOrDefault(x => x.Id == requested) : projects.FirstOrDefault(x => x.Status == ProjectStatus.Active) ?? projects.FirstOrDefault();
        var selectedId = selected?.Id;
        var scans = await db.ScanAssessments.Include(x => x.Domains).Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var systems = await db.Systems.Where(x => !x.Archived && (selectedId == null || x.ProjectId == selectedId)).ToListAsync();
        var gaps = await db.InformationGaps.Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var findings = await db.Findings.Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var actions = await db.Actions.Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var integrations = await db.Integrations.Where(x => !x.Archived && (selectedId == null || x.ProjectId == selectedId)).ToListAsync();
        var documents = await db.GeneratedDocuments.Where(x => selectedId == null || x.ProjectId == selectedId).OrderByDescending(x => x.CreatedAt).ToListAsync();
        var claims = await db.Claims.Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var evidence = await db.Evidence.Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var info = scans.Count == 0 ? 0 : (int)Math.Round(scans.Average(s => s.InformationCompleteness));
        var evidencedClaims = claims.Where(c => c.EvidenceId is Guid id && evidence.Any(e => e.Id == id && e.Validated)).ToList();
        var validation = claims.Count == 0 ? 0 : ScanScoring.Percent(evidencedClaims.Count(c => ScanScoring.CountsAsValidated(c.Validation)), claims.Count);
        var readiness = scans.Count == 0 ? 0 : (int)Math.Round(scans.Average(s => s.DocumentReadiness));
        var assessments = await db.Assessments.Include(x => x.Responses).Where(x => selectedId == null || x.ProjectId == selectedId).ToListAsync();
        var all = assessments.SelectMany(x => x.Responses).ToList();
        var done = all.Count(x => !string.IsNullOrWhiteSpace(x.Answer) || x.Status is ResponseStatus.Unknown or ResponseStatus.NotApplicable);
        var coverage = all.Count == 0 ? info : (int)Math.Round(done * 100d / all.Count);
        var systemByName = systems
            .SelectMany(s => new[] { s.Name, s.Acronym, s.CatalogKey }.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => (Key: x.Trim(), System: s)))
            .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().System, StringComparer.OrdinalIgnoreCase);
        var graphLinks = integrations.Select(i =>
        {
            var source = systems.FirstOrDefault(s => s.Id == i.SystemId);
            systemByName.TryGetValue(i.Target.Trim(), out var target);
            var status = ScanScoring.CountsAsValidated(i.Validation) ? "Confirmed"
                : i.State == InformationState.Future ? "Unknown"
                : i.Validation == ValidationStatus.Captured ? "Inferred"
                : "RequiresValidation";
            return new
            {
                id = i.Id.ToString(),
                sourceId = source?.CatalogKey ?? source?.Id.ToString() ?? i.SourceSystem,
                targetId = target?.CatalogKey ?? (string.IsNullOrWhiteSpace(i.Target) ? $"external-{i.Id:N}" : $"external-{ScanWorkspace.Slug("", i.Target)}"),
                sourceName = source?.Name ?? i.SourceSystem,
                targetName = target?.Name ?? i.Target,
                status,
            };
        }).Where(x => !string.IsNullOrWhiteSpace(x.sourceId) && !string.IsNullOrWhiteSpace(x.targetName)).ToList();
        var graphNodes = systems.Select(s => new
        {
            id = string.IsNullOrWhiteSpace(s.CatalogKey) ? s.Id.ToString() : s.CatalogKey,
            name = s.Name,
            catalogKey = s.CatalogKey,
            external = false,
            status = scans.Any(a => a.AssessedSystemId == s.Id && a.ValidationCompleteness > 0) ? "Confirmed" : "Inferred",
        }).Cast<object>().ToList();
        var openActions = actions.Where(a => a.Status != ActionStatus.Completed).OrderByDescending(a => a.Priority).ThenBy(a => a.DueDate).ToList();
        object? nextAction = openActions.FirstOrDefault() is { } action ? new
        {
            kind = "Action",
            action.Id,
            action.Title,
            action.Owner,
            action.DueDate,
            action.Priority,
            systemKey = systems.FirstOrDefault(s => s.Id == action.SystemId)?.CatalogKey ?? "",
        } : findings.Where(f => f.ReviewState != ReviewState.Approved).OrderByDescending(f => f.Severity).ThenBy(f => f.UpdatedAt).FirstOrDefault() is { } finding ? new
        {
            kind = "Finding",
            finding.Id,
            finding.Title,
            finding.Owner,
            DueDate = (DateOnly?)null,
            Priority = finding.Severity >= Severity.High ? Priority.Must : Priority.Should,
            systemKey = systems.FirstOrDefault(s => s.Id == finding.SystemId)?.CatalogKey ?? "",
        } : null;
        var domains = scans.SelectMany(s => s.Domains).ToList();
        var progress = new
        {
            total = domains.Count,
            confirmed = domains.Count(d => d.Completeness > 0 && d.LastValidatedAt != null),
            inferred = domains.Count(d => d.Completeness > 0 && d.LastValidatedAt == null),
            unvalidated = domains.Count(d => d.Completeness == 0 && d.EvidenceCount > 0),
            unknown = domains.Count(d => d.Completeness == 0 && d.EvidenceCount == 0),
        };
        var confidence = new
        {
            confirmed = claims.Count(c => ScanScoring.CountsAsValidated(c.Validation)),
            inferred = claims.Count(c => c.ClaimType == ClaimType.Inference && !ScanScoring.CountsAsValidated(c.Validation)),
            unvalidated = claims.Count(c => c.ClaimType != ClaimType.Unknown && !ScanScoring.CountsAsValidated(c.Validation) && c.ClaimType != ClaimType.Inference),
            unknown = claims.Count(c => c.ClaimType == ClaimType.Unknown),
        };
        return new
        {
            project = selected is null ? null : new { selected.Id, selected.Name, selected.Status, selected.TargetDate },
            projectOptions = projects.Select(p => new { p.Id, p.Name, p.Status }),
            projects = projects.Count,
            systems = systems.Count,
            coverage,
            highFindings = findings.Count(x => x.Severity >= Severity.High && x.ReviewState != ReviewState.Approved && !x.Archived),
            overdueActions = actions.Count(x => x.DueDate < DateOnly.FromDateTime(DateTime.UtcNow) && x.Status != ActionStatus.Completed),
            informationGaps = gaps.Count(g => !g.Archived && ScanScoring.IsOpenGap(g.Status)),
            requirements = await db.Requirements.CountAsync(x => selectedId == null || x.ProjectId == selectedId),
            informationCompleteness = info,
            validationCompleteness = validation,
            documentReadiness = readiness,
            documentsReady = scans.Count(s => s.DocumentReadiness >= 80),
            ownershipIncomplete = systems.Count(s => string.IsNullOrWhiteSpace(s.BusinessOwner) || string.IsNullOrWhiteSpace(s.TechnicalOwner)),
            overdueValidations = claims.Count(c => c.Validation is ValidationStatus.SmeReviewRequested or ValidationStatus.Captured),
            unsupportedTechnologies = await db.Components.CountAsync(x => x.SupportStatus.Contains("unsupported") || x.SupportStatus.Contains("end of")),
            integrationCount = integrations.Count,
            openHighFindings = findings.Count(x => x.Severity >= Severity.High && x.ReviewState != ReviewState.Approved),
            systemsByLifecycle = systems.GroupBy(s => s.Lifecycle).Select(g => new { status = g.Key, count = g.Count() }),
            systemsByHosting = (await db.ScanFacts.Where(f => f.Attribute == "Hosting model").ToListAsync()).GroupBy(f => string.IsNullOrWhiteSpace(f.Value) ? "Unknown" : f.Value).Select(g => new { hosting = g.Key, count = g.Count() }),
            recentlyValidated = claims.Where(c => ScanScoring.CountsAsValidated(c.Validation)).Take(5).Select(c => new { c.Id, c.Statement, c.Validation, c.UpdatedAt }),
            documents = documents.Take(5).Select(d => new { d.Id, d.Title, d.Audience, d.CreatedAt, d.Status }),
            activeProjects = projects.Count(x => x.Status == ProjectStatus.Active),
            relationshipGraph = new { nodes = graphNodes, links = graphLinks },
            nextRecommendedAction = nextAction,
            assessmentProgress = progress,
            evidenceConfidence = confidence,
        };
    }

    static AssessedSystem CopyMaster(Guid projectId, MasterSystem master) => new()
    {
        ProjectId = projectId,
        MasterSystemId = master.Id,
        CatalogKey = master.CatalogKey,
        Name = master.Name,
        Acronym = master.Acronym,
        Description = master.Description,
        BusinessPurpose = master.BusinessPurpose,
        BusinessCapabilities = master.BusinessCapabilities,
        BusinessOwner = master.BusinessOwner,
        TechnicalOwner = master.TechnicalOwner,
        SupportTeam = master.SupportTeam,
        UserGroups = master.UserGroups,
        UserCount = master.UserCount,
        AvailabilityExpectations = master.AvailabilityExpectations,
        Vendor = master.Vendor,
        Product = master.Product,
        StateClassification = master.StateClassification,
        Tags = master.Tags,
        EffectiveFrom = master.EffectiveFrom,
        EffectiveTo = master.EffectiveTo,
        DataClassification = master.DataClassification,
        Criticality = master.Criticality,
        Lifecycle = master.LifecycleStatus,
    };

    static void MapRegister<T, TInput>(RouteGroupBuilder api, string path, Func<AppDbContext, DbSet<T>> set, Func<AssessedSystem, TInput, T> create, Action<T, TInput> apply)
        where T : Record
    {
        api.MapGet($"/systems/{{id:guid}}{path}", async (Guid id, AppDbContext db) => await set(db).Where(x => EF.Property<Guid>(x, "AssessedSystemId") == id && !x.Archived).ToListAsync());
        api.MapPost($"/systems/{{id:guid}}{path}", async (Guid id, TInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var system = await db.Systems.FindAsync(id);
            if (system is null) return Results.NotFound();
            var item = create(system, i);
            set(db).Add(item);
            await audit.Record(db, u, "Create", typeof(T).Name, item.Id, typeof(T).Name, system.ProjectId);
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, id);
            return Results.Created($"/api{path}/{item.Id}", item);
        });
        api.MapPut($"{path}/{{id:guid}}", async (Guid id, TInput i, AppDbContext db, AuditService audit, ClaimsPrincipal u) =>
        {
            var item = await set(db).FindAsync(id);
            if (item is null) return Results.NotFound();
            apply(item, i);
            await audit.Record(db, u, "Update", typeof(T).Name, item.Id, typeof(T).Name, EF.Property<Guid?>(item, "ProjectId"));
            await db.SaveChangesAsync();
            await ScanWorkspace.Recalculate(db, EF.Property<Guid>(item, "AssessedSystemId"));
            return Results.Ok(item);
        });
    }

    static void MapSimple<T, TInput>(RouteGroupBuilder api, string path, Func<AppDbContext, DbSet<T>> set, Func<AssessedSystem, TInput, T> create, Func<T, TInput, T> apply)
        where T : Record => MapRegister(api, path, set, create, (item, i) => apply(item, i));

    static SystemDatabase ApplyDatabase(SystemDatabase item, DatabaseInput i)
    {
        item.Product = i.Product; item.Edition = i.Edition; item.Version = i.Version; item.DatabaseName = i.DatabaseName; item.InstanceName = i.InstanceName;
        item.HostingLocation = i.HostingLocation; item.OperatingSystem = i.OperatingSystem; item.Schemas = i.Schemas; item.SharedOrDedicated = i.SharedOrDedicated;
        item.ApproximateSize = i.ApproximateSize; item.AnnualGrowth = i.AnnualGrowth; item.MajorTableCount = i.MajorTableCount; item.StoredProcedures = i.StoredProcedures;
        item.Triggers = i.Triggers; item.DatabaseLinks = i.DatabaseLinks; item.ScheduledJobs = i.ScheduledJobs; item.HighAvailability = i.HighAvailability;
        item.BackupArrangement = i.BackupArrangement; item.RecoveryObjectives = i.RecoveryObjectives; item.EncryptionAtRest = i.EncryptionAtRest;
        item.EncryptionInTransit = i.EncryptionInTransit; item.VendorSupportStatus = i.VendorSupportStatus; item.PerformanceIssues = i.PerformanceIssues;
        item.TechnicalDebt = i.TechnicalDebt; item.Owner = i.Owner; item.SupportTeam = i.SupportTeam; item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; item.State = i.State;
        return item;
    }
    static InfrastructureAsset ApplyInfra(InfrastructureAsset item, InfraInput i)
    {
        item.Name = i.Name; item.AssetType = i.AssetType; item.HostingModel = i.HostingModel; item.Location = i.Location; item.OperatingSystem = i.OperatingSystem;
        item.EnvironmentName = i.EnvironmentName; item.NetworkZone = i.NetworkZone; item.Purpose = i.Purpose; item.Owner = i.Owner; item.EndOfLife = i.EndOfLife;
        item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; item.State = i.State; return item;
    }
    static DataFlow ApplyFlow(DataFlow item, FlowInput i)
    {
        item.Source = i.Source; item.Destination = i.Destination; item.DataSet = i.DataSet; item.BusinessPurpose = i.BusinessPurpose; item.Direction = i.Direction;
        item.Transformation = i.Transformation; item.StoragePoints = i.StoragePoints; item.Frequency = i.Frequency; item.SecurityClassification = i.SecurityClassification;
        item.Owner = i.Owner; item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; item.State = i.State; return item;
    }
    static BatchProcess ApplyBatch(BatchProcess item, BatchInput i)
    {
        item.Name = i.Name; item.Purpose = i.Purpose; item.Schedule = i.Schedule; item.Timezone = i.Timezone; item.UpstreamDependency = i.UpstreamDependency;
        item.DownstreamDependency = i.DownstreamDependency; item.Input = i.Input; item.Output = i.Output; item.RuntimeTechnology = i.RuntimeTechnology;
        item.TypicalDuration = i.TypicalDuration; item.FailureBehaviour = i.FailureBehaviour; item.RetryProcess = i.RetryProcess; item.Monitoring = i.Monitoring;
        item.OperationalOwner = i.OperationalOwner; item.Criticality = i.Criticality; item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; item.State = i.State; return item;
    }
    static DataDomainRecord ApplyData(DataDomainRecord item, DataDomainInput i)
    {
        item.Name = i.Name; item.BusinessDescription = i.BusinessDescription; item.AuthoritativeSystem = i.AuthoritativeSystem; item.PrincipalEntities = i.PrincipalEntities;
        item.ApproximateVolume = i.ApproximateVolume; item.HistoricalDepth = i.HistoricalDepth; item.Classification = i.Classification; item.RetentionRequirement = i.RetentionRequirement;
        item.DataOwner = i.DataOwner; item.DownstreamConsumers = i.DownstreamConsumers; item.MigrationRequirement = i.MigrationRequirement;
        item.Completeness = i.Completeness; item.Accuracy = i.Accuracy; item.Consistency = i.Consistency; item.Validity = i.Validity; item.Timeliness = i.Timeliness;
        item.Uniqueness = i.Uniqueness; item.ReferentialIntegrity = i.ReferentialIntegrity; item.KnownDuplicates = i.KnownDuplicates; item.MissingMandatoryValues = i.MissingMandatoryValues;
        item.InvalidCodes = i.InvalidCodes; item.OrphanedRecords = i.OrphanedRecords; item.ManualCorrectionProcess = i.ManualCorrectionProcess;
        item.ReconciliationProcess = i.ReconciliationProcess; item.QualityOwner = i.QualityOwner; item.Validation = i.Validation; return item;
    }
    static SecurityControl ApplySecurity(SecurityControl item, SecurityInput i)
    {
        item.Name = i.Name; item.Area = i.Area; item.Description = i.Description; item.Status = i.Status; item.Visibility = i.Visibility;
        item.EvidenceId = i.EvidenceId; item.Validation = i.Validation; return item;
    }
    static void ApplyIntegration(Integration item, IntegrationScanInput i)
    {
        item.Name = i.Name; item.SourceSystem = i.SourceSystem; item.Target = i.Target; item.BusinessPurpose = i.BusinessPurpose; item.Direction = i.Direction;
        item.InformationExchanged = i.InformationExchanged; item.State = i.State; item.InterfaceType = i.InterfaceType; item.Method = i.Method; item.Technology = i.Technology;
        item.Frequency = i.Frequency; item.Trigger = i.Trigger; item.Volume = i.Volume; item.Authentication = i.Authentication; item.Encryption = i.Encryption;
        item.Transformation = i.Transformation; item.ErrorHandling = i.ErrorHandling; item.RetryMechanism = i.RetryMechanism; item.Owner = i.Owner; item.Monitoring = i.Monitoring;
        item.Criticality = i.Criticality; item.ReplacementImpact = i.ReplacementImpact; item.EvidenceId = i.EvidenceId; item.Validation = i.Validation;
    }
}

public record MasterSystemInput(string Name, string? Acronym, string? CatalogKey, string? Description, string? BusinessPurpose, string? BusinessCapabilities, string? BusinessOwner, string? TechnicalOwner, string? SupportTeam, string? UserGroups, int? UserCount, Criticality Criticality, string? AvailabilityExpectations, string? LifecycleStatus, string? Vendor, string? Product, StateClassification StateClassification, string? Tags, string? DataClassification);
public record ScopeInput(Guid MasterSystemId);
public record ScanUpdateInput(string? BusinessOwner, string? TechnicalOwner, string? BusinessPurpose, string? Description, string? SupportTeam, string? Lifecycle, string? Vendor, string? Product, string? Tags, string? DataClassification, string? AssessmentLead, string? Assessor, bool? IncludeInRfi, bool? IncludeInDocument, AssessmentStatus? Status);
public record DomainUpdateInput(DomainRequirement? Requirement, string? Summary);
public record FactInput(ScanDomainKind Domain, string Attribute, string? Value, ValidationStatus Validation, ClaimType ClaimType, string? Confidence, Guid? EvidenceId, string? EvidenceExcerpt, string? SourceLocation, VisibilityClass Visibility, InformationState State, string? ChangeReason, string? Speaker);
public record ClaimValidationInput(string Action, string? Comment, string? CorrectedStatement);
public record ComponentInput(string Name, string ComponentType, string Technology, string Version, string Purpose, string EnvironmentName, string Owner, string LifecycleStatus, string SupportStatus, Guid? EvidenceId, ValidationStatus Validation, InformationState State);
public record DatabaseInput(string Product, string Edition, string Version, string DatabaseName, string InstanceName, string HostingLocation, string OperatingSystem, string Schemas, string SharedOrDedicated, string ApproximateSize, string AnnualGrowth, int? MajorTableCount, string StoredProcedures, string Triggers, string DatabaseLinks, string ScheduledJobs, string HighAvailability, string BackupArrangement, string RecoveryObjectives, string EncryptionAtRest, string EncryptionInTransit, string VendorSupportStatus, string PerformanceIssues, string TechnicalDebt, string Owner, string SupportTeam, Guid? EvidenceId, ValidationStatus Validation, InformationState State);
public record InfraInput(string Name, string AssetType, string HostingModel, string Location, string OperatingSystem, string EnvironmentName, string NetworkZone, string Purpose, string Owner, bool EndOfLife, Guid? EvidenceId, ValidationStatus Validation, InformationState State);
public record FlowInput(string Source, string Destination, string DataSet, string BusinessPurpose, string Direction, string Transformation, string StoragePoints, string Frequency, string SecurityClassification, string Owner, Guid? EvidenceId, ValidationStatus Validation, InformationState State);
public record BatchInput(string Name, string Purpose, string Schedule, string Timezone, string UpstreamDependency, string DownstreamDependency, string Input, string Output, string RuntimeTechnology, string TypicalDuration, string FailureBehaviour, string RetryProcess, string Monitoring, string OperationalOwner, string Criticality, Guid? EvidenceId, ValidationStatus Validation, InformationState State);
public record DataDomainInput(string Name, string BusinessDescription, string AuthoritativeSystem, string PrincipalEntities, string ApproximateVolume, string HistoricalDepth, string Classification, string RetentionRequirement, string DataOwner, string DownstreamConsumers, string MigrationRequirement, QualityRating Completeness, QualityRating Accuracy, QualityRating Consistency, QualityRating Validity, QualityRating Timeliness, QualityRating Uniqueness, QualityRating ReferentialIntegrity, string KnownDuplicates, string MissingMandatoryValues, string InvalidCodes, string OrphanedRecords, string ManualCorrectionProcess, string ReconciliationProcess, string QualityOwner, ValidationStatus Validation);
public record SecurityInput(string Name, string Area, string Description, string Status, VisibilityClass Visibility, Guid? EvidenceId, ValidationStatus Validation);
public record GapInput(ScanDomainKind Domain, string MissingInformation, string? ReasonRequired, Priority Priority, string? MarketScanImpact, string? AssignedOwner, DateOnly? DueDate, GapStatus Status, string? Resolution, Guid? EvidenceId);
public record IntegrationScanInput(string Name, string SourceSystem, string Target, string BusinessPurpose, string Direction, string InformationExchanged, InformationState State, string InterfaceType, string Method, string Technology, string Frequency, string Trigger, string Volume, string Authentication, string Encryption, string Transformation, string ErrorHandling, string RetryMechanism, string Owner, string Monitoring, string Criticality, string ReplacementImpact, Guid? EvidenceId, ValidationStatus Validation);
public record DocumentInput(Guid ProjectId, List<Guid> SystemIds, string? Audience, string? StateScope, bool IncludeDiagrams, bool IncludeFindings, bool IncludeGaps, bool IncludeSecurityAppendix, string? Format=null, bool IncludeRequirements=true);
public record AnalyseInput(string Title, string Url, string? Source, string? SourceType, string? Completeness, string? Reliability, string? Confidentiality, string? Participants, string? Description, string? EvidenceDate, bool ExtractTechnologies, bool ExtractIntegrations, bool ExtractFindings, bool ExtractGaps, bool ExtractClaims, bool AutoValidate);
