# SystemScope Product Enhancement Roadmap

## Purpose

SystemScope has evolved beyond an application inventory and is becoming an Enterprise Assessment, Architecture Discovery, Modernisation Planning, and Market Scan platform.

The objective of these enhancements is to enable SystemScope to:

- Assess complex enterprise applications
- Capture business and technical architecture
- Support market scans and RFI activities
- Support application rationalisation
- Support modernisation and replacement programmes
- Generate evidence-based recommendations
- Trace findings through to future-state requirements

---

# Current Capability Model

```text
Project
 ├── Systems
 ├── Assessments
 ├── Integrations
 ├── Findings
 ├── Requirements
 └── Documents
```

# Target Capability Model

```text
Project
 ├── Systems
 │    ├── Business Capabilities
 │    ├── Information Assets
 │    ├── Business Processes
 │    ├── Technologies
 │    ├── Integrations
 │    ├── Stakeholders
 │    ├── Risks
 │    └── Evidence
 │
 ├── Assessments
 │    ├── Domain Scores
 │    ├── Questionnaires
 │    ├── Findings
 │    └── Recommendations
 │
 ├── Requirements
 ├── Actions
 ├── Documents
 └── Audit
```

# Features

## 1. Business Capability Model
Capture what a system does rather than only what technology it uses.

## 2. Information Asset Register
Capture business data assets independent of database tables.

## 3. Business Process Inventory
Record operational workflows performed by the system.

## 4. Architecture Fact Model
Replace free-text technology tags with structured architecture records.

## 5. Enhanced Integration Catalogue
Move beyond source and destination systems.

## 6. Evidence Registry
Support evidence-based assessments.

## 7. Confidence Scoring
Provide evidence confidence levels.

## 8. Stakeholder Registry
Capture business and technical ownership.

## 9. Dedicated Risk Register
Separate risks from findings.

## 10. Decision Register
Capture architecture and strategy decisions.

## 11. Capability Matrix
Compare capabilities across systems.

## 12. Assessment Questionnaire Engine
Standardise assessments.

## 13. Strategy Assessment
Support Invest, Maintain, Modernise, Replace, Consolidate and Retire decisions.

## 14. Data Flow Mapping
Capture end-to-end information movement.

## 15. AI Assessment Assistant
Extract capabilities, integrations, technologies, findings, risks and requirements from uploaded artefacts.

---

# Recommended Delivery Priority

Implementation status as of 27 August 2026. Detail lives in `docs/SystemScope-Phase1-Design.md`.

## Phase 1

| Item | Status |
| --- | --- |
| Business Capabilities | **Done** — catalog + GWDB L1/L2 coverage (`#/capabilities`) |
| Information Assets | **Done** — catalog + SoR coverage (`#/information-assets`) |
| Enhanced Integrations | **Done** — Type / Protocol / Format + reusable catalog |
| Evidence Registry | **Done** — HTTPS multi-link (`EvidenceLink`); five GWDB SMD sources |
| Questionnaire Engine | **Partial** — Workshop v1 still in use; template v2 is remaining (Phase 1 PR 5) |
| GWDB proving slice (findings, requirements, search, documents) | **Remaining** (Phase 1 PR 6) |

## Phase 2 (not started)

- Risk Register (split from findings)
- Stakeholder Registry
- Decision Register
- Capability Matrix

## Phase 3 (not started)

- Data Flows (end-to-end mapping; per-system `DataFlow` already exists)
- Architecture Fact Repository / shared technology catalogue
- AI Assessment Assistant (real model; claims review workflow already exists)

---

# Long-Term Vision

SystemScope evolves from an Application Inventory into an Enterprise Assessment Platform supporting:

- Application Portfolio Management
- Enterprise Architecture
- Market Scans
- RFI/RFP Activities
- Modernisation Programmes
- Rationalisation Assessments
- Technology Roadmaps
- Digital Transformation Planning
- Evidence-Based Architecture Governance
