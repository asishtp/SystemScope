# SystemScope feature inventory

This document records the functionality implemented against `SystemScope_Standalone_Application_Requirements.docx`, Version 1.0 — Complete requirements baseline, dated 17 August 2026.

## Solution and deployment

- React 19 and TypeScript single-page application.
- ASP.NET Core API targeting .NET 10.
- React production assets are built into the API `wwwroot` and published as one artifact.
- One Azure Linux Web App serves both the frontend and `/api` routes from the same origin.
- Bicep provisions the App Service plan, Web App, Azure SQL database and Application Insights.
- Azure SQL connection uses `Active Directory Default`, allowing the Web App system-assigned managed identity to authenticate without a stored database password.
- GitHub Actions performs the frontend build, .NET build/publish and combined Web App deployment using Azure workload identity federation.
- Public `/health` endpoint is available for App Service health checks.

## Identity and security

- Microsoft Entra JWT bearer authentication is enabled when tenant and client IDs are configured.
- Local development uses an explicit development identity with Assessment Lead and Administrator roles.
- API routes require authentication; authorization is enforced on the server rather than only hidden in the UI.
- Evidence accepts HTTPS links only and validates the repository host against configured approved hosts.
- Attachments, secrets, connection strings and production datasets are not accepted by application workflows.
- Requirement approval supports configurable submitter/approver separation of duties.

## Projects and systems

- Create and list assessment projects with objective, scope, owner, start date, target date and status.
- Register multiple systems within a project with description, acronym, owners, criticality and lifecycle.
- Archived-record metadata and optimistic-concurrency row versions exist on material records.
- Project and system creation generates append-only audit events.

## Assessment templates and Workshop Mode

- Seeded Oracle and Web Application template covers Overview, Architecture, Application, Database, Data, Integration, Infrastructure, Security, Delivery and Operations.
- Templates retain a version, ordered sections, ordered questions, mandatory markers and question types.
- Administrators can create a new template version through the API without a code change.
- Starting an assessment snapshots the template ID and exact version and creates a response for every question.
- Mobile-responsive question-by-question Workshop Mode includes progress, section navigation, answer, confidence and response status.
- Responses support Confirmed by evidence, Confirmed by SME, Inferred and Unconfirmed confidence.
- Response status supports Draft, Answered, Follow-up, Unknown and Not applicable.
- Workshop context can create linked evidence, findings and follow-up actions.
- Assessment submission/approval enforces mandatory completion. Unknown and Not applicable answers require a rationale.

## Evidence, findings and risk

- Evidence register API captures title, approved repository URL, source, classification, validation state, project and system.
- Evidence can be linked directly to an assessment response.
- Findings support observations, issues, risks, constraints, dependencies, technical debt, recommendations and information gaps.
- Findings retain links to project, system, response and evidence.
- Default risk score is likelihood multiplied by impact.
- An authorized risk override requires an explicit rationale.
- High and Critical findings require evidence or an evidence-gap rationale.
- Findings can be submitted, approved or returned with reviewer comments through the API.

## Requirements and traceability

- Create technical requirements with type, category, priority, rationale, acceptance criteria and mandatory/desirable status.
- Requirements must link to one or more findings or contain an approved standalone rationale.
- Cross-project finding links are rejected.
- Finding links are retained bidirectionally in the relational model.
- Requirements can be submitted, approved or returned with comments.

## Integrations and actions

- Register system integrations through the API with target, method, owner and monitoring details.
- Create workshop actions and information requests with system, owner, due date, priority and status.
- Dashboard highlights overdue actions.

## Interactive landscape

- Landscape view is the assessment workspace for the water management value chain (seeded as-is v5.0, April 2025).
- Every box shows live status: not in scope, registered, in workshop, submitted, approved, High/Critical pins, information gaps and last-confirmed evidence.
- In-scope systems stay full strength; one-hop neighbours are marked context / dependency.
- Coverage heat colours boxes green / amber / red from mandatory answers or open High/Critical findings.
- Multi-select systems and add them to a project from the map. Clusters (groundwater, monitoring, compliance, entitlements, public) start a shared scope and open workshop.
- Connection lines are clickable and create an integration, finding or action on that interface.
- Workshop Integration and Architecture questions show the assessed system and its landscape neighbours.
- Boxes can be moved, systems added, links drawn, and regional / decommissioned flags set. Dated as-is / to-be versions persist through the API.
- As-is, to-be and compare layers show keep / retire / replace / consolidate / add. Capability swimlanes group entitlements, compliance, groundwater, monitoring, spatial, operations, public channels and corporate.
- Blast-radius view lists downstream dependents. Search isolates and centres. Filters isolate rather than greying the estate. Fit includes every shown box.
- Export PNG of the current view and a printable in-scope pack of systems, interfaces and findings.
- Focus mode isolates one or more relationship hops around the selected system, with a breadcrumb back to the full landscape.
- System details panel covers Overview, Technology, Data, Assessment and Records, including owners, UI/API/database, hosting and identity.
- HSI view projects the same estate by hosting (on-prem, Azure, SaaS, field, external) and identity provider, with hosting / identity / UI-tech filters.
- Interface selection shows direction, data exchanged, method, frequency, owners and monitoring.

## Dashboard, search, audit and exports

- Dashboard displays active projects, systems in scope, assessment coverage, unresolved High/Critical findings, overdue actions, information gaps and requirements generated.
- Authenticated global search covers systems, findings and requirements and can be scoped by project.
- Audit history records material creates, response updates, reviews, approvals and exports with actor and UTC timestamp.
- Authorized CSV exports are available for systems, findings and requirements and record an audit event.

## Responsive and accessible presentation

- Desktop sidebar becomes an off-canvas navigation drawer on tablets and phones.
- Dashboard cards reflow from four columns to two and then one.
- Projects, systems, forms, dialogs, registers and Workshop Mode adapt to mobile widths.
- Controls use labels, status regions, accessible dialog semantics and mobile-sized touch targets.
- Register layouts provide horizontal scrolling where tabular content cannot reflow safely.

## Market scan, system assessment and document generation

Implemented against `SystemScope_Market_Scan_Requirements.md` (draft 1.0, 20 August 2026) and the approved AQUIS screen mockups. Status below is the working MVP as of 20 August 2026. Remaining polish against those screens is deferred.

### Shared model

- Reusable systems register (`MasterSystem`) so one system can participate in multiple projects without duplicating the master record.
- Seeded `Water Monitoring Systems Market Scan 2026` project with seven in-scope systems: AQUIS, GWDB, Hydstra, WFieldApp, WASP, Gauges and BLS.
- Six-domain assessment workspace: architecture, database, infrastructure, integrations, data quality and security.
- Information completeness uses configurable domain weights (25/20/15/20/10/10). Deferred and not-applicable domains do not reduce the score.
- Validation completeness, information gaps, claims and document readiness are first-class. Unknown / deferred / future-state records are not treated as current facts and do not penalise scoring unfairly.
- Claims are stored as AI-extracted proposals until an analyst reviews them. SME validation is a separate request. Restricted security is excluded from external documents.
- Integration catalogue distinguishes current, future, suspected and retired records.
- Structured search covers systems, technologies, components, integrations, facts, findings, gaps and published documents.
- Market-scan Word generation from structured data, with audience filtering, labelled inferences/unknowns, immutable snapshots, SHA-256 checksums and record IDs.
- Personas: assessment lead (LA), SME Anthony McLoughlin (AM) on the validation portal, document approver Michael (MP) on approval review.
- AQUIS is on the landscape map as a water-monitoring system with an unconfirmed Groundwater relationship.

### Implemented screens (hash routes)

| Screen | Route | Status |
| --- | --- | --- |
| Assessment overview | `#/assessments/aquis` | Implemented |
| System architecture & technical design | `#/assessments/aquis/architecture` | Implemented |
| Database architecture | `#/assessments/aquis/database` | Implemented |
| Infrastructure & hosting | `#/assessments/aquis/infrastructure` | Implemented |
| Integrations, data flows & batch processes | `#/assessments/aquis/integrations` | Implemented |
| Data structures & data quality | `#/assessments/aquis/data-quality` | Implemented |
| Security controls & compliance | `#/assessments/aquis/security` | Implemented (deferred by current scope) |
| Add evidence & AI analysis | `#/assessments/aquis/evidence/new` | Implemented |
| AI-extracted claims review | `#/assessments/aquis/evidence/claims-review` | Implemented |
| SME validation portal | `#/validate/aquis/request-1042` | Implemented |
| Generated documents & version history | `#/documents/aquis` | Implemented |
| Document preview / generation | `#/documents/aquis/market-scan/preview` | Implemented |
| Document approval review | `#/documents/aquis/v0.3/approval` | Implemented |
| Approved document & publication | `#/documents/aquis/v0.3/publish` | Implemented |

### Assessment overview

- Header: system name, current-state, In progress, RFI scope, Add evidence, Generate document.
- Owners, assessment lead and last updated.
- KPIs: information completeness, validation completeness, open Must-priority gaps, document readiness (Ready / Not ready).
- Six domain cards with completeness bar, evidence count, gap count and a short status line; each card opens that domain.
- Priority information gaps and recent evidence.

### Domain capture screens (architecture, database, infrastructure, integrations, data quality, security)

- Domain summary, validation status, editable attributes with validation pills (Confirmed, Inferred, Information gap, Unvalidated, To confirm, Future state, Not assessed, Deferred).
- Domain-specific registers: components, schemas, environments, integrations/data flows/batches, data domains/quality ratings, identity/security controls/compliance obligations.
- Add record, save draft, request validation (creates an action), mark section complete.
- Side panel: section progress, linked evidence, information gaps (expand to view all). Security shows Deferred progress, internal-only visibility and no evidence by default.
- Security details stay restricted; they are not included in the market-scan document unless an internal security appendix is explicitly selected.

### Add evidence and claims review

- Upload source (drop/browse), source metadata, analysis options, processing steps, privacy/redaction check, expected output estimates.
- Upload & analyse stores proposed claims only. Save source only skips analysis. Auto-request validation is off by default.
- Claims review: pending / confirmed / corrected / rejected counts, search and domain filter, confirm / correct / reject / needs more evidence, supporting excerpt, evidence quality, impact if approved.
- Apply reviewed claims updates the assessment only for confirmed/corrected items and can create SME validation requests. Claims are not published as facts until validated.

### SME validation portal

- Request header: due date, requested by, system, progress.
- Per-finding decision: yes / correct with changes / no / not sure, optional context, previous / save & next, submit validation.
- Supporting evidence excerpt, why this matters, other items in the request.
- Responses persist against the validation item and linked claim.

### Documents hub, preview, approval and publication

- Hub: version table, format/status filters, selected-document metadata, download, version comparison, activity, submit for approval (Michael), create copy, regenerate, mark as final, archive.
- Preview: template/audience/state/format, section toggles, readiness and blocking issues, labelled unvalidated content, Generate Word document (immutable snapshot).
- Approval: outline, page review, comments, four decisions (Approve, Approve with conditions, Request changes, Reject), review checks, open comments, readiness. Approve locks the file and opens publication.
- Publication: allowed only after approval; classification, visibility, distribution, search indexing, retention, record ID, checksum. Publish creates immutable v1.0, supersedes the source draft, and does not rewrite the approved file.

### APIs added for this workflow

- `GET /api/documents/by-key/{key}` — versioned document hub payload, comments, checksum, record ID.
- `GET /api/documents/preview/{key}` — draft preview and blocking issues.
- `POST /api/documents/{id}/submit` — submit for approval.
- `POST /api/documents/{id}/comments` and `POST .../comments/{commentId}/resolve`.
- `POST /api/documents/{id}/decision` — approval decision; Approve locks the file.
- `PUT /api/documents/{id}/publication` — save publication settings.
- `POST /api/documents/{id}/publish` — rejected unless `ApprovalState` is Approved; creates v1.0.
- `POST /api/documents/{id}/copy` and `POST /api/documents/{id}/archive`.
- `GET /api/documents/compare/{key}` — version comparison summary.
- `GET /api/validation/requests/{id}`, `PUT /api/validation/items/{id}`, `POST /api/validation/requests/{id}/submit`.
- `POST /api/claims/{id}/review` and `POST /api/systems/{id}/claims/apply`.

## Remaining work (deferred)

Screen-level polish still to do later:

- Pixel-level layout match to the mockups (icons, page-to-section mapping, zoom/export chrome).
- Native PDF rendition on publish (Word snapshot is copied today; PDF is a format flag).
- Published-document record / search result page (`docs/Published Document Record & Search View..png`).
- Live comparison of document body text rather than activity/readiness stats.
- Browser walkthrough of the 14 screens after the API is running.

Production acceptance still open:

- Complete project-member and Entra group/application-role administration with record-level project filtering.
- Add UI template designer and integration/evidence registers beyond the Workshop shortcuts.
- Add full stakeholder, participant, workshop-note and review-comment timelines.
- Produce native Word, PDF and Excel report documents; current Word output is an OpenXML zip without a dedicated Open XML SDK.
- Add EF Core migrations and run them as a controlled deployment step instead of runtime schema creation.
- Add automated unit, integration, accessibility and browser tests plus security scanning.
- Complete the departmental architecture, security, privacy, records-management, retention, backup/restore and operational approvals required by AC-011 and AC-012.
- Apply the approved private networking and Azure SQL managed-identity database grants in each target environment.
