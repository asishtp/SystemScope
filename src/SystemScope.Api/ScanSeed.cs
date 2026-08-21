using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class MarketScanSeed
{
    public const string ProjectName = "Water Monitoring Systems Market Scan 2026";

    public static async Task Apply(AppDbContext db)
    {
        var existing = await db.Projects.FirstOrDefaultAsync(x => x.Name == ProjectName);
        if (existing is not null)
        {
            if (await db.GeneratedDocuments.AnyAsync(x => x.ProjectId == existing.Id && x.RecordId == "DOC-AQUIS-0001"))
                return;
            await RemoveIncomplete(db, existing.Id);
        }

        var project = new Project
        {
            Name = ProjectName,
            Objective = "Produce an evidence-backed market-scan and RFI pack for water monitoring systems, starting with AQUIS and related groundwater and telemetry applications.",
            Scope = "Current-state architecture, database, infrastructure, integrations, data quality and market-scan-level security for seven in-scope systems.",
            Exclusions = "Replacement-product scoring, supplier portals, automated source-code reverse engineering and detailed penetration testing.",
            Stakeholders = "Assessment lead Asish Punnose; technical owner Anthony McLoughlin; water monitoring SMEs.",
            Owner = "Asish Punnose",
            StartDate = new DateOnly(2026, 8, 1),
            TargetDate = new DateOnly(2026, 11, 30),
            Status = ProjectStatus.Active,
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var specs = new (string Key, string Name, string Acronym, string Description, string Purpose, string Capabilities, string BusinessOwner, string TechnicalOwner, Criticality Crit, string Lifecycle, string Vendor, string Product, string Tags)[]
        {
            ("aquis", "AQUIS", "AQUIS", "AQUIS is an internal legacy application supporting Water Monitoring Systems. Available evidence confirms an Oracle Forms front end and suggests an Oracle Database. Detailed architecture, database configuration, hosting arrangements and system relationships require further validation.", "Water monitoring operational support. Business functions require SME confirmation.", "Groundwater-related operational records; relationship with Groundwater and drill-log processes requires clarification.", "To be confirmed", "Anthony McLoughlin", Criticality.Moderate, "Legacy / Maintain", "Oracle", "Oracle Forms application", "Oracle Forms"),
            ("gwdb", "Groundwater", "GWDB", "Groundwater application using an Oracle Forms front end with GWPlot and the Drill Log Receival and Notification system.", "Authoritative groundwater bore, water-level and drill-log records.", "Bores, water levels, water quality, drill logs, GWPlot.", "Groundwater", "Digital and ICT", Criticality.Critical, "Active", "Oracle", "Oracle Forms / Oracle Database", "Oracle Forms, GWPlot, Drill Log"),
            ("hydstra", "Water Monitoring Information System — Hydstra", "WMS-Hydstra", "Time-series data management system with Hydrotel for gauge collection and distribution.", "Statewide time-series water monitoring.", "Gauge reads, time-series, Hydrotel collection.", "Water monitoring", "Digital and ICT", Criticality.Critical, "Active", "Kisters", "Hydstra / Hydrotel", "Hydstra, Hydrotel, Time-series DB"),
            ("wfieldapp", "Water Monitoring Field Application", "WFieldApp", "Mobile field application returning groundwater sample metadata and results.", "Field capture for water monitoring samples.", "Sample metadata, field capture.", "Water monitoring", "Digital and ICT", Criticality.High, "Active", "", "Mobile field application", "Mobile App"),
            ("wasp", "Water Analysis Sample Program", "WASP", "Water analysis sample program supporting Power BI dashboards and feeding Hydstra and DES storage.", "Laboratory and sample program coordination.", "H2O samples, dashboards.", "Water monitoring", "Digital and ICT", Criticality.High, "Active", "", "Sample program", "Power BI, Hydstra, DES Storage"),
            ("gauges", "Water Gauges & Ground Stations", "Gauges", "Statewide gauge and station network providing time-series water and rainfall observations.", "Source network for hydrometric observations.", "Surface water, groundwater stations, rainfall.", "Water monitoring", "Digital and ICT", Criticality.Critical, "Active", "", "Gauge network", "Time-series Network"),
            ("bls", "Bore Location System", "BLS", "Bore location register sharing data with SIR, OGIA and the groundwater database.", "Authoritative bore location register.", "Bore locations.", "Groundwater", "Digital and ICT", Criticality.High, "Active", "", "Bore register", "SIR, OGIA, Groundwater DB, Spatial"),
        };

        var systems = new Dictionary<string, AssessedSystem>();
        foreach (var spec in specs)
        {
            var master = new MasterSystem
            {
                Name = spec.Name,
                Acronym = spec.Acronym,
                CatalogKey = spec.Key,
                Description = spec.Description,
                BusinessPurpose = spec.Purpose,
                BusinessCapabilities = spec.Capabilities,
                BusinessOwner = spec.BusinessOwner,
                TechnicalOwner = spec.TechnicalOwner,
                SupportTeam = spec.Key == "aquis" ? "To be confirmed" : "Internal ICT / vendor",
                Criticality = spec.Crit,
                LifecycleStatus = spec.Lifecycle,
                Vendor = spec.Vendor,
                Product = spec.Product,
                StateClassification = StateClassification.Current,
                Tags = spec.Tags,
                DataClassification = "OFFICIAL",
                EffectiveFrom = new DateOnly(2026, 8, 1),
            };
            db.MasterSystems.Add(master);
            var assessed = new AssessedSystem
            {
                ProjectId = project.Id,
                MasterSystem = master,
                CatalogKey = spec.Key,
                Name = spec.Name,
                Acronym = spec.Acronym,
                Description = spec.Description,
                BusinessPurpose = spec.Purpose,
                BusinessCapabilities = spec.Capabilities,
                BusinessOwner = spec.BusinessOwner,
                TechnicalOwner = spec.TechnicalOwner,
                SupportTeam = master.SupportTeam,
                Criticality = spec.Crit,
                Lifecycle = spec.Lifecycle,
                Vendor = spec.Vendor,
                Product = spec.Product,
                Tags = spec.Tags,
                DataClassification = "OFFICIAL",
                StateClassification = StateClassification.Current,
            };
            db.Systems.Add(assessed);
            systems[spec.Key] = assessed;
        }
        await db.SaveChangesAsync();

        foreach (var assessed in systems.Values)
        {
            var scan = new ScanAssessment
            {
                ProjectId = project.Id,
                AssessedSystemId = assessed.Id,
                MasterSystemId = assessed.MasterSystemId!.Value,
                Status = AssessmentStatus.InProgress,
                IncludeInRfi = true,
                IncludeInDocument = true,
                AssessmentLead = "Asish Punnose",
                Assessor = assessed.CatalogKey == "aquis" ? "Anthony McLoughlin" : "",
                Reviewer = "Asish Punnose",
            };
            foreach (var (kind, _, _) in ScanScoring.Weights)
            {
                var requirement = assessed.CatalogKey == "aquis" && kind == ScanDomainKind.Security
                    ? DomainRequirement.Deferred
                    : DomainRequirement.Required;
                var summary = (assessed.CatalogKey, kind) switch
                {
                    ("aquis", ScanDomainKind.Architecture) => "AQUIS is an internal legacy application using an Oracle Forms front end. Its detailed component architecture and relationship with the Groundwater application require further validation.",
                    ("aquis", ScanDomainKind.Database) => "AQUIS is understood to use an Oracle database. The database version, edition, schema ownership and any shared dependencies require technical confirmation.",
                    ("aquis", ScanDomainKind.Infrastructure) => "The hosting model and environment topology for AQUIS have not yet been confirmed. Application, database, network and disaster recovery arrangements require infrastructure-team validation.",
                    ("aquis", ScanDomainKind.Integrations) => "No confirmed AQUIS integrations have yet been documented. Potential relationships with Groundwater and public water-monitoring services require SME and technical validation.",
                    ("aquis", ScanDomainKind.DataQuality) => "No AQUIS data domains or quality assessments have yet been validated. The principal records, ownership, historical depth and migration considerations require further discovery.",
                    ("aquis", ScanDomainKind.Security) => "Detailed security assessment is deferred for the current market-scan scope. High-level identity, access, data protection and compliance information may still be recorded when evidence becomes available.",
                    ("aquis", ScanDomainKind.Operations) => "Release, support, patching and operational procedures for AQUIS have not been confirmed. Support hours, monitoring and escalation paths require operational-owner validation.",
                    ("aquis", ScanDomainKind.Limitations) => "AQUIS is a legacy Oracle Forms client/server application. Vendor support status, key-person dependency and replacement constraints remain to be confirmed.",
                    _ => "",
                };
                scan.Domains.Add(new ScanDomainState { Kind = kind, Requirement = requirement, Summary = summary });
            }
            db.ScanAssessments.Add(scan);
        }
        await db.SaveChangesAsync();

        var aquis = systems["aquis"];
        var gwdb = systems["gwdb"];
        SeedAquis(db, project, aquis, gwdb);
        SeedSiblingFacts(db, project, systems);
        await db.SaveChangesAsync();
        foreach (var system in systems.Values) await ScanWorkspace.Recalculate(db, system.Id);
        SeedWorkflow(db, project, aquis);

        db.AuditEvents.AddRange(
            new AuditEvent { ProjectId = project.Id, ActorId = "seed", ActorName = "Asish Punnose", Action = "Publish", EntityType = "GeneratedDocument", EntityId = aquis.Id, Detail = "Assessment document v1.0 published", Timestamp = new DateTimeOffset(2026, 8, 20, 7, 31, 0, TimeSpan.FromHours(10)) },
            new AuditEvent { ProjectId = project.Id, ActorId = "seed", ActorName = "Michael", Action = "Approve", EntityType = "GeneratedDocument", EntityId = aquis.Id, Detail = "Document approved by Michael", Timestamp = new DateTimeOffset(2026, 8, 20, 7, 26, 0, TimeSpan.FromHours(10)) },
            new AuditEvent { ProjectId = project.Id, ActorId = "seed", ActorName = "Anthony McLoughlin", Action = "Validate", EntityType = "ValidationRequest", EntityId = aquis.Id, Detail = "SME validation applied", Timestamp = new DateTimeOffset(2026, 8, 20, 6, 42, 0, TimeSpan.FromHours(10)) },
            new AuditEvent { ProjectId = project.Id, ActorId = "seed", ActorName = "Asish Punnose", Action = "Create", EntityType = "Evidence", EntityId = aquis.Id, Detail = "Walkthrough evidence added", Timestamp = new DateTimeOffset(2026, 8, 20, 4, 5, 0, TimeSpan.FromHours(10)) },
            new AuditEvent { ProjectId = project.Id, ActorId = "seed", ActorName = "SystemScope", Action = "Create", EntityType = "Project", EntityId = project.Id, Detail = "Seeded Water Monitoring Systems Market Scan 2026 with AQUIS example assessment" });
        await db.SaveChangesAsync();
    }

    static async Task RemoveIncomplete(AppDbContext db, Guid projectId)
    {
        await db.ValidationItems.Where(x => db.ValidationRequests.Any(r => r.ProjectId == projectId && r.Id == x.ValidationRequestId)).ExecuteDeleteAsync();
        await db.ValidationRequests.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.DocumentComments.Where(x => db.GeneratedDocuments.Any(d => d.ProjectId == projectId && d.Id == x.GeneratedDocumentId)).ExecuteDeleteAsync();
        await db.GeneratedDocuments.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Claims.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.InformationGaps.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.ScanFacts.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.ScanDomains.Where(x => db.ScanAssessments.Any(s => s.ProjectId == projectId && s.Id == x.ScanAssessmentId)).ExecuteDeleteAsync();
        await db.ScanAssessments.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Components.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.SystemDatabases.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.InfrastructureAssets.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.DataFlows.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.BatchProcesses.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.DataDomains.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.SecurityControls.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Integrations.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Findings.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Actions.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.Evidence.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.AuditEvents.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        var masterIds = await db.Systems.Where(x => x.ProjectId == projectId && x.MasterSystemId != null).Select(x => x.MasterSystemId!.Value).Distinct().ToListAsync();
        await db.Systems.Where(x => x.ProjectId == projectId).ExecuteDeleteAsync();
        await db.MasterSystems.Where(m => masterIds.Contains(m.Id) && !m.ProjectSystems.Any()).ExecuteDeleteAsync();
        await db.Projects.Where(x => x.Id == projectId).ExecuteDeleteAsync();
    }

    static void SeedAquis(AppDbContext db, Project project, AssessedSystem aquis, AssessedSystem gwdb)
    {
        var transcript = new Evidence
        {
            ProjectId = project.Id,
            SystemId = aquis.Id,
            Title = "AQUIS walkthrough transcript",
            Url = "https://department.sharepoint.com/sites/systemscope/evidence/aquis-walkthrough",
            Source = "SME walkthrough of Oracle Forms",
            SourceType = "Meeting transcript",
            Classification = "OFFICIAL",
            Validated = false,
            Completeness = "Incomplete",
            Reliability = "Medium",
            Confidentiality = "Internal",
            ProcessingStatus = "Registered",
            Participants = "Anthony McLoughlin; Asish Punnose",
            EvidenceDate = new DateOnly(2026, 8, 20),
        };
        var notes = new Evidence
        {
            ProjectId = project.Id,
            SystemId = aquis.Id,
            Title = "AQUIS architecture notes",
            Url = "https://department.sharepoint.com/sites/systemscope/evidence/aquis-architecture-notes",
            Source = "Existing assessment",
            SourceType = "Architecture document",
            Classification = "OFFICIAL",
            Completeness = "Partial",
            Reliability = "Medium",
            Confidentiality = "Internal",
            ProcessingStatus = "Registered",
            EvidenceDate = new DateOnly(2026, 8, 15),
        };
        Evidence Extra(string title, string type, string completeness) => new()
        {
            ProjectId = project.Id,
            SystemId = aquis.Id,
            Title = title,
            Url = "https://department.sharepoint.com/sites/systemscope/evidence/" + ScanWorkspace.Slug("", title),
            Source = "Discovery register",
            SourceType = type,
            Classification = "OFFICIAL",
            Completeness = completeness,
            Reliability = "Medium",
            Confidentiality = "Internal",
            ProcessingStatus = "Registered",
            EvidenceDate = new DateOnly(2026, 8, 18),
        };
        db.Evidence.AddRange(
            transcript,
            notes,
            Extra("AQUIS Oracle Forms module list (partial)", "Screenshot", "Partial"),
            Extra("AQUIS Oracle Forms walkthrough notes", "Walkthrough notes", "Partial"),
            Extra("AQUIS login screen capture", "Screenshot", "Complete"),
            Extra("Existing AQUIS support notes", "Existing assessments", "Partial"),
            Extra("Interface conversation extract", "Email", "Partial"),
            Extra("AQUIS hosting questionnaire (blank)", "Walkthrough notes", "Incomplete"),
            Extra("Anthony McLoughlin statement", "SME interview", "High confidence"),
            Extra("Oracle Forms observation", "Screenshot", "Indirect evidence"),
            Extra("Database hosting assumption", "Existing assessments", "Indirect evidence"),
            Extra("Drill log discussion", "Email", "Future-state evidence"));

        Fact(db, project, aquis, ScanDomainKind.Architecture, "Front-end technology", "Oracle Forms", ValidationStatus.SmeValidated, ClaimType.ExplicitStatement, "High", transcript, "AQUIS walkthrough transcript at 00:23", "00:23");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Architecture style", "Legacy client/server", ValidationStatus.AnalystReviewed, ClaimType.Inference, "Medium", notes, "Described as an internal legacy application.", "Architecture notes");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Back-end technology", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Application server", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Reporting technology", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", notes, "", "");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Deployment model", "Not identified in available evidence", ValidationStatus.Captured, ClaimType.Unknown, "Low", notes, "", "");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Authentication mechanism", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Database product", "Oracle Database", ValidationStatus.Captured, ClaimType.Inference, "Medium", transcript, "Inferred from Oracle Forms front end; evidence required.", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Version", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Edition", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Hosting location", "On-premises", ValidationStatus.SmeReviewRequested, ClaimType.Inference, "Low", notes, "Hosting model assumed on-premises pending confirmation.", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Instance name", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Approximate size", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Hosting model", "On-premises", ValidationStatus.SmeReviewRequested, ClaimType.Inference, "Low", notes, "Assumed on-premises; location unconfirmed.", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Hosting location", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Application servers", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Network zones", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Infrastructure owner", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Release process", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Support model", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Support hours", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Patching process", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Monitoring", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Operations, "Escalation path", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Known limitations", "Legacy Oracle Forms client/server", ValidationStatus.AnalystReviewed, ClaimType.Inference, "Medium", notes, "Described as an internal legacy application.", "Architecture notes");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Technical debt", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Vendor support status", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Key-person dependency", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Legacy dependencies", "Oracle Forms; inferred Oracle Database", ValidationStatus.AnalystReviewed, ClaimType.Inference, "Medium", transcript, "Inferred from Oracle Forms front end.", "00:23");
        Fact(db, project, aquis, ScanDomainKind.Limitations, "Replacement constraints", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "End-of-life infrastructure", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Application delivery", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "External support", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Monitoring and logging", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Availability arrangement", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "Backup and recovery", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Infrastructure, "RTO", "Not documented", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Scheduled jobs", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "High availability", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Backup arrangement", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Database, "Recovery objectives", "Not documented", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Authentication", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Identity provider", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Single sign-on", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Multi-factor authentication", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Role-based access", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Privileged access", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Encryption at rest", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Encryption in transit", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Security, "Audit logging", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.DataQuality, "Historical depth", "Unknown", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.DataQuality, "Retention", "To be confirmed", ValidationStatus.Captured, ClaimType.Unknown, "Low", null, "", "");
        Fact(db, project, aquis, ScanDomainKind.Integrations, "Current-state catalogue", "Unconfirmed relationships only", ValidationStatus.SmeReviewRequested, ClaimType.Unknown, "Low", transcript, "No confirmed current-state interfaces.", "");
        Fact(db, project, aquis, ScanDomainKind.Integrations, "Related system", "Groundwater", ValidationStatus.SmeReviewRequested, ClaimType.Unknown, "Low", transcript, "Relationship with the Groundwater application requires clarification.", "");
        Fact(db, project, aquis, ScanDomainKind.Integrations, "Drill-log relationship", "Possible", ValidationStatus.SmeReviewRequested, ClaimType.Assumption, "Low", transcript, "Possible drill-log relationship; requires clarification.", "");
        Fact(db, project, aquis, ScanDomainKind.Architecture, "External portal", "Future-state requirement", ValidationStatus.AnalystReviewed, ClaimType.Assumption, "Medium", null, "Not a current-state fact.", "", InformationState.Future);
        Fact(db, project, aquis, ScanDomainKind.Architecture, "Internal reviewer application", "Future-state requirement", ValidationStatus.AnalystReviewed, ClaimType.Assumption, "Medium", null, "Not a current-state fact.", "", InformationState.Future);

        db.Components.AddRange(
            new ApplicationComponent
            {
                ProjectId = project.Id,
                AssessedSystemId = aquis.Id,
                Name = "AQUIS Forms",
                ComponentType = "User interface",
                Technology = "Oracle Forms",
                Version = "Unknown",
                Purpose = "Primary user interface. Modules in use require SME confirmation.",
                EnvironmentName = "Unknown",
                Owner = "Anthony McLoughlin",
                LifecycleStatus = "In use",
                EvidenceId = transcript.Id,
                Validation = ValidationStatus.AnalystReviewed,
            },
            new ApplicationComponent
            {
                ProjectId = project.Id,
                AssessedSystemId = aquis.Id,
                Name = "AQUIS Database",
                ComponentType = "Database",
                Technology = "Oracle",
                Version = "Unknown",
                Purpose = "Inferred supporting database.",
                LifecycleStatus = "Inferred",
                Validation = ValidationStatus.Captured,
                State = InformationState.Suspected,
            });
        db.SystemDatabases.AddRange(
            new SystemDatabase { ProjectId = project.Id, AssessedSystemId = aquis.Id, Product = "AQUIS", DatabaseName = "Application schema", Schemas = "Core application data", Owner = "Unknown", Validation = ValidationStatus.Captured },
            new SystemDatabase { ProjectId = project.Id, AssessedSystemId = aquis.Id, Product = "PL/SQL packages", DatabaseName = "Business logic", Schemas = "Rules and processing", Owner = "Unknown", Validation = ValidationStatus.SmeReviewRequested },
            new SystemDatabase { ProjectId = project.Id, AssessedSystemId = aquis.Id, Product = "Database links", DatabaseName = "Integration", Schemas = "External dependencies", Owner = "Unknown", Validation = ValidationStatus.Captured });
        db.DataDomains.AddRange(
            new DataDomainRecord { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Monitoring locations", BusinessDescription = "Sites and station metadata", AuthoritativeSystem = "To confirm", DataOwner = "Unknown", ApproximateVolume = "Unknown", Completeness = QualityRating.NotAssessed },
            new DataDomainRecord { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Measurements", BusinessDescription = "Water monitoring observations", AuthoritativeSystem = "To confirm", DataOwner = "Unknown", ApproximateVolume = "Unknown", Completeness = QualityRating.Unknown },
            new DataDomainRecord { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Samples and results", BusinessDescription = "Field and laboratory data", AuthoritativeSystem = "Unknown", DataOwner = "Unknown", ApproximateVolume = "Unknown", Completeness = QualityRating.NotAssessed },
            new DataDomainRecord { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Quality codes", BusinessDescription = "Validation and publication status", AuthoritativeSystem = "Unknown", DataOwner = "Unknown", ApproximateVolume = "Unknown", Completeness = QualityRating.NotAssessed });
        db.SecurityControls.AddRange(
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Encryption at rest", Area = "Data protection", Description = "Unknown", Status = "Not assessed", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Encryption in transit", Area = "Data protection", Description = "Unknown", Status = "Not assessed", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Audit logging", Area = "Data protection", Description = "To be confirmed", Status = "Information gap", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Patch management", Area = "Data protection", Description = "Unknown", Status = "Not assessed", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Backup protection", Area = "Data protection", Description = "Unknown", Status = "Not assessed", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Information Privacy Act 2009 (Qld)", Area = "Compliance", Description = "Applicability to confirm", Status = "To confirm", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Public Records Act 2023 (Qld)", Area = "Compliance", Description = "Applicability to confirm", Status = "To confirm", Visibility = VisibilityClass.Internal },
            new SecurityControl { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Queensland Government IS18", Area = "Compliance", Description = "Applicability to confirm", Status = "To confirm", Visibility = VisibilityClass.Internal });
        db.Integrations.AddRange(
            new Integration
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Name = "AQUIS to Groundwater",
                SourceSystem = "AQUIS",
                Target = "Groundwater",
                BusinessPurpose = "AQUIS was described as similar to the Groundwater application; the technical dependency remains unconfirmed. Oracle Forms pattern.",
                Direction = "Unknown",
                InformationExchanged = "Unknown",
                State = InformationState.Suspected,
                Method = "Unknown",
                Frequency = "Unknown",
                Owner = "To be confirmed",
                Validation = ValidationStatus.SmeReviewRequested,
                EvidenceId = transcript.Id,
            },
            new Integration
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Name = "AQUIS to Water Monitoring Portal",
                SourceSystem = "AQUIS",
                Target = "Water Monitoring Portal",
                BusinessPurpose = "Publish monitoring data. Unconfirmed current-state interface.",
                Direction = "Outbound",
                State = InformationState.Suspected,
                Method = "Unknown",
                Frequency = "Unknown",
                Owner = "To be confirmed",
                Validation = ValidationStatus.Captured,
            },
            new Integration
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Name = "External submission portal",
                SourceSystem = "External submission portal",
                Target = "Holding area",
                BusinessPurpose = "Submit drill logs. Future-state requirement, not a current-state fact.",
                Direction = "Inbound",
                State = InformationState.Future,
                Method = "Application workflow",
                Frequency = "On submission",
                Owner = "To be confirmed",
                Validation = ValidationStatus.AnalystReviewed,
            });
        db.DataFlows.AddRange(
            new DataFlow { ProjectId = project.Id, AssessedSystemId = aquis.Id, DataSet = "Monitoring data publication", Source = "AQUIS", Destination = "External service", State = InformationState.Suspected, Validation = ValidationStatus.Captured },
            new DataFlow { ProjectId = project.Id, AssessedSystemId = aquis.Id, DataSet = "Drill log submission", Source = "External portal", Destination = "Holding area", State = InformationState.Future, Validation = ValidationStatus.AnalystReviewed });
        db.BatchProcesses.AddRange(
            new BatchProcess { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Monitoring data extract", Schedule = "Unknown", Input = "AQUIS data", Output = "Unknown", OperationalOwner = "Unknown", Validation = ValidationStatus.Captured },
            new BatchProcess { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Scheduled processing jobs", Schedule = "Unknown", Input = "Unknown", Output = "Unknown", OperationalOwner = "Unknown", Validation = ValidationStatus.Captured });
        db.InfrastructureAssets.AddRange(
            new InfrastructureAsset { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Unknown", OperatingSystem = "Unknown", EnvironmentName = "Development", HostingModel = "OnPremises", Validation = ValidationStatus.Captured },
            new InfrastructureAsset { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Unknown", OperatingSystem = "Unknown", EnvironmentName = "Test", HostingModel = "OnPremises", Validation = ValidationStatus.Captured },
            new InfrastructureAsset { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "To be confirmed", OperatingSystem = "To be confirmed", EnvironmentName = "Production", HostingModel = "OnPremises", Validation = ValidationStatus.SmeReviewRequested },
            new InfrastructureAsset { ProjectId = project.Id, AssessedSystemId = aquis.Id, Name = "Unknown", OperatingSystem = "Unknown", EnvironmentName = "Disaster recovery", HostingModel = "OnPremises", Validation = ValidationStatus.Captured });

        var gapItems = new (ScanDomainKind Domain, string Text, string Reason, Priority Priority, string Impact)[]
        {
            (ScanDomainKind.Architecture, "What does AQUIS stand for?", "System name and acronym must be confirmed for the market-scan overview.", Priority.Must, "Blocks executive summary wording."),
            (ScanDomainKind.Architecture, "What business functions does it support?", "Business purpose remains unconfirmed.", Priority.Must, "Blocks system overview."),
            (ScanDomainKind.Architecture, "Which Oracle Forms modules are used?", "Component inventory is incomplete.", Priority.Should, "Limits architecture section."),
            (ScanDomainKind.Database, "Confirm Oracle Database version and schemas", "Database product is inferred only.", Priority.Must, "Database chapter cannot be completed."),
            (ScanDomainKind.Database, "Which Oracle version, database and schemas support AQUIS?", "Instance, edition and schema list are unknown.", Priority.Should, "Database chapter cannot be completed."),
            (ScanDomainKind.Integrations, "Does AQUIS share infrastructure or data with Groundwater?", "Related-system relationship is unconfirmed.", Priority.Must, "Integration landscape is unreliable."),
            (ScanDomainKind.Integrations, "Identify upstream and downstream systems", "Current-state interfaces are not catalogued.", Priority.Must, "Integration catalogue is empty of confirmed records."),
            (ScanDomainKind.Integrations, "What systems provide data to AQUIS?", "Inbound interfaces unknown.", Priority.Should, "Data-flow diagrams omitted."),
            (ScanDomainKind.Integrations, "What systems consume AQUIS data?", "Outbound interfaces unknown.", Priority.Should, "Data-flow diagrams omitted."),
            (ScanDomainKind.Integrations, "What batch processes and scheduled jobs operate?", "Overnight processing is unknown.", Priority.Should, "Operations appendix incomplete."),
            (ScanDomainKind.Infrastructure, "Where is AQUIS hosted?", "Hosting model and location are unknown.", Priority.Must, "Infrastructure chapter cannot be written."),
            (ScanDomainKind.Infrastructure, "Identify hosting model and environments", "Hosting model and environment topology are unconfirmed.", Priority.Must, "Infrastructure chapter cannot be written."),
            (ScanDomainKind.Security, "What security and access controls apply?", "Deferred by current market-scan scope pending security review.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Architecture, "Transcript completeness is incomplete", "Major evidence gap: walkthrough transcript is incomplete.", Priority.Must, "Several architecture claims cannot be validated."),
            (ScanDomainKind.Architecture, "Confirm Oracle Forms version", "Module and version inventory is incomplete.", Priority.Must, "Limits architecture section."),
            (ScanDomainKind.Architecture, "Confirm business owner", "Business owner is not yet confirmed on the system record.", Priority.Must, "Ownership and contacts remain incomplete."),
            (ScanDomainKind.Architecture, "Identify application server", "Runtime hosting is unknown.", Priority.Should, "Limits architecture section."),
            (ScanDomainKind.Architecture, "Confirm business logic location", "Business-logic location is unknown.", Priority.Should, "Limits architecture section."),
            (ScanDomainKind.Architecture, "Identify reporting technology", "Reporting stack is unvalidated.", Priority.Should, "Limits architecture section."),
            (ScanDomainKind.Database, "Confirm Oracle Database version and edition", "Version and edition are unknown.", Priority.Must, "Database chapter cannot be completed."),
            (ScanDomainKind.Database, "Identify schemas and owners", "Schema ownership is unknown.", Priority.Should, "Database appendix incomplete."),
            (ScanDomainKind.Database, "Locate PL/SQL packages and triggers", "Business logic objects are unconfirmed.", Priority.Should, "Database appendix incomplete."),
            (ScanDomainKind.Database, "Identify database links", "External database dependencies are unknown.", Priority.Should, "Integration impact unknown."),
            (ScanDomainKind.Database, "Confirm backup and recovery arrangements", "Backup is unconfirmed.", Priority.Should, "Operational appendix incomplete."),
            (ScanDomainKind.Infrastructure, "Confirm hosting location", "Location is an information gap.", Priority.Must, "Infrastructure chapter cannot be written."),
            (ScanDomainKind.Infrastructure, "Identify application and database servers", "Server inventory is unknown.", Priority.Should, "Environment matrix incomplete."),
            (ScanDomainKind.Infrastructure, "Document Dev, Test and Production environments", "Environment topology is unknown.", Priority.Should, "Environment matrix incomplete."),
            (ScanDomainKind.Infrastructure, "Confirm network zone and access path", "Network zone is an information gap.", Priority.Should, "Infrastructure chapter incomplete."),
            (ScanDomainKind.Infrastructure, "Confirm backup and disaster recovery", "DR arrangements are unknown.", Priority.Should, "Resilience section incomplete."),
            (ScanDomainKind.Integrations, "Identify all upstream systems", "Inbound interfaces unknown.", Priority.Must, "Integration catalogue incomplete."),
            (ScanDomainKind.Integrations, "Identify all downstream systems", "Outbound interfaces unknown.", Priority.Must, "Integration catalogue incomplete."),
            (ScanDomainKind.Integrations, "Confirm interface methods and schedules", "Methods and frequency unknown.", Priority.Should, "Interface specifications missing."),
            (ScanDomainKind.Integrations, "Document failure handling and monitoring", "Operational support unknown.", Priority.Should, "Operations appendix incomplete."),
            (ScanDomainKind.Integrations, "Identify batch jobs and operational owners", "Batch catalogue unknown.", Priority.Should, "Operations appendix incomplete."),
            (ScanDomainKind.DataQuality, "Which data domains does AQUIS own?", "Data structures have not been assessed.", Priority.Should, "Data chapter remains not assessed."),
            (ScanDomainKind.DataQuality, "Identify principal data domains", "Domain register is unvalidated.", Priority.Should, "Data chapter incomplete."),
            (ScanDomainKind.DataQuality, "Confirm systems of record and data owners", "Ownership is unknown.", Priority.Should, "Data chapter incomplete."),
            (ScanDomainKind.DataQuality, "Estimate data volumes and historical depth", "Volume is unknown.", Priority.Could, "Migration planning blocked."),
            (ScanDomainKind.DataQuality, "Assess completeness, accuracy and duplication", "Quality ratings are not assessed.", Priority.Should, "Quality appendix empty."),
            (ScanDomainKind.DataQuality, "Document retention and migration requirements", "Retention is to be confirmed.", Priority.Should, "Migration appendix empty."),
            (ScanDomainKind.Security, "Confirm authentication and identity provider", "Identity model is unknown.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Security, "Identify roles and privileged access", "RBAC is unconfirmed.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Security, "Confirm encryption and audit logging", "Protective controls are unknown.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Security, "Identify data classification and privacy obligations", "Obligations are unconfirmed.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Security, "Confirm records retention requirements", "Retention is unconfirmed.", Priority.Could, "Security appendix deferred."),
            (ScanDomainKind.Operations, "Document the release and change process", "Deployment procedure is unknown.", Priority.Should, "Operations chapter cannot be completed."),
            (ScanDomainKind.Operations, "Confirm support model and hours", "Support arrangements are unknown.", Priority.Must, "Operational procedures incomplete."),
            (ScanDomainKind.Operations, "Identify patching, monitoring and escalation", "Runbooks are not recorded.", Priority.Should, "Operations appendix empty."),
            (ScanDomainKind.Limitations, "Confirm vendor support and end-of-life status", "Oracle Forms support window is unknown.", Priority.Must, "Legacy-risk section incomplete."),
            (ScanDomainKind.Limitations, "Identify key-person and replacement constraints", "Key-person risk is unconfirmed.", Priority.Should, "Limitations chapter incomplete."),
            (ScanDomainKind.Limitations, "Catalogue remaining legacy dependencies", "Dependency list is inferred only.", Priority.Should, "Replacement planning blocked."),
        };
        foreach (var gap in gapItems)
        {
            db.InformationGaps.Add(new InformationGap
            {
                ProjectId = project.Id,
                AssessedSystemId = aquis.Id,
                Domain = gap.Domain,
                MissingInformation = gap.Text,
                ReasonRequired = gap.Reason,
                Priority = gap.Priority,
                MarketScanImpact = gap.Impact,
                AssignedOwner = gap.Priority == Priority.Must ? "Anthony McLoughlin" : "",
                Status = gap.Domain == ScanDomainKind.Security ? GapStatus.DeferredByScope : GapStatus.Open,
                DueDate = new DateOnly(2026, 9, 15),
            });
        }

        db.Findings.AddRange(
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.Observation,
                Domain = ScanDomainKind.Architecture,
                Title = "AQUIS uses Oracle Forms as its front-end technology",
                Description = "Confirmed by Anthony McLoughlin from the AQUIS walkthrough transcript at 00:23. Oracle Forms is the current user-interface technology.",
                Severity = Severity.Moderate,
                Likelihood = 2,
                Impact = 2,
                Owner = "Anthony McLoughlin",
                EvidenceId = transcript.Id,
                Confidence = "High",
                Validation = ValidationStatus.SmeValidated,
                Recommendation = "Retain as a confirmed current-state fact in the market-scan document.",
                IncludeInDocument = true,
                ReviewState = ReviewState.Approved,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.Observation,
                Domain = ScanDomainKind.Architecture,
                Title = "AQUIS is similar to Groundwater",
                Description = "AQUIS was described as pretty much similar to Groundwater, with an Oracle Forms front end; the technical dependency remains unconfirmed.",
                Severity = Severity.Moderate,
                Likelihood = 3,
                Impact = 2,
                Owner = "Anthony McLoughlin",
                EvidenceId = transcript.Id,
                Confidence = "High",
                Validation = ValidationStatus.AnalystReviewed,
                Recommendation = "Validate the relationship with the Groundwater SME before treating it as a current-state interface.",
                IncludeInDocument = true,
                ReviewState = ReviewState.Approved,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.InformationGap,
                Domain = ScanDomainKind.Architecture,
                Title = "Oracle Forms version is unconfirmed",
                Description = "Oracle Forms is confirmed as the front end but the Forms version and module list remain an information gap.",
                Severity = Severity.Moderate,
                Likelihood = 3,
                Impact = 2,
                Owner = "Anthony McLoughlin",
                EvidenceGapRationale = "Module list is partial.",
                Confidence = "Medium",
                Validation = ValidationStatus.Captured,
                Recommendation = "Confirm Oracle Forms version with the technical owner.",
                IncludeInDocument = true,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.InformationGap,
                Domain = ScanDomainKind.Database,
                Title = "Confirm Oracle Database version and schemas",
                Description = "Oracle Database is inferred from the Oracle Forms front end. Version, edition and schema ownership are unknown.",
                Severity = Severity.High,
                Likelihood = 3,
                Impact = 3,
                Owner = "Anthony McLoughlin",
                EvidenceGapRationale = "No database evidence pack is linked yet.",
                Confidence = "Low",
                Validation = ValidationStatus.Captured,
                Recommendation = "Obtain DBA confirmation of version, edition, instance and schemas.",
                IncludeInDocument = true,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.InformationGap,
                Domain = ScanDomainKind.Infrastructure,
                Title = "Identify application and database hosting locations",
                Description = "Application server, database server and hosting locations remain unknown.",
                Severity = Severity.High,
                Likelihood = 3,
                Impact = 3,
                Owner = "Anthony McLoughlin",
                EvidenceGapRationale = "Hosting questionnaire is blank.",
                Confidence = "Low",
                Validation = ValidationStatus.Captured,
                Recommendation = "Confirm on-premises locations, environments and owners with infrastructure.",
                IncludeInDocument = true,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.InformationGap,
                Domain = ScanDomainKind.Architecture,
                Title = "AQUIS walkthrough transcript is incomplete",
                Description = "The available Oracle Forms walkthrough transcript is incomplete between 00:26 and 46:34. Several architecture and integration claims cannot be validated until a complete source is obtained.",
                Severity = Severity.High,
                Likelihood = 4,
                Impact = 3,
                Owner = "Asish Punnose",
                EvidenceId = transcript.Id,
                Confidence = "High",
                Validation = ValidationStatus.AnalystReviewed,
                Recommendation = "Obtain a complete walkthrough recording or SME-validated notes before document generation.",
                IncludeInDocument = true,
                ReviewState = ReviewState.Submitted,
            },
            new Finding
            {
                ProjectId = project.Id,
                SystemId = aquis.Id,
                Type = FindingType.Dependency,
                Domain = ScanDomainKind.Integrations,
                Title = "AQUIS relationship with Groundwater is unconfirmed",
                Description = "A possible relationship with Groundwater, including drill-log processes, was identified but is not a confirmed current-state integration. Oracle Forms pattern is similar.",
                Severity = Severity.Moderate,
                Likelihood = 3,
                Impact = 3,
                Owner = "Anthony McLoughlin",
                EvidenceGapRationale = "No interface specification is yet linked.",
                Confidence = "Low",
                Validation = ValidationStatus.SmeReviewRequested,
                Recommendation = "Confirm with the Groundwater SME whether AQUIS shares infrastructure, schemas or batch interfaces.",
                IncludeInDocument = true,
            });

        db.Actions.Add(new AssessmentAction
        {
            ProjectId = project.Id,
            SystemId = aquis.Id,
            Title = "Request SME confirmation of AQUIS acronym, modules, Oracle version and Groundwater relationship",
            Owner = "Anthony McLoughlin",
            DueDate = new DateOnly(2026, 9, 15),
            Priority = Priority.Must,
            Status = ActionStatus.Open,
        });
    }

    static void SeedWorkflow(AppDbContext db, Project project, AssessedSystem aquis)
    {
        var model = new MarketScanDocument.DocumentModel(
            "AQUIS Current-State System Assessment",
            "Market Scan",
            "1.0",
            "v0.3",
            new DateTimeOffset(2026, 8, 20, 6, 48, 0, TimeSpan.FromHours(10)),
            "Internal",
            "Current",
            "AQUIS is an internal legacy application using an Oracle Forms front end. Its detailed architecture, database configuration, hosting arrangements and integrations remain under assessment.",
            project.Scope,
            "Water Monitoring Systems Market Scan 2026",
            false,
            true,
            ["Unvalidated current-state statements are labelled."],
            [new MarketScanDocument.SystemSection(aquis.Name, aquis.Description, ["Front-end technology: Oracle Forms."], ["Database product: Oracle Database (inferred)."], ["Hosting location is to be confirmed."], ["Relationships with Groundwater remain unconfirmed."], ["Batch and data-flow processing is not yet confirmed."], ["Not assessed."], ["Deferred by current scope."], ["Support and release procedures are not documented."], ["Legacy Oracle Forms client/server; replacement constraints unknown."], [], [new MarketScanDocument.GapLine("Database version not confirmed", "Open", "Blocks database chapter")], ["AQUIS walkthrough transcript"])]);
        var bytes = MarketScanDocument.Word(model);
        var checksum = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
        GeneratedDocument Doc(string version, string format, string status, DateTimeOffset at, string activity) => new()
        {
            ProjectId = project.Id,
            AssessedSystemId = aquis.Id,
            CatalogKey = "aquis",
            Title = "AQUIS Current-State System Assessment",
            TemplateName = "Market Scan v1.0",
            TemplateVersion = "1.0",
            Audience = "Internal",
            StateScope = "Current",
            AssessmentVersion = version,
            VersionLabel = version,
            Format = format,
            Status = status,
            ApprovalState = version == "v0.3" ? "Not submitted" : "Superseded",
            GeneratedBy = "Asish Punnose",
            FileBytes = bytes,
            FileName = $"aquis-{version}.{(format == "PDF" ? "pdf" : "docx")}",
            PageCount = 12,
            FileSizeBytes = format == "PDF" ? bytes.Length : 486 * 1024,
            Readiness = 28,
            CreatedAt = at,
            ActivityJson = activity,
            ChecksumSha256 = checksum,
            RecordId = version == "v1.0" ? "DOC-AQUIS-0001" : "",
            Warnings = "Draft documents contain clearly labelled unvalidated content.",
            SearchIndexed = version is "v0.1" or "v0.3" or "v1.0",
            ShowOnProfile = version is "v1.0" or "v0.3",
            Summary = "The system currently relies on Oracle Forms. Detailed architecture, database configuration and hosting arrangements remain under assessment.",
            PublicationNote = "Approved current-state assessment covering Oracle Forms architecture for market-scan and RFI activities.",
        };
        var t1 = new DateTimeOffset(2026, 8, 19, 1, 32, 0, TimeSpan.FromHours(10));
        var t2 = new DateTimeOffset(2026, 8, 20, 5, 10, 0, TimeSpan.FromHours(10));
        var t3 = new DateTimeOffset(2026, 8, 20, 6, 48, 0, TimeSpan.FromHours(10));
        var tPub = new DateTimeOffset(2026, 8, 20, 7, 31, 0, TimeSpan.FromHours(10));
        var v3 = Doc("v0.3", "Word", "Draft", t3, """[{"at":"2026-08-20T16:48:00+10:00","text":"v0.3 generated from assessment snapshot v0.3"},{"at":"2026-08-20T16:42:00+10:00","text":"Anthony McLoughlin validation applied"},{"at":"2026-08-20T15:10:00+10:00","text":"v0.2 generated as PDF"},{"at":"2026-08-19T11:32:00+10:00","text":"Initial document generated"}]""");
        v3.Comments.AddRange(
            new DocumentComment { SectionNumber = 4, Section = "Architecture & technical design", Author = "Michael", Domain = "Architecture", Text = "Confirm the Oracle Forms version before final release.", Status = "Unresolved" },
            new DocumentComment { SectionNumber = 5, Section = "Infrastructure & hosting", Author = "Michael", Domain = "Infrastructure", Text = "Clarify whether database hosting is on-premises.", Status = "Unresolved" },
            new DocumentComment { SectionNumber = 9, Section = "Security & compliance", Author = "Michael", Domain = "Security", Text = "Security section is intentionally deferred.", Status = "Acknowledged" });
        var v1 = Doc("v1.0", "Word", "Published", tPub, """[{"at":"2026-08-20T17:31:00+10:00","text":"Published by Asish Punnose"},{"at":"2026-08-20T17:26:00+10:00","text":"Document approved by Michael"},{"at":"2026-08-20T16:42:00+10:00","text":"SME validation applied"},{"at":"2026-08-20T14:05:00+10:00","text":"Walkthrough evidence added"}]""");
        v1.ApprovalState = "Published";
        v1.PublishedVersion = "v1.0";
        v1.PublishedAt = tPub;
        v1.Locked = true;
        v1.Approver = "Michael";
        v1.ApprovedAt = new DateTimeOffset(2026, 8, 20, 7, 26, 0, TimeSpan.FromHours(10));
        v1.ReviewDate = new DateOnly(2027, 2, 20);
        v1.Readiness = 100;
        v1.ViewCount = 24;
        v1.DownloadCount = 7;
        v1.SearchIndexed = true;
        v1.ShowOnProfile = true;
        v1.RecordId = "DOC-AQUIS-0001";
        db.GeneratedDocuments.AddRange(
            Doc("v0.1", "Word", "Superseded", t1, """[{"at":"2026-08-19T11:32:00+10:00","text":"Initial document generated"}]"""),
            Doc("v0.2", "PDF", "Superseded", t2, """[{"at":"2026-08-20T15:10:00+10:00","text":"v0.2 generated as PDF"}]"""),
            v3,
            v1);

        db.Claims.AddRange(
            Claim(project, aquis, ScanDomainKind.Architecture, "AQUIS uses Oracle Forms as its front end", "Pending", "High", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Database, "AQUIS uses an Oracle database", "Corrected", "Medium", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Architecture, "AQUIS is similar to Groundwater", "Confirmed", "High", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Architecture, "An external portal is required", "Confirmed", "High", InformationState.Future),
            Claim(project, aquis, ScanDomainKind.Architecture, "A holding area is required", "Pending", "High", InformationState.Future),
            Claim(project, aquis, ScanDomainKind.Integrations, "AQUIS publishes directly to WMIP", "Rejected", "Low", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Integrations, "Confirm relationship to WMIP", "Pending", "Medium", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Database, "AQUIS shares schemas with Groundwater", "Pending", "Low", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Infrastructure, "AQUIS is hosted on-premises", "Pending", "Medium", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Architecture, "Oracle Forms modules require confirmation", "Corrected", "Medium", InformationState.Current),
            Claim(project, aquis, ScanDomainKind.Integrations, "Drill-log relationship is possible", "Confirmed", "Low", InformationState.Suspected),
            Claim(project, aquis, ScanDomainKind.Architecture, "An internal reviewer application is required", "Confirmed", "High", InformationState.Future));

        var request = new ValidationRequest
        {
            ProjectId = project.Id,
            AssessedSystemId = aquis.Id,
            Reference = "request-1042",
            Title = "Validate AQUIS assessment findings",
            RequestedBy = "Asish Punnose",
            Reviewer = "Anthony McLoughlin",
            DueDate = new DateOnly(2026, 8, 27),
            Status = "Open",
            Context = "Asish Punnose has requested your review of findings extracted from the AQUIS walkthrough.",
        };
        request.Items.AddRange(
            Item(ScanDomainKind.Database, "AQUIS uses an Oracle database", "Reviewed", "confirm"),
            Item(ScanDomainKind.Architecture, "AQUIS is similar to Groundwater", "Reviewed", "confirm"),
            Item(ScanDomainKind.Architecture, "AQUIS uses Oracle Forms as its front-end technology.", "Pending", "", "High"),
            Item(ScanDomainKind.Architecture, "An internal reviewer application is required", "Pending", ""),
            Item(ScanDomainKind.Architecture, "A holding area is required", "Pending", ""),
            Item(ScanDomainKind.Integrations, "Confirm relationship to WMIP", "Pending", ""),
            Item(ScanDomainKind.Integrations, "AQUIS publishes directly to WMIP", "Pending", "", "Low"));
        db.ValidationRequests.Add(request);
    }

    static ExtractedClaim Claim(Project project, AssessedSystem aquis, ScanDomainKind domain, string statement, string decision, string confidence, InformationState state) => new()
    {
        ProjectId = project.Id,
        AssessedSystemId = aquis.Id,
        Domain = domain,
        Statement = statement,
        Confidence = confidence,
        AnalystDecision = decision,
        ClaimType = state == InformationState.Future ? ClaimType.Assumption : ClaimType.ExplicitStatement,
        Validation = decision switch { "Confirmed" => ValidationStatus.AnalystReviewed, "Corrected" => ValidationStatus.AnalystReviewed, "Rejected" => ValidationStatus.Captured, _ => ValidationStatus.AiExtracted },
        EvidenceExcerpt = "I did touch on AQUIS in our last meeting, but once again, pretty much similar to groundwater. Oracle Forms front end.",
        SourceLocation = "00:23",
        Speaker = "Anthony McLoughlin",
        ReviewerAssigned = "Anthony McLoughlin",
        State = state,
        VisibilityLabel = "Market scan",
    };

    static ValidationItem Item(ScanDomainKind domain, string statement, string status, string decision, string confidence = "High") => new()
    {
        Domain = domain,
        Statement = statement,
        Status = status,
        Decision = decision,
        Confidence = confidence,
        EvidenceTitle = "AQUIS walkthrough transcript",
        EvidenceExcerpt = "I did touch on AQUIS in our last meeting, but once again, pretty much similar to groundwater. Oracle Forms front end.",
        SourceLocation = "00:23",
        Comment = status == "Reviewed" ? "Confirmed from walkthrough." : "",
    };

    static void SeedSiblingFacts(AppDbContext db, Project project, Dictionary<string, AssessedSystem> systems)
    {
        var gwdb = systems["gwdb"];
        Fact(db, project, gwdb, ScanDomainKind.Architecture, "Front-end technology", "Oracle Forms / GWPlot", ValidationStatus.AnalystReviewed, ClaimType.ExplicitStatement, "High", null, "", "");
        Fact(db, project, gwdb, ScanDomainKind.Database, "Database product", "Oracle Database", ValidationStatus.AnalystReviewed, ClaimType.ExplicitStatement, "High", null, "", "");
        Fact(db, project, systems["hydstra"], ScanDomainKind.Architecture, "Front-end technology", "Hydstra / Hydrotel", ValidationStatus.AnalystReviewed, ClaimType.ExplicitStatement, "High", null, "", "");
        db.Integrations.Add(new Integration
        {
            ProjectId = project.Id,
            SystemId = gwdb.Id,
            Name = "GWDB drill log / plot tools",
            SourceSystem = "GWDB",
            Target = "GWPlot / DRN",
            BusinessPurpose = "Groundwater plot and drill-log receival.",
            Direction = "Internal",
            State = InformationState.Current,
            Method = "Application module",
            Owner = "Groundwater",
            Validation = ValidationStatus.AnalystReviewed,
        });
    }

    static void Fact(
        AppDbContext db,
        Project project,
        AssessedSystem system,
        ScanDomainKind domain,
        string attribute,
        string value,
        ValidationStatus validation,
        ClaimType type,
        string confidence,
        Evidence? evidence,
        string excerpt,
        string location,
        InformationState state = InformationState.Current)
    {
        db.ScanFacts.Add(new ScanFact
        {
            ProjectId = project.Id,
            AssessedSystemId = system.Id,
            Domain = domain,
            Attribute = attribute,
            Value = value,
            Validation = validation,
            ClaimType = type,
            Confidence = confidence,
            EvidenceId = evidence?.Id,
            EvidenceExcerpt = excerpt,
            SourceLocation = location,
            State = state,
            Visibility = domain == ScanDomainKind.Security ? VisibilityClass.Internal : VisibilityClass.General,
        });
    }
}
