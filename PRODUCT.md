# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a bank risk analyst working with customer, credit-history, and transaction data inside the bank.

The analyst needs to find suspicious customers and operations, investigate the reasons behind each signal, record a controlled human decision, and prepare an итоговый report for management.

Secondary audience: managers and bank security or compliance stakeholders who consume the final analytical report but do not perform the detailed investigation themselves.

## Product Purpose

Risk Ledger helps a bank risk analyst turn heterogeneous banking extracts into a prioritized investigation queue. It recognizes the structure of an uploaded source, evaluates customer and transaction risk, explains the strongest signals in business language, and keeps the analyst in control of the final decision.

Success means that an analyst can:

1. quickly identify the highest-priority suspicious records;
2. understand why each customer or operation was flagged;
3. investigate related customers, accounts, counterparties, and operations;
4. record the investigation outcome and supporting comment;
5. prepare a clear final report for management.

The model output is a reason to investigate, not proof of fraud and not an automatic blocking decision.

## Positioning

Risk Ledger combines automatic schema recognition, customer-risk scoring, transaction-anomaly detection, human-readable explanations, relationship analysis, and a human-confirmed investigation trail in one local workflow.

Unlike a fixed-schema scoring screen, it accepts heterogeneous local extracts and builds an analysis plan from the fields and entities it recognizes. Unlike an autonomous enforcement system, it preserves a human decision as the authoritative investigation outcome.

## Operating Context

The primary deployment is a local installation inside the bank. Analysts work with local data extracts rather than connecting the product directly to production banking systems.

The workflow is:

1. upload a supported local source;
2. review the recognized structure, analysis profiles, and data period;
3. run customer-risk and/or transaction-anomaly analysis;
4. review the highest-risk records first;
5. inspect explanations, source values, related operations, and entity relationships;
6. assign an investigation status and comment;
7. export investigation results and prepare a management report;
8. end the session and remove temporary analysis data.

## Capabilities and Constraints

- Supported sources: CSV, JSON, JSONL/NDJSON, SQL data dumps, SQLite/SQLite3/DB, and BSON.
- The application automatically inventories datasets and maps source fields to a canonical banking schema.
- Separate analysis profiles exist for customer risk and suspicious operations.
- Customer risk uses a supervised CatBoost model with SHAP-based explanations.
- Transaction analysis combines anomaly detection, deterministic rules, and relationship signals.
- Suspicious records are ranked from highest to lowest priority.
- The main interface uses Russian business terminology and must not expose raw JSON or model variable names as the primary explanation.
- Analysts can record investigation statuses and comments; only explicitly confirmed human decisions become feedback labels.
- The product supports result export, including a review-only queue and relationship data.
- Current default source limits are 500 MiB and 1,000,000 logical records.
- The primary operating mode is local deployment inside the bank. A permanent cloud deployment model is not yet decided.
- The application does not automatically block customers, declare legal guilt, or replace the analyst's decision.
- Temporary source and result data must be removable at the end of a session.

## Brand Commitments

- Product name: Risk Ledger.
- Language: Russian for the working interface and analyst-facing explanations.
- Voice: precise, restrained, evidence-based, and understandable to banking professionals without requiring data-science terminology.
- Risk language must distinguish a model signal from confirmed fraud.
- The product should feel like a professional banking investigation instrument rather than a generic AI dashboard.

## Evidence on Hand

- Product description and operating instructions: `README.md`.
- Implemented frontend routes and workflows: `frontend/src/routes/`, `frontend/src/components/`, and `frontend/src/layout/`.
- Client-risk model artifacts: `backend/artifacts/current/`.
- Transaction-risk model artifacts: `backend/artifacts/transaction/current/`.
- Local source examples: `data/`.
- Backend unit and integration tests: `backend/tests/`.
- Frontend behavior and accessibility tests: `frontend/tests/`.

No customer testimonials, production-bank performance claims, or legal/compliance certifications are currently documented. Future design and copy must not fabricate them.

## Product Principles

1. Prioritize action: the analyst should immediately see what requires attention first.
2. Explain the signal: every risk score must lead to understandable evidence and context.
3. Preserve human control: investigation decisions belong to the analyst, not the model.
4. Support an auditable workflow: findings, statuses, comments, relationships, and exports must form a coherent investigation record.
5. Protect banking data: local processing and deliberate session cleanup are core product constraints.

## Accessibility & Inclusion

The interface must remain understandable without relying on color alone. Risk levels, states, warnings, and actions require text labels in addition to visual treatment. Keyboard navigation, visible focus, readable contrast, scalable text, and responsive layouts are required for the working web interface.
