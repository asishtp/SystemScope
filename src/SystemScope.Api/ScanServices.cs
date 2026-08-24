using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class ScanScoring
{
    public static readonly (ScanDomainKind Kind, int Weight, string Title)[] Weights =
    [
        (ScanDomainKind.Architecture, 20, "System architecture & technical design"),
        (ScanDomainKind.Database, 15, "Oracle Forms and database architecture"),
        (ScanDomainKind.Infrastructure, 10, "Infrastructure, hosting and environments"),
        (ScanDomainKind.Integrations, 15, "Interfaces and integrations"),
        (ScanDomainKind.DataQuality, 10, "Data models, schemas and data quality"),
        (ScanDomainKind.Security, 10, "Security architecture, access and compliance"),
        (ScanDomainKind.Operations, 10, "Deployment, support and operations"),
        (ScanDomainKind.Limitations, 10, "Limitations, risks and legacy dependencies"),
    ];

    public static readonly Dictionary<ScanDomainKind, string[]> RequiredAttributes = new()
    {
        [ScanDomainKind.Architecture] =
        [
            "Front-end technology", "Back-end technology", "Application server", "Reporting technology", "Architecture style"
        ],
        [ScanDomainKind.Database] =
        [
            "Database product", "Version", "Edition", "Hosting location", "Instance name", "Approximate size"
        ],
        [ScanDomainKind.Infrastructure] =
        [
            "Hosting model", "Hosting location", "Application delivery", "Network zones", "Infrastructure owner", "External support"
        ],
        [ScanDomainKind.Integrations] =
        [
            "Inbound systems", "Outbound systems", "Interface types", "Current-state catalogue"
        ],
        [ScanDomainKind.DataQuality] =
        [
            "Authoritative data domains", "Principal entities", "Classification", "Retention", "Data owner",
            "Completeness", "Accuracy", "Consistency", "Known duplicates", "Reconciliation process"
        ],
        [ScanDomainKind.Security] =
        [
            "Authentication", "Single sign-on", "Multi-factor authentication", "Role-based access",
            "Privileged access", "Encryption at rest", "Encryption in transit", "Audit logging",
            "Vulnerability management", "Applicable obligations"
        ],
        [ScanDomainKind.Operations] =
        [
            "Release process", "Support model", "Support hours", "Patching process", "Monitoring", "Escalation path"
        ],
        [ScanDomainKind.Limitations] =
        [
            "Known limitations", "Technical debt", "Vendor support status", "Key-person dependency", "Legacy dependencies", "Replacement constraints"
        ],
    };

    public static bool IsFilled(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim();
        string[] empty =
        [
            "unknown", "not assessed", "not applicable", "to be confirmed", "not documented",
            "not identified", "not identified in available evidence", "not performed", "none"
        ];
        return !empty.Any(x => v.Equals(x, StringComparison.OrdinalIgnoreCase));
    }

    public static bool CountsAsValidated(ValidationStatus status) =>
        status is ValidationStatus.SmeValidated or ValidationStatus.TechnicalReviewed
            or ValidationStatus.SecurityReviewed or ValidationStatus.Approved
            or ValidationStatus.DocumentReady or ValidationStatus.Published;

    public static bool IsOpenGap(GapStatus status) =>
        status is GapStatus.Open or GapStatus.Assigned or GapStatus.AwaitingResponse;

    public static int Percent(int filled, int total) => total <= 0 ? 0 : (int)Math.Round(filled * 100d / total);

    public static (int Information, int Validation, int Readiness, Dictionary<ScanDomainKind, int> DomainPercents) Score(
        IReadOnlyCollection<ScanDomainState> domains,
        IReadOnlyCollection<ScanFact> facts,
        IReadOnlyCollection<InformationGap> gaps,
        IReadOnlyCollection<ExtractedClaim> claims,
        IReadOnlyCollection<Finding> findings)
    {
        var domainPercents = new Dictionary<ScanDomainKind, int>();
        var weighted = 0;
        var weightTotal = 0;
        var validated = 0;
        var validatable = 0;

        foreach (var (kind, weight, _) in Weights)
        {
            var state = domains.FirstOrDefault(d => d.Kind == kind);
            var required = state?.Requirement ?? DomainRequirement.Required;
            var attrs = RequiredAttributes[kind];
            var domainFacts = facts.Where(f => f.Domain == kind && f.State != InformationState.Future).ToList();
            var filled = attrs.Count(a => domainFacts.Any(f => f.Attribute.Equals(a, StringComparison.OrdinalIgnoreCase) && IsFilled(f.Value)));
            var applicable = required is DomainRequirement.Deferred ? 0 : attrs.Length;
            var pct = required is DomainRequirement.Deferred ? 0 : Percent(filled, applicable);
            domainPercents[kind] = pct;
            if (applicable > 0)
            {
                weighted += pct * weight;
                weightTotal += weight;
            }

            foreach (var fact in domainFacts.Where(f => IsFilled(f.Value)))
            {
                validatable++;
                if (CountsAsValidated(fact.Validation)) validated++;
            }
        }

        foreach (var claim in claims)
        {
            validatable++;
            if (CountsAsValidated(claim.Validation)) validated++;
        }

        var information = weightTotal == 0 ? 0 : (int)Math.Round(weighted / (double)weightTotal);
        var validation = Percent(validated, validatable);

        var requiredComplete = information >= 80;
        var highImpactValidated = !claims.Any(c => c.ClaimType != ClaimType.Unknown && !CountsAsValidated(c.Validation) && c.Confidence is "High" or "Confirmed");
        var criticalGapsExplained = gaps.Where(g => g.Priority == Priority.Must && IsOpenGap(g.Status)).All(g => !string.IsNullOrWhiteSpace(g.Resolution) || g.Status is GapStatus.AcceptedLimitation or GapStatus.DeferredByScope);
        var conflictsResolved = !claims.Any(c => c.ClaimType == ClaimType.Conflict && c.Validation != ValidationStatus.Approved);
        var highFindingsApproved = findings.Where(f => f.Severity >= Severity.High).All(f => f.ReviewState == ReviewState.Approved);
        var readinessFlags = new[] { requiredComplete, highImpactValidated, criticalGapsExplained, conflictsResolved, highFindingsApproved };
        var readiness = Percent(readinessFlags.Count(x => x), readinessFlags.Length);
        if (information < 40) readiness = Math.Min(readiness, 20);
        return (information, validation, readiness, domainPercents);
    }
}

public static class ScanWorkspace
{
    static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = false };

    public static async Task<ScanAssessment> Ensure(AppDbContext db, AssessedSystem system)
    {
        var scan = await db.ScanAssessments.Include(x => x.Domains).FirstOrDefaultAsync(x => x.AssessedSystemId == system.Id);
        if (scan is not null)
        {
            var added = false;
            foreach (var (kind, _, _) in ScanScoring.Weights)
            {
                if (scan.Domains.Any(d => d.Kind == kind)) continue;
                var domain = new ScanDomainState
                {
                    ScanAssessmentId = scan.Id,
                    Kind = kind,
                    Requirement = DomainRequirement.Required,
                };
                scan.Domains.Add(domain);
                db.ScanDomains.Add(domain);
                added = true;
            }
            if (added) await db.SaveChangesAsync();
            return scan;
        }
        var master = system.MasterSystemId is Guid mid
            ? await db.MasterSystems.FindAsync(mid)
            : await db.MasterSystems.FirstOrDefaultAsync(x => x.Acronym == system.Acronym || x.Name == system.Name);
        if (master is null)
        {
            master = MasterFrom(system);
            db.MasterSystems.Add(master);
            await db.SaveChangesAsync();
            system.MasterSystemId = master.Id;
            system.CatalogKey = string.IsNullOrWhiteSpace(system.CatalogKey) ? Slug(system.Acronym, system.Name) : system.CatalogKey;
        }
        scan = new ScanAssessment
        {
            ProjectId = system.ProjectId,
            AssessedSystemId = system.Id,
            MasterSystemId = master.Id,
            Status = AssessmentStatus.InProgress,
            IncludeInRfi = true,
            AssessmentLead = "",
        };
        foreach (var (kind, _, _) in ScanScoring.Weights)
            scan.Domains.Add(new ScanDomainState { Kind = kind, Requirement = DomainRequirement.Required });
        db.ScanAssessments.Add(scan);
        await db.SaveChangesAsync();
        return scan;
    }

    public static MasterSystem MasterFrom(AssessedSystem system) => new()
    {
        Name = system.Name,
        Acronym = system.Acronym,
        CatalogKey = string.IsNullOrWhiteSpace(system.CatalogKey) ? Slug(system.Acronym, system.Name) : system.CatalogKey,
        Description = system.Description,
        BusinessPurpose = system.BusinessPurpose,
        BusinessCapabilities = system.BusinessCapabilities,
        BusinessOwner = system.BusinessOwner,
        TechnicalOwner = system.TechnicalOwner,
        SupportTeam = system.SupportTeam,
        UserGroups = system.UserGroups,
        UserCount = system.UserCount,
        Criticality = system.Criticality,
        AvailabilityExpectations = system.AvailabilityExpectations,
        LifecycleStatus = system.Lifecycle,
        Vendor = system.Vendor,
        Product = system.Product,
        StateClassification = system.StateClassification,
        Tags = system.Tags,
        EffectiveFrom = system.EffectiveFrom,
        EffectiveTo = system.EffectiveTo,
        DataClassification = system.DataClassification,
    };

    public static string Slug(string acronym, string name)
    {
        var raw = string.IsNullOrWhiteSpace(acronym) ? name : acronym;
        var chars = raw.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        return new string(chars).Trim('-');
    }

    public static async Task Recalculate(AppDbContext db, Guid assessedSystemId)
    {
        var scan = await db.ScanAssessments.Include(x => x.Domains).FirstOrDefaultAsync(x => x.AssessedSystemId == assessedSystemId);
        if (scan is null) return;
        var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == assessedSystemId).ToListAsync();
        var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == assessedSystemId).ToListAsync();
        var claims = await db.Claims.Where(x => x.AssessedSystemId == assessedSystemId).ToListAsync();
        var findings = await db.Findings.Where(x => x.SystemId == assessedSystemId).ToListAsync();
        var evidence = await db.Evidence.Where(x => x.SystemId == assessedSystemId).ToListAsync();
        var (info, validation, readiness, percents) = ScanScoring.Score(scan.Domains, facts, gaps, claims, findings);
        scan.InformationCompleteness = info;
        scan.ValidationCompleteness = validation;
        scan.DocumentReadiness = readiness;
        foreach (var domain in scan.Domains)
        {
            percents.TryGetValue(domain.Kind, out var pct);
            domain.Completeness = pct;
            var openInDomain = gaps.Count(g => g.Domain == domain.Kind && ScanScoring.IsOpenGap(g.Status));
            var deferredInDomain = gaps.Count(g => g.Domain == domain.Kind && g.Status is GapStatus.DeferredByScope);
            domain.GapCount = domain.Requirement == DomainRequirement.Deferred ? deferredInDomain + openInDomain : openInDomain;
            domain.EvidenceCount = evidence.Count(e =>
                facts.Any(f => f.Domain == domain.Kind && f.EvidenceId == e.Id)
                || claims.Any(c => c.Domain == domain.Kind && c.EvidenceId == e.Id)
                || (!string.IsNullOrWhiteSpace(e.Title) && DomainHints(domain.Kind).Any(h => e.Title.Contains(h, StringComparison.OrdinalIgnoreCase))));
            domain.LastUpdatedAt = DateTimeOffset.UtcNow;
        }
        await db.SaveChangesAsync();
    }

    static string[] DomainHints(ScanDomainKind kind) => kind switch
    {
        ScanDomainKind.Architecture => ["walkthrough", "Forms", "McLoughlin", "architecture"],
        ScanDomainKind.Database => ["walkthrough", "Oracle", "database"],
        ScanDomainKind.Infrastructure => ["walkthrough", "hosting"],
        ScanDomainKind.Integrations => ["walkthrough", "drill", "interface"],
        ScanDomainKind.DataQuality => ["quality", "domain", "schema"],
        ScanDomainKind.Security => ["security", "identity"],
        ScanDomainKind.Operations => ["support", "patch", "release", "monitor"],
        ScanDomainKind.Limitations => ["legacy", "risk", "limitation", "dependency"],
        _ => []
    };

    public static async Task<object> Payload(AppDbContext db, AssessedSystem system)
    {
        var scan = await Ensure(db, system);
        await Recalculate(db, system.Id);
        scan = await db.ScanAssessments.Include(x => x.Domains).FirstAsync(x => x.Id == scan.Id);
        var project = await db.Projects.FindAsync(system.ProjectId);
        var master = await db.MasterSystems.FindAsync(scan.MasterSystemId);
        var facts = await db.ScanFacts.Where(x => x.AssessedSystemId == system.Id).OrderBy(x => x.Domain).ThenBy(x => x.Attribute).ToListAsync();
        var gaps = await db.InformationGaps.Where(x => x.AssessedSystemId == system.Id).OrderBy(x => x.Priority).ToListAsync();
        var claims = await db.Claims.Where(x => x.AssessedSystemId == system.Id).OrderByDescending(x => x.UpdatedAt).ToListAsync();
        var evidence = await db.Evidence.Where(x => x.SystemId == system.Id).OrderByDescending(x => x.UpdatedAt).ToListAsync();
        var findings = await db.Findings.Where(x => x.SystemId == system.Id).OrderByDescending(x => x.Severity).ToListAsync();
        var actions = await db.Actions.Where(x => x.SystemId == system.Id).OrderBy(x => x.DueDate).ToListAsync();
        var components = await db.Components.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var databases = await db.SystemDatabases.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var infrastructure = await db.InfrastructureAssets.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var integrations = await db.Integrations.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var flows = await db.DataFlows.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var batches = await db.BatchProcesses.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var dataDomains = await db.DataDomains.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var security = await db.SecurityControls.Where(x => x.AssessedSystemId == system.Id && !x.Archived).ToListAsync();
        var documents = await db.GeneratedDocuments.Where(x => x.ProjectId == system.ProjectId).OrderByDescending(x => x.CreatedAt).Take(10).Select(x => new { x.Id, x.Title, x.Audience, x.Status, x.CreatedAt, x.FileName, x.Warnings }).ToListAsync();
        return new
        {
            system = new
            {
                system.Id,
                system.ProjectId,
                system.CatalogKey,
                system.Name,
                system.Acronym,
                system.Description,
                system.BusinessPurpose,
                system.BusinessOwner,
                system.TechnicalOwner,
                system.SupportTeam,
                system.Vendor,
                system.Product,
                system.Lifecycle,
                criticality = system.Criticality.ToString(),
                system.DataClassification,
                system.Tags,
            },
            master = master is null ? null : new { master.Id, master.Name, master.Acronym, master.CatalogKey, master.BusinessOwner, master.TechnicalOwner },
            project = project is null ? null : new { project.Id, project.Name, project.Objective, project.Scope, project.Owner, status = project.Status.ToString(), project.TargetDate },
            scan = new
            {
                scan.Id,
                status = scan.Status.ToString(),
                scan.IncludeInRfi,
                scan.IncludeInDocument,
                scan.AssessmentLead,
                scan.Assessor,
                scan.InformationCompleteness,
                scan.ValidationCompleteness,
                scan.DocumentReadiness,
                scan.UpdatedAt,
            },
            domains = ScanScoring.Weights.Select(meta =>
            {
                var d = scan.Domains.First(x => x.Kind == meta.Kind);
                return new
                {
                    d.Id,
                    kind = d.Kind.ToString(),
                    title = meta.Title,
                    weight = meta.Weight,
                    requirement = d.Requirement.ToString(),
                    d.Summary,
                    d.Completeness,
                    d.EvidenceCount,
                    d.GapCount,
                    lastUpdatedAt = d.LastUpdatedAt,
                    lastValidatedAt = d.LastValidatedAt,
                    requiredAttributes = ScanScoring.RequiredAttributes[d.Kind],
                };
            }),
            facts,
            gaps,
            claims,
            evidence,
            findings,
            actions,
            components,
            databases,
            infrastructure,
            integrations,
            flows,
            batches,
            dataDomains,
            security,
            documents,
            requiredAttributes = ScanScoring.RequiredAttributes.ToDictionary(x => x.Key.ToString(), x => x.Value),
        };
    }

    public static string Snapshot(object payload) => JsonSerializer.Serialize(payload, Json);
}

public static class MarketScanDocument
{
    public static byte[] Word(DocumentModel model)
    {
        var body = new XElement(W + "body");
        Heading(body, model.Title, "Heading1");
        Para(body, $"Template {model.TemplateName} {model.TemplateVersion} · Assessment {model.AssessmentVersion} · Generated {model.GeneratedAt:dd MMM yyyy} · Audience {model.Audience} · Scope {model.StateScope}.");
        if (model.Warnings.Count > 0)
        {
            Heading(body, "Generation warnings", "Heading2");
            foreach (var w in model.Warnings) Para(body, w, bold: true);
        }

        Heading(body, "1. Executive summary", "Heading1");
        Para(body, model.ExecutiveSummary);
        Heading(body, "2. Scope and approach", "Heading1");
        Para(body, model.Scope);
        Heading(body, "3. Landscape overview", "Heading1");
        Para(body, model.Landscape);
        Heading(body, "3.1 Application relationships", "Heading2");
        if (model.Relationships.Count == 0) Para(body, "No application relationships are currently recorded for this project.");
        foreach (var relationship in model.Relationships) Para(body, relationship);
        Heading(body, "3.2 Technical and business requirements", "Heading2");
        if (model.Requirements.Count == 0) Para(body, "No approved or draft requirements are currently recorded for this project.");
        foreach (var requirement in model.Requirements)
            Para(body, $"[{requirement.Priority}] {requirement.Title} ({requirement.Type}, {requirement.Category}){(requirement.Mandatory ? " — Mandatory" : " — Desirable")}. {requirement.Description} Acceptance criteria: {requirement.AcceptanceCriteria}");
        foreach (var system in model.Systems)
        {
            Heading(body, $"4. System overview — {system.Name}", "Heading1");
            Para(body, system.Overview);
            Section(body, "5. System architecture and technical design", system.Architecture);
            Section(body, "6. Oracle Forms and database architecture", system.Database);
            Section(body, "7. Infrastructure, hosting and environments", system.Infrastructure);
            Section(body, "8. Interfaces and integrations with other systems", system.Integrations);
            Section(body, "9. Data flows and batch processes", system.DataFlows);
            Section(body, "10. Data models, schemas and entity relationships", system.Data);
            if (model.IncludeSecurity) Section(body, "11. Security architecture, access controls and compliance", system.Security);
            else Para(body, "Security content is excluded from this audience or deferred by scope.");
            Section(body, "12. Deployment, support and operational procedures", system.Operations);
            Section(body, "13. Known technical limitations, risks and legacy dependencies", system.Limitations);
            Heading(body, "14. Risks and constraints", "Heading1");
            if (system.Findings.Count == 0) Para(body, "No approved findings are included for this audience.");
            foreach (var f in system.Findings) Para(body, $"{f.Title} ({f.Severity}). {f.Description}");
            Heading(body, "15. Information gaps and limitations", "Heading1");
            if (!model.IncludeGaps) Para(body, "Information gaps are omitted for this edition.");
            else
            {
                if (system.Gaps.Count == 0) Para(body, "No open information gaps remain in scope.");
                foreach (var g in system.Gaps) Para(body, $"{g.MissingInformation} — {g.Status}. {g.MarketScanImpact}");
            }
            Heading(body, "13. Appendices", "Heading1");
            Para(body, "Source register, validation register and inventories are retained in SystemScope against this snapshot.");
            if (model.Audience == "Internal")
            {
                Heading(body, "Source and validation register", "Heading2");
                foreach (var s in system.Sources) Para(body, s);
            }
        }

        body.Add(new XElement(W + "sectPr",
            new XElement(W + "pgSz", new XAttribute(W + "w", 11906), new XAttribute(W + "h", 16838)),
            new XElement(W + "pgMar", new XAttribute(W + "top", 1134), new XAttribute(W + "right", 1134), new XAttribute(W + "bottom", 1134), new XAttribute(W + "left", 1134))));

        var document = new XDocument(
            new XDeclaration("1.0", "UTF-8", "yes"),
            new XElement(W + "document", new XAttribute(XNamespace.Xmlns + "w", W.NamespaceName), body));

        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            Write(zip, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                </Types>
                """);
            Write(zip, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                </Relationships>
                """);
            Write(zip, "word/_rels/document.xml.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
                """);
            var entry = zip.CreateEntry("word/document.xml");
            using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
            writer.Write(document.ToString(SaveOptions.DisableFormatting));
        }
        return stream.ToArray();
    }

    static readonly XNamespace W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    static void Section(XElement body, string title, IEnumerable<string> paragraphs)
    {
        Heading(body, title, "Heading1");
        var list = paragraphs.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
        if (list.Count == 0) Para(body, "Not assessed. This is an information gap, not a negative finding.");
        foreach (var p in list) Para(body, p);
    }

    static void Heading(XElement body, string text, string style) =>
        body.Add(new XElement(W + "p",
            new XElement(W + "pPr", new XElement(W + "pStyle", new XAttribute(W + "val", style))),
            new XElement(W + "r", new XElement(W + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), text))));

    static void Para(XElement body, string text, bool bold = false) =>
        body.Add(new XElement(W + "p",
            new XElement(W + "r",
                bold ? new XElement(W + "rPr", new XElement(W + "b")) : null,
                new XElement(W + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), text))));

    static void Write(ZipArchive zip, string path, string content)
    {
        var entry = zip.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    public record DocumentModel(
        string Title,
        string TemplateName,
        string TemplateVersion,
        string AssessmentVersion,
        DateTimeOffset GeneratedAt,
        string Audience,
        string StateScope,
        string ExecutiveSummary,
        string Scope,
        string Landscape,
        bool IncludeSecurity,
        bool IncludeGaps,
        List<string> Warnings,
        List<SystemSection> Systems,
        List<string> Relationships,
        List<RequirementLine> Requirements);

    public record SystemSection(
        string Name,
        string Overview,
        List<string> Architecture,
        List<string> Database,
        List<string> Infrastructure,
        List<string> Integrations,
        List<string> DataFlows,
        List<string> Data,
        List<string> Security,
        List<string> Operations,
        List<string> Limitations,
        List<FindingLine> Findings,
        List<GapLine> Gaps,
        List<string> Sources);

    public record FindingLine(string Title, string Severity, string Description);
    public record GapLine(string MissingInformation, string Status, string MarketScanImpact);
    public record RequirementLine(string Title, string Description, string Type, string Category, string Priority, bool Mandatory, string AcceptanceCriteria);
}

public static class ScanNarrative
{
    public static string FactLine(ScanFact fact, string audience)
    {
        if (!ScanScoring.IsFilled(fact.Value)) return $"{fact.Attribute} is unknown and is recorded as an information gap, not a negative assessment.";
        if (fact.State == InformationState.Future) return $"Future-state: {fact.Attribute} is proposed as {fact.Value}. This is not a current-state fact.";
        var qualifier = fact.ClaimType switch
        {
            ClaimType.Inference => "This is an inference pending validation. ",
            ClaimType.Assumption => "This is an assumption. ",
            ClaimType.Unknown => "This remains unknown. ",
            ClaimType.Conflict => "This statement conflicts with other evidence. ",
            _ => ""
        };
        if (!ScanScoring.CountsAsValidated(fact.Validation) && fact.ClaimType == ClaimType.ExplicitStatement)
            qualifier = "Unvalidated: " + qualifier;
        var evidence = audience == "Internal" && !string.IsNullOrWhiteSpace(fact.EvidenceExcerpt)
            ? $" Source: {fact.EvidenceExcerpt}{(string.IsNullOrWhiteSpace(fact.SourceLocation) ? "" : " (" + fact.SourceLocation + ")")}."
            : "";
        return $"{qualifier}{fact.Attribute}: {fact.Value}.{evidence}".Trim();
    }

    public static bool Visible(ScanFact fact, string audience, bool includeSecurity)
    {
        if (fact.Visibility == VisibilityClass.Excluded) return false;
        if (fact.Visibility == VisibilityClass.Restricted && audience != "Internal") return false;
        if (fact.Visibility == VisibilityClass.SecurityAppendixOnly && !includeSecurity) return false;
        if (fact.Domain == ScanDomainKind.Security && !includeSecurity && fact.Visibility != VisibilityClass.General) return false;
        return true;
    }
}
