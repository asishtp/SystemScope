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

## Remaining work before production acceptance

- Complete project-member and Entra group/application-role administration with record-level project filtering.
- Add UI template designer and integration/evidence registers beyond the Workshop shortcuts.
- Add full stakeholder, participant, workshop-note and review-comment timelines.
- Produce native Word, PDF and Excel report documents; current exports are CSV registers.
- Add EF Core migrations and run them as a controlled deployment step instead of runtime schema creation.
- Add automated unit, integration, accessibility and browser tests plus security scanning.
- Complete the departmental architecture, security, privacy, records-management, retention, backup/restore and operational approvals required by AC-011 and AC-012.
- Apply the approved private networking and Azure SQL managed-identity database grants in each target environment.
