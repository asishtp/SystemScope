# SystemScope 2.0 - Detailed Product Requirements Document (PRD)

## 1. Product Vision

SystemScope is an enterprise assessment, discovery, application portfolio management, architecture governance, and modernisation planning platform.

The platform shall provide a single repository capable of capturing:

- Systems and applications
- Business capabilities
- Business processes
- Information assets
- Data models
- Technologies
- Integrations
- Stakeholders
- Findings
- Risks
- Requirements
- Actions
- Decisions
- Evidence
- Documents
- Assessments
- Market scan results
- Modernisation roadmaps

---

# 2. Core Domain Model

Project
- Contains systems, assessments, findings, requirements and documents.

System
- Represents an application, platform, service or technology product.

Capability
- Represents what a system does.

Business Process
- Represents a workflow supported by one or more systems.

Information Asset
- Represents a business data entity.

Logical Data Model
- Represents entities, tables and schema artefacts.

Technology Component
- Represents products, platforms and infrastructure.

Integration
- Represents movement of information between systems.

Finding
- Evidence-backed observation.

Risk
- Potential adverse outcome.

Requirement
- Future-state need.

Action
- Task required to address findings and risks.

Decision
- Architecture or strategy decision.

Evidence
- Supporting documentation.

---

# 3. Systems Module Requirements

Fields
- Name
- Description
- Business Owner
- Technical Owner
- Vendor
- Version
- Lifecycle Status
- Criticality
- Environment
- Hosting Model
- Authentication Method
- Support Model

Lifecycle States
- Active
- Strategic
- Legacy
- Modernising
- Replacing
- Retiring
- Retired

Relationships
- System to Capability
- System to Information Asset
- System to Process
- System to Technology
- System to Integration
- System to Finding
- System to Requirement

---

# 4. Capability Management Module

Purpose
Capture business capabilities independent of system implementation.

Fields
- Name
- Description
- Domain
- Capability Category
- Criticality
- Maturity Score
- Owner

Hierarchy Support
- Level 1 Capability
- Level 2 Capability
- Level 3 Capability

Reporting
- Capability heatmaps
- Capability overlap reports
- Capability coverage reports

---

# 5. Business Process Repository

Fields
- Process Name
- Purpose
- Trigger
- Inputs
- Outputs
- Frequency
- Process Owner
- Automation Level
- Pain Points

Automation Levels
- Manual
- Semi-Automated
- Automated

Relationships
- Process to Capability
- Process to System
- Process to Information Asset

---

# 6. Information Asset Register

Purpose
Capture business data independently from databases.

Fields
- Asset Name
- Description
- Business Definition
- Data Owner
- Steward
- Classification
- Retention Period
- System Of Record
- Regulatory Requirements

Classifications
- Public
- Internal
- Sensitive
- Restricted

Relationships
- Information Asset to System
- Information Asset to Capability
- Information Asset to Integration

---

# 7. Data Model Repository

Purpose
Store logical and physical schemas.

Objects
- Logical Entity
- Physical Table
- Column
- Relationship

Capabilities
- Schema upload
- ERD visualisation
- Table explorer
- Relationship mapping
- Schema comparison
- Impact analysis

Example
Logical Entity: Water Level
Physical Table: GW_WLVDETS
Columns: RDATE, MEASUREMENT, QUALITY

---

# 8. Technology Inventory

Categories
- Front-end
- Back-end
- Database
- Middleware
- Integration
- Reporting
- Analytics
- GIS
- Identity
- Hosting
- Cloud

Fields
- Product
- Vendor
- Version
- Support Status
- End of Life Date
- Deployment Type

---

# 9. Integration Catalogue

Fields
- Name
- Purpose
- Source System
- Target System
- Integration Type
- Protocol
- Data Format
- Frequency
- Criticality
- Support Team

Integration Types
- API
- Batch
- File Transfer
- Database Link
- Event Driven
- Manual

---

# 10. Stakeholder Registry

Fields
- Name
- Role
- Organisation
- Email
- Phone
- Responsibility

Roles
- Business Owner
- Product Owner
- Architect
- SME
- Vendor
- Support Team

---

# 11. Evidence Management

Purpose
Support evidence-based assessments.

Evidence Types
- Interview
- Workshop
- Meeting Notes
- PDF
- Architecture Diagram
- Data Model
- Source Code
- Screenshot

Features
- Upload
- Tagging
- Versioning
- Traceability

Relationships
- Evidence to Finding
- Evidence to Requirement
- Evidence to Risk

---

# 12. Findings Register

Fields
- Title
- Description
- Category
- Severity
- Confidence
- Owner
- Status

Categories
- Observation
- Risk
- Dependency
- Information Gap
- Technical Debt

Workflow
Draft -> Submitted -> Approved -> Closed

---

# 13. Risk Management

Fields
- Risk Name
- Description
- Likelihood
- Impact
- Exposure Score
- Mitigation Plan
- Owner

Relationships
Finding -> Risk -> Requirement -> Action

---

# 14. Requirements Management

Fields
- Requirement ID
- Title
- Description
- Priority
- Category
- Source Finding
- Acceptance Criteria

Categories
- Functional
- Non Functional
- Architecture
- Integration
- Security
- Data

---

# 15. Actions Management

Fields
- Action
- Assignee
- Due Date
- Status
- Linked Finding
- Linked Requirement

Statuses
- Open
- In Progress
- Blocked
- Completed

---

# 16. Decision Register

Fields
- Decision
- Context
- Options Considered
- Selected Option
- Rationale
- Owner
- Date

Features
- ADR support
- Traceability
- Audit history

---

# 17. Assessment Framework

Domains
- Business
- Process
- Technology
- Data
- Integration
- Security
- Operations
- Vendor
- Cloud Readiness
- Modernisation

Question Types
- Yes/No
- Rating
- Text
- Multi-select

Outputs
- Completion Score
- Risk Score
- Confidence Score

---

# 18. Market Scan Module

Capabilities
- Vendor catalogue
- Product catalogue
- Capability comparison
- Gap analysis
- Scoring engine

Output Reports
- Market scan report
- Vendor comparison report
- Product fit assessment

---

# 19. Knowledge Graph

Visual relationships between:
- Systems
- Capabilities
- Processes
- Information Assets
- Technologies
- Integrations
- Findings
- Requirements

Features
- Impact analysis
- Relationship explorer
- Dependency tracing

---

# 20. AI Assessment Assistant

Inputs
- PDFs
- Schemas
- Word Documents
- Meeting Notes
- Screenshots

AI Outputs
- Capabilities
- Processes
- Information Assets
- Technologies
- Findings
- Risks
- Requirements

Workflow
Upload -> Extraction -> Analyst Review -> Approval -> Publish

---

# 21. Reporting Requirements

Generate:
- System Assessment
- Current State Architecture
- Target State Architecture
- Market Scan Report
- Executive Summary
- Capability Map
- Integration Catalogue
- Risk Register
- Requirements Catalogue
- Modernisation Assessment

---

# 22. Dashboard Requirements

Executive Dashboard
- Systems assessed
- Risks by severity
- Findings by category
- Modernisation candidates
- Capability coverage

Architect Dashboard
- Technology inventory
- Integration landscape
- Data assets
- Dependencies

---

# 23. Security Requirements

- Azure AD authentication
- Role Based Access Control
- Audit trail
- Version history
- Approval workflows
- Document access controls

Roles
- Administrator
- Architect
- Analyst
- Reviewer
- Read Only

---

# 24. Non Functional Requirements

Performance
- Page load < 3 seconds
- Search results < 2 seconds

Scalability
- 10,000+ systems
- 100,000+ findings
- 1,000,000+ evidence records

Availability
- 99.9%

Audit
- Full history retained

---

# 25. GWDB Use Case

The platform shall support storing:

System: GWDB

Capabilities:
- Bore Registration
- Water Level Monitoring
- Water Quality Monitoring
- Pump Testing
- Geological Logging

Information Assets:
- Bore
- Aquifer
- Water Level
- Water Quality Result

Logical Data Models:
- GW_REGDETS
- GW_WLVDETS
- GW_WATANLS
- GW_RESULTS

Evidence:
- GWDB_CORE_SMD
- GWDB_AUX_SMD
- GWDB_DRILL_SMD
- GWDB_NGIS_SMD
- GWDB_FUNDEF

Findings:
- Oracle Forms dependency
- RN-centric architecture
- Multiple external integrations

Requirements:
- API-first architecture
- Modern web UI
- Digital workflows
