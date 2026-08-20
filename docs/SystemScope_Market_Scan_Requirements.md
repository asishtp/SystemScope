# SystemScope — Market Scan, System Assessment and Document Generation Requirements

**Document status:** Draft for implementation  
**Version:** 1.0  
**Date:** 20 August 2026  
**Product:** SystemScope  
**Primary use case:** Water Monitoring Systems market scan and RFI preparation

---

## 1. Purpose

SystemScope will be extended from its current assessment dashboard into a structured, evidence-backed application for discovering, documenting, validating, searching and reporting on an organisation's systems and technical landscape.

The immediate objective is to capture information about systems such as AQUIS in a consistent form and generate a market-scan document covering:

1. System architecture and technical design
2. Database
3. Infrastructure and hosting at a high level
4. Integrations with other systems
5. Data structures and data quality
6. Security controls and compliance

The product must capture information once and reuse it across system profiles, dashboards, searches, diagrams, risk registers, validation workflows and generated Word or PDF documents.

## 2. Current-state observation

The current SystemScope interface provides the following initial navigation and concepts:

- Dashboard
- Landscape
- Projects
- Findings
- Requirements
- Actions
- Audit
- Global search
- New project

The dashboard also includes indicators for:

- Systems in scope
- Assessment coverage
- High findings
- Information gaps
- Active projects
- Priority findings

These concepts should be retained and expanded. The next release must introduce Systems, Assessments, Evidence, Validation, Integrations, Diagrams and Documents as structured capabilities.

## 3. Product vision

SystemScope should answer questions that a normal document repository cannot answer, including:

- Which applications use Oracle Forms?
- Which systems connect to AQUIS?
- Which systems depend on a specific database or server?
- What batch processes run overnight?
- Which applications have unsupported technology?
- Which integrations have no identified owner?
- Which security controls remain unvalidated?
- Which systems are not ready for the market scan and why?
- What facts were confirmed by a particular subject-matter expert?
- What information is still missing for a system?

The system must provide evidence and validation status with every important answer.

## 4. Design principles

1. **Capture once, reuse many times.** Structured assessment data must drive dashboards, search, diagrams and documents.
2. **Evidence before assertion.** Important facts must link to a transcript, document, screenshot, observation or SME response.
3. **Claims are not automatically facts.** AI-extracted statements must be reviewed and validated.
4. **Unknown is not poor.** Missing information must not be represented as a negative assessment.
5. **Current state and future state must be separate.** Proposed capabilities must not appear as existing functionality.
6. **Security-sensitive information must be controlled.** External documents must exclude restricted technical details.
7. **Documents are outputs, not the source of truth.** Generated documents must reflect versioned, approved assessment data.
8. **Every material change must be auditable.** The application must retain who changed what, when and why.

## 5. Users and roles

### 5.1 Application administrator

- Manage organisations, users, roles, templates and controlled vocabularies.
- Configure assessment domains, questions and scoring.
- Manage document templates and visibility rules.

### 5.2 Assessment lead

- Create projects and define systems in scope.
- Assign assessors and reviewers.
- Monitor completeness, gaps, findings and document readiness.
- Approve an assessment for document generation.

### 5.3 Analyst or architect

- Capture system information.
- Upload and review evidence.
- Create findings, risks, integrations, components and diagrams.
- Review AI-extracted claims.

### 5.4 Subject-matter expert

- Review assigned claims and questions.
- Confirm, correct, reject or defer information.
- Provide comments and supporting evidence.

### 5.5 Security reviewer

- Review security and compliance information.
- Control whether security findings can appear in external reports.

### 5.6 Read-only stakeholder

- View approved system profiles, dashboards, diagrams and published documents according to permissions.

## 6. Information hierarchy

SystemScope must support the following hierarchy:

```text
Organisation
  -> Landscape
      -> Assessment Project
          -> Systems in Scope
              -> System Assessment
                  -> Assessment Domains
                  -> Components
                  -> Databases
                  -> Infrastructure
                  -> Integrations
                  -> Data Domains
                  -> Security Controls
                  -> Findings and Risks
                  -> Evidence and Validation
                  -> Generated Documents
```

## 7. Core entities

The minimum logical entities are:

- Organisation
- User
- Role
- Landscape
- Project
- System
- SystemAssessment
- AssessmentDomain
- AssessmentResponse
- ApplicationComponent
- Technology
- Database
- InfrastructureComponent
- Environment
- Integration
- DataFlow
- BatchProcess
- DataDomain
- DataQualityAssessment
- SecurityControl
- ComplianceObligation
- DiscoverySource
- SourceParticipant
- ExtractedClaim
- EvidenceReference
- ValidatedFact
- Finding
- Risk
- InformationGap
- Question
- Answer
- ValidationRequest
- ValidationResponse
- Requirement
- Action
- Decision
- Diagram
- DocumentTemplate
- GeneratedDocument
- AuditEvent

## 8. Functional requirements

### FR-001 — Landscape management

The system shall allow authorised users to:

- Create and manage a technical landscape.
- Define its purpose, owner, scope, status and assessment period.
- Associate multiple projects and systems.
- View landscape-wide technologies, integrations, risks and information gaps.

### FR-002 — Assessment project management

The system shall allow an assessment lead to:

- Create a project such as `Water Monitoring Systems Market Scan 2026`.
- Define objectives, scope, exclusions, dates and stakeholders.
- Add or remove systems in scope.
- Assign system assessors and reviewers.
- Configure required assessment domains.
- Mark individual domains as required, optional or deferred.
- Track project and system readiness.

Project statuses shall include:

- Draft
- Active
- On hold
- In review
- Approved
- Document ready
- Published
- Closed

### FR-003 — System register

The system shall maintain one reusable record per system, including:

- System name and acronym
- Description and business purpose
- Business capabilities
- Business owner and technical owner
- Support team
- User groups and approximate user count
- Operational criticality
- Availability expectations
- Lifecycle status
- Vendor and product information
- Current-state or future-state classification
- Tags
- Effective dates
- Data classification
- Associated projects

SystemScope must allow a system to participate in multiple assessment projects without duplicating its master record.

### FR-004 — Assessment workspace

Each system assessment shall provide the following tabs:

1. Overview
2. Architecture
3. Database
4. Infrastructure
5. Integrations
6. Data and quality
7. Security and compliance
8. Findings and risks
9. Evidence
10. Validation
11. Diagrams
12. Document preview

Each tab shall show:

- Confirmed information
- Unconfirmed information
- Information gaps
- Evidence count
- Validation status
- Assigned actions
- Section completeness
- Last updated and last validated dates

### FR-005 — System architecture and technical design

The application shall capture:

- Architecture style
- Front-end technology and version
- Back-end technology and version
- Application server and runtime
- Business-logic location
- Reporting technology
- Background services
- Scheduled processes
- Document or file storage
- Authentication mechanism
- Environments
- Application dependencies
- Deployment model
- Vendor-support status
- Known technical constraints

Application components shall be stored individually with:

- Name
- Component type
- Technology
- Version
- Purpose
- Environment
- Owner
- Lifecycle status
- Support status
- Evidence
- Validation status

### FR-006 — Database assessment

The application shall capture:

- Database product, edition and version
- Database and instance names
- Hosting location
- Operating system
- Application schemas
- Shared or dedicated status
- Approximate size and annual growth
- Major table count where available
- Stored procedures or packages
- Triggers
- Database links
- Scheduled jobs
- High-availability arrangement
- Backup arrangement
- Recovery objectives
- Encryption at rest and in transit
- Vendor-support status
- Known performance issues
- Technical debt
- Ownership and support team

Detailed schema information and ERDs shall be optional and configurable by project scope.

### FR-007 — Infrastructure and hosting assessment

The application shall capture high-level information for:

- Hosting model: on-premises, cloud, SaaS or hybrid
- Hosting location or cloud region
- Application and database servers
- Operating systems
- Network zones
- Load balancers and firewalls
- Storage
- Virtualisation
- Citrix or remote-desktop dependencies
- Development, test, production and disaster-recovery environments
- Backup and recovery
- Monitoring and logging
- Availability arrangement
- Recovery Time Objective
- Recovery Point Objective
- Infrastructure owner
- External support
- End-of-life infrastructure

An environment matrix shall compare components across Development, Test, Production and Disaster Recovery.

### FR-008 — Integration catalogue

Integrations shall be stored as first-class records with:

- Name
- Source system
- Destination system
- Business purpose
- Direction
- Information exchanged
- Current, future, suspected or retired state
- Interface type
- Technology or protocol
- Frequency and schedule
- Trigger
- Volume
- Authentication
- Encryption
- Transformation
- Error handling
- Retry mechanism
- Monitoring
- Support owner
- Criticality
- Replacement impact
- Evidence
- Validation status

The application shall prevent future-state integrations from appearing as current-state facts.

### FR-009 — Data flows and batch processes

The system shall capture data flows separately from integrations where required.

A data flow shall contain:

- Source
- Destination
- Data set
- Business purpose
- Direction
- Transformation
- Storage points
- Frequency
- Security classification
- Owner
- Evidence

A batch process shall contain:

- Name and purpose
- System
- Schedule and timezone
- Upstream dependency
- Downstream dependency
- Input and output
- Runtime technology
- Typical duration
- Failure behaviour
- Retry or restart process
- Monitoring and alerting
- Operational owner
- Criticality

### FR-010 — Data structures and data quality

The application shall capture high-level data domains without requiring full physical data models.

Each data domain shall include:

- Name and business description
- Authoritative system
- Principal entities
- Approximate volume
- Historical depth
- Classification
- Retention requirement
- Data owner
- Downstream consumers
- Migration requirement

Data quality shall be assessed using:

- Completeness
- Accuracy
- Consistency
- Validity
- Timeliness
- Uniqueness
- Referential integrity
- Known duplicates
- Missing mandatory values
- Invalid codes
- Orphaned records
- Manual correction process
- Reconciliation process
- Data-quality ownership

Permitted ratings shall include:

- Good
- Acceptable
- Poor
- Unknown
- Not assessed
- Not applicable

### FR-011 — Security controls and compliance

The application shall capture market-scan-level security information, including:

- Authentication and identity provider
- Internal and external user types
- Single sign-on
- Multi-factor authentication
- Role-based access control
- Privileged access
- User provisioning and deprovisioning
- Access review
- Service accounts
- Database access controls
- Data classification
- Personal or sensitive information
- Encryption at rest and in transit
- Secrets management
- Backup encryption
- Audit logging
- Security monitoring
- Vulnerability and patch management
- Incident management
- Penetration testing
- Business continuity and disaster recovery
- Records retention and disposal
- Applicable legislation, standards and organisational policies

Security information shall have visibility classifications:

- General
- Internal
- Restricted
- Security appendix only
- Excluded from generated documents

### FR-012 — Discovery source management

Users shall be able to register or upload:

- Meeting transcripts
- Architecture documents
- Screenshots
- Walkthrough notes
- Emails
- Database reports
- Interface specifications
- Infrastructure documents
- Source-code repository references
- SME interviews
- Existing assessments

Each source shall record:

- Title
- Source type
- Date
- Participants or author
- Related systems
- Uploaded by
- Completeness
- Reliability
- Confidentiality
- Processing status
- File or external reference

### FR-013 — AI-assisted extraction

The application should support AI-assisted extraction of:

- System names
- Technologies and versions
- Components
- Databases
- Infrastructure
- Integrations
- Data flows
- Batch processes
- Security controls
- Findings
- Risks
- Decisions
- Actions
- Information gaps
- Follow-up questions

AI output must be stored as proposed claims and shall not automatically become an approved fact.

Every extracted claim shall contain:

- Claim statement
- Related system
- Assessment domain
- Speaker or author
- Evidence excerpt
- Timestamp, page or section
- Confidence
- Claim type
- Validation status

Claim types shall include:

- Explicit statement
- Inference
- Assumption
- Unknown
- Conflict

### FR-014 — Evidence-linked findings

Each important finding or fact shall support one or more evidence references.

An evidence reference shall identify:

- Source
- Page, timestamp, section or image location
- Supporting excerpt or observation
- Source owner
- Evidence date
- Reliability rating

The system shall allow users to navigate from a system fact to its evidence and from evidence to all derived claims.

### FR-015 — Validation workflow

The validation lifecycle shall support:

1. Captured
2. AI extracted
3. Analyst reviewed
4. SME review requested
5. SME validated
6. Technical review completed
7. Security review completed where required
8. Approved
9. Document ready
10. Published

For each assigned claim, the reviewer shall be able to:

- Confirm
- Confirm with correction
- Reject
- Mark as unsure
- Request evidence
- Assign to another reviewer
- Add a comment

The original claim and all corrections must remain in the audit history.

### FR-016 — Information-gap management

SystemScope shall compare available information with the configured assessment template and automatically identify missing information.

Each gap shall include:

- System
- Domain
- Missing information
- Reason required
- Priority
- Market-scan impact
- Assigned owner
- Due date
- Status
- Resolution and evidence

Statuses shall include:

- Open
- Assigned
- Awaiting response
- Resolved
- Accepted limitation
- Deferred by scope
- Not applicable

### FR-017 — Questionnaire generation

The system shall generate an SME questionnaire from information gaps and low-confidence claims.

The questionnaire shall:

- Group questions by system and assessment domain.
- Avoid questions already answered by validated evidence.
- Permit the SME to answer through a secure review experience.
- Allow evidence attachment.
- Convert approved responses into validated facts.

### FR-018 — Findings, risks and actions

Findings shall include:

- Title and description
- System and domain
- Finding type
- Severity
- Business impact
- Technical impact
- Evidence
- Confidence
- Validation status
- Recommendation
- Owner
- Status

Risk records shall include likelihood, consequence, overall rating, treatment, owner and review date.

Actions shall be linkable to systems, gaps, findings, risks, questions and validation requests.

### FR-019 — Search and discovery

SystemScope shall support:

#### Structured search and filtering

- System
- Technology
- Version
- Database
- Hosting model
- Business owner
- Technical owner
- Criticality
- Lifecycle status
- Integration method
- RFI inclusion
- Risk severity
- Validation status
- Document readiness
- Data classification

#### Full-text search

Search shall cover approved system descriptions, findings, evidence text, transcripts, documents, risks, questions, answers, integration descriptions and reviewer comments, subject to permissions.

#### Natural-language search

Users should be able to ask questions such as:

- Which systems use Oracle Forms?
- Which systems have unvalidated integrations?
- What depends on AQUIS?
- What information is missing for AQUIS?
- Which applications are not ready for the RFI?

Natural-language answers must:

- Use permission-filtered structured data and evidence.
- Distinguish confirmed, inferred and unknown information.
- Link to the supporting system, record and evidence.
- Avoid presenting an unvalidated claim as a fact.

### FR-020 — Diagram generation

SystemScope shall generate or assist with:

- System context diagrams
- Application component diagrams
- Deployment diagrams
- Integration landscape diagrams
- Data-flow diagrams
- Current-state and future-state diagrams

Diagram elements shall be generated from structured records where possible.

Visual conventions shall distinguish:

- Confirmed components
- Unconfirmed components
- Current-state relationships
- Future-state relationships
- External systems
- Restricted details

Users must be able to adjust layout and labels without breaking the underlying record relationships.

### FR-021 — Completeness and readiness

SystemScope shall calculate both:

- Information completeness
- Validation completeness

The initial market-scan weighting shall be configurable, with the following default:

| Domain | Weight |
|---|---:|
| System architecture and technical design | 25% |
| Database | 20% |
| Infrastructure and hosting | 15% |
| Integrations, data flows and batch processes | 20% |
| Data structures and data quality | 10% |
| Security controls and compliance | 10% |

Readiness calculations shall recognise `Deferred by scope` and `Not applicable` without penalising the score.

Document readiness shall consider:

- Required fields completed
- Required evidence attached
- High-impact claims validated
- Conflicts resolved
- Critical gaps explained
- Required reviewers approved

### FR-022 — Dashboard enhancements

The existing dashboard shall be enhanced with:

- Systems in scope
- Information completeness
- Validation completeness
- Document readiness
- Open high and critical findings
- Open information gaps
- Overdue validation requests
- Unsupported technologies
- Systems by lifecycle status
- Systems by hosting model
- Integration count and criticality
- Active assessment projects
- Recently validated facts
- Documents ready for generation

All dashboard cards shall support drill-down to the underlying records.

### FR-023 — Document generation

Users shall be able to generate a market-scan document from approved structured assessment data.

Generation options shall include:

- Template
- Project
- Systems
- Assessment date
- Current-state or future-state scope
- Internal or external audience
- Include diagrams
- Include findings and risks
- Include information gaps
- Include security appendix
- Word or PDF output

The default document structure shall be:

1. Executive summary
2. Scope and approach
3. Landscape overview
4. System overview
5. System architecture and technical design
6. Database
7. Infrastructure and hosting
8. Integrations, data flows and batch processes
9. Data structures and data quality
10. Security controls and compliance
11. Risks and constraints
12. Information gaps and limitations
13. Appendices

Appendices may contain:

- Source register
- Validation register
- Application component inventory
- Database inventory
- Integration catalogue
- Batch process catalogue
- Glossary
- Detailed diagrams

### FR-024 — Document generation rules

Generated documents shall:

1. Include only approved findings by default.
2. Label assumptions, inferences and unverified information clearly when deliberately included.
3. Never convert an unknown value into a presumed fact.
4. Keep current-state and future-state content separate.
5. Exclude records not permitted for the selected audience.
6. Include source references in internal editions.
7. State known limitations and missing evidence.
8. Record the project, assessment and data versions used.
9. Preserve each generated document as an immutable snapshot.
10. Permit regeneration after approved information changes.

### FR-025 — Document preview and editorial control

Before generation, users shall be able to:

- Preview every section.
- View the records used to construct each paragraph or table.
- Exclude a finding from the document without deleting it.
- Add approved editorial context.
- Reorder optional sections.
- Choose diagram versions.
- Resolve warnings about unvalidated or restricted content.

Manual editorial text shall be stored separately from generated text and shall be versioned.

### FR-026 — Versioning and effective dating

The application shall retain:

- Current validated value
- Historical values
- Effective-from and effective-to dates
- Source and evidence
- Change reason
- Changed by
- Validation record

Users shall be able to view a system as at a historical assessment date.

### FR-027 — Audit

The existing Audit capability shall record:

- Record creation and changes
- Claim extraction
- Evidence addition or removal
- Validation decisions
- Approval decisions
- Permission changes
- Document generation
- Export and download
- Search of restricted content where required

Audit history must be immutable to ordinary users.

### FR-028 — Import and export

The system should support:

- CSV or Excel import of system, technology and integration inventories
- JSON import and export for structured assessment data
- Word and PDF document generation
- CSV or Excel export of registers
- Diagram export to SVG or PNG

Import shall include preview, validation, duplicate detection and error reporting.

## 9. Market-scan document content model

Each generated statement shall be traceable to one or more approved records.

Example structured data:

```text
System: AQUIS
Domain: Architecture
Attribute: Front-end technology
Value: Oracle Forms
Evidence: AQUIS walkthrough transcript at 00:23
Confidence: High
Validation status: Confirmed
Document visibility: Market scan
```

Example generated text:

> AQUIS is an internal legacy application using an Oracle Forms front end. Its detailed component architecture and relationship with the Groundwater application require further validation.

## 10. AQUIS example configuration

The initial AQUIS assessment should contain:

| Item | Initial value | Status |
|---|---|---|
| System | AQUIS | Confirmed |
| Front end | Oracle Forms | Awaiting SME confirmation |
| Database | Oracle Database | Inferred; evidence required |
| Related system | Groundwater | Relationship requires clarification |
| Drill-log relationship | Possible | Requires clarification |
| External portal | Future-state requirement | Not current-state fact |
| Internal reviewer application | Future-state requirement | Not current-state fact |
| Transcript completeness | Incomplete | Major evidence gap |

SystemScope should automatically generate questions such as:

- What does AQUIS stand for?
- What business functions does it support?
- Which Oracle Forms modules are used?
- Which Oracle version, database and schemas support AQUIS?
- Does AQUIS share infrastructure or data with Groundwater?
- What systems provide data to AQUIS?
- What systems consume AQUIS data?
- What batch processes and scheduled jobs operate?
- Where is AQUIS hosted?
- What security and access controls apply?

## 11. User experience requirements

### 11.1 Navigation

Recommended primary navigation:

- Dashboard
- Landscapes
- Projects
- Systems
- Assessments
- Integrations
- Findings
- Requirements
- Actions
- Documents
- Audit

Evidence, validation, diagrams and documents should also be accessible contextually within a project and system assessment.

### 11.2 Assessment page

The assessment page shall provide:

- Sticky system header with status and readiness
- Domain navigation
- Save-as-draft
- Inline validation status
- Evidence side panel
- Comments and activity
- Information-gap indicator
- Reviewer assignment
- Document inclusion control

### 11.3 Usability

- Forms must support progressive disclosure so simple assessments are not overwhelmed by optional fields.
- Required fields must be driven by the project template.
- Repeated records such as integrations must support table and detail views.
- Unknown, unassessed and not applicable must be easy to record.
- Users must be warned before publishing unvalidated content.
- Search results must clearly display system, record type, status and evidence.

## 12. Non-functional requirements

### NFR-001 — Security

- Use organisation-based isolation.
- Apply role-based and record-sensitive authorisation.
- Enforce least privilege.
- Protect restricted evidence and security records.
- Encrypt data in transit and at rest.
- Audit administrative and publication actions.

### NFR-002 — Performance

- Common dashboard and system pages should load within three seconds under normal operating conditions.
- Structured search should normally return within two seconds.
- Full-text and natural-language search should normally return within five seconds, excluding unusually large evidence processing.
- Long-running AI extraction and document generation must run as background jobs with visible progress.

### NFR-003 — Reliability

- Background jobs must support retry and failure reporting.
- Document generation must be deterministic for a fixed assessment version and template version.
- Failed imports or AI processing must not corrupt approved records.

### NFR-004 — Traceability

- Every generated document section must identify its contributing records internally.
- Every approved fact must retain source, evidence and validation history.
- Every generated document must record the exact assessment snapshot used.

### NFR-005 — Accessibility

- The web interface should target WCAG 2.2 AA.
- Keyboard navigation, focus states, labels, contrast and accessible tables must be supported.

### NFR-006 — Privacy

- Access to transcripts and evidence must follow assigned permissions.
- Sensitive tokens, credentials and personal information detected in uploaded material should be flagged for redaction.
- External documents must omit restricted information automatically.

### NFR-007 — Extensibility

- Assessment templates, fields, ratings, domains and document sections must be configurable.
- The data model must support assessment types beyond market scans, including current-state reviews, cloud readiness, security assessments and modernisation planning.

## 13. Suggested technical implementation

The detailed implementation should align with the existing SystemScope codebase. A suitable logical architecture is:

```text
Web client
  -> Application API
      -> Assessment service
      -> Evidence and validation service
      -> Search service
      -> Diagram service
      -> Document generation service
      -> Background job processor
  -> Relational database
  -> Object/file storage
  -> Search index
  -> AI model provider through an abstraction layer
```

Technical requirements:

- Store master and assessment data in a relational database.
- Store original files in secured object storage.
- Store extracted text with source-location references.
- Use background jobs for transcription processing, extraction, indexing and document generation.
- Implement full-text search first; add semantic or vector retrieval only when justified.
- Use an AI provider abstraction so extraction and summarisation can be tested and changed.
- Use template-based Word generation before PDF conversion.
- Store diagram definitions as versioned structured data, not only images.
- Enforce authorisation before search retrieval and again before answer generation.

## 14. API capability requirements

The backend should provide APIs for:

- Landscapes and projects
- Systems and assessments
- Assessment responses
- Components and technologies
- Databases and infrastructure
- Integrations, data flows and batch processes
- Data domains and quality assessments
- Security controls and compliance obligations
- Sources, claims and evidence
- Findings, gaps, risks, requirements and actions
- Validation requests and responses
- Search
- Diagrams
- Document templates, previews and generation jobs
- Audit history

All list APIs must support paging, filtering, sorting and permission enforcement.

## 15. Delivery phases

### Phase 1 — Structured assessment foundation

Deliver:

- Systems register
- Project-to-system scope management
- Six assessment domains
- Components, databases and infrastructure
- Integrations, data flows and batch processes
- Data domains and security controls
- Findings, gaps, questions and actions
- Basic completeness dashboard

### Phase 2 — Evidence and validation

Deliver:

- Source upload and register
- Evidence linking
- Claims
- SME review workflow
- Confirm, correct, reject and request-evidence actions
- Validation completeness
- Versioning and enhanced audit

### Phase 3 — Search and diagrams

Deliver:

- Structured and full-text search
- Permission-aware natural-language search
- System context, integration and data-flow diagrams
- Current-state and future-state views

### Phase 4 — Document generation

Deliver:

- Market-scan Word template
- Document preview
- Audience and visibility filtering
- Word and PDF generation
- Immutable snapshots
- Source and validation appendices

### Phase 5 — AI-assisted discovery

Deliver:

- Transcript and document extraction
- Claim and gap detection
- Questionnaire generation
- Suggested findings, risks and diagrams
- Human review controls and evaluation metrics

## 16. Minimum viable product

The MVP should focus on producing a reliable market-scan document without requiring AI.

MVP scope:

- Project and systems in scope
- System assessment with six domains
- Structured component, database and integration registers
- Findings, information gaps and actions
- Evidence references
- Manual validation statuses
- Completeness and readiness dashboard
- Search by system, technology, finding and status
- Word document generation from an approved template
- Audit trail

AI extraction, natural-language search and automatic diagrams should follow after the structured foundation is working.

## 17. Acceptance criteria

The first market-scan release will be acceptable when:

1. An assessment lead can create a market-scan project and add the seven systems in scope.
2. An analyst can capture all six required assessment domains for each system.
3. Architecture components, databases, integrations and batch processes can be stored as structured records.
4. Every material finding can link to evidence and a validation status.
5. Information gaps can be assigned and tracked.
6. Deferred and not-applicable areas do not reduce completion unfairly.
7. Users can search across systems, technologies, integrations, findings and gaps.
8. Permission rules prevent restricted security content from appearing to unauthorised users.
9. An assessment lead can preview and generate a Word market-scan document.
10. The generated document contains only records permitted for the selected audience.
11. The generated document distinguishes confirmed information, assumptions and unknowns.
12. SystemScope records the assessment and template versions used for generation.
13. Dashboard results link to underlying records.
14. All validation and publication activities are recorded in the audit trail.

## 18. Out of scope for the first release

- Complete enterprise architecture modelling equivalent to specialised EA suites
- Automated source-code reverse engineering
- Automated physical database ERD generation
- Continuous infrastructure discovery
- Replacement-product procurement scoring
- Supplier portal and tender management
- Automatic approval of AI-generated claims
- Detailed security penetration testing
- Real-time operational monitoring of assessed systems

## 19. Future opportunities

Once the market-scan foundation is established, SystemScope may expand into:

- Application portfolio management
- Technology lifecycle and end-of-support tracking
- Cloud and modernisation readiness
- Architecture decision records
- Capability mapping
- Cost and licence analysis
- Dependency impact analysis
- Supplier response comparison
- Migration-wave planning
- Continuous evidence refresh
- Organisation-wide architecture knowledge search

## 20. Recommended implementation priority

The immediate build priority should be:

1. Systems register
2. Six-domain assessment workspace
3. Structured integration and component registers
4. Evidence, gaps and validation
5. Market-scan Word generation
6. Structured and full-text search
7. Diagrams
8. AI extraction and natural-language search

This order ensures that AI and document generation operate on reliable structured information rather than ungoverned free text.

