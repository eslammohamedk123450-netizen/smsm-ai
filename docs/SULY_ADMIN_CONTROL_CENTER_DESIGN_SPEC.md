# SULY Admin Control Center — Approved UX & Functional Design Specification

> **Document type:** Product UX, information architecture, interaction, and functional design specification.  
> **Working branch:** `develop`  
> **Production branch:** `release/v1` — protected; this document does not authorize production changes.  
> **Relationship to canonical plans:** This document governs the Admin Control Center experience and follows the existing project roadmap (`plan.md`), the comprehensive acceptance/test master plan (`docs/SULY_COMPREHENSIVE_TEST_MASTER_PLAN.md`), current security invariants, and explicit owner decisions. It does not authorize changes to production or bypass the existing roadmap.  
> **Implementation status:** In progress on `develop`. The checklist below records code implementation separately from CI, manual, security, and production acceptance.

---

## 0. Implementation progress — `develop` only

> Status is deliberately evidence-based: `[x] Implemented` means the corresponding source change is present on `develop`; it does not mean CI, manual/device, security, or production acceptance has passed. Tests remain tracked in the comprehensive test master plan.

### Foundation and shared shell
- [x] Inventory the existing protected admin routes, shared Expo shell, theme provider, server-backed admin service, and currently available section screens.
- [x] Replace the legacy grouped navigation with the exact 12 approved top-level domains while retaining the existing destinations and the HIMS entry.
- [x] Add a desktop collapsible sidebar with expanded labels by default, icon-only collapsed mode, accessible labels, hover/focus tooltips, and persisted local preference.
- [x] Add Web `/` and `Ctrl+K` / `Cmd+K` shortcuts for the navigation search; include published custom admin pages in search and keep their links nested under System & Security so the shell retains exactly 12 top-level domains.
- [x] Apply the approved Midnight Gold Luxury palette through the shared theme tokens while retaining Light, Dark, and System theme selection.

### Providers & Models
- [x] Add a Table / Cards presentation switch to the unified model catalog; both views share the same loaded registry, filters, search, and lifecycle status.
- [x] Add a read-only model detail inspector to both catalog presentations, showing provider identity, service type, lifecycle/operational status, and only registered capability keys.
- [x] Link catalog detail to the existing capability review, operations/health, pricing, audit, provider, and model-management pages without creating new data paths.
- [ ] Complete the remaining model detail (including model-specific historical price/health/audit timelines) and five-step Add Model workflow only where existing provider contracts, evidence, pricing, and reviewed server operations support it.
- [ ] Confirm every capability/test action and model state transition against its existing server authorization and evidence source.

### Current implementation blockers
- The repository currently has no admin RPC for registering a new canonical `suly_model_registry` model. The existing `sync-models` Edge Function only discovers and inserts missing chat models into `ai_models`; its insert path assigns placeholder defaults (including context window and zero prices) and keeps them disabled. Do not use those placeholders as verified specifications or route a manual Add Model wizard through that discovery action.
- The five-step Add Model wizard remains blocked until a reviewed server-side registration contract can create a Draft/Pending Validation model without guessed limits/prices, preserve provider-specific validation, and keep new records out of routing until separately verified. No client-side direct insert or ad-hoc schema/RPC was introduced to bypass this boundary.

### Remaining admin domains and acceptance
- [x] Add route-aware breadcrumbs to the desktop shell without replacing the domain pages’ own content titles.
- [x] Add working administrator session menu and sign-out through the existing Supabase Auth session; show explicit unavailable states for help and notifications because no verified destination/event source is configured.
- [x] Add responsive, localized section breadcrumbs and page titles to the existing provider, model, user, wallet, pricing, circuit-breaker, and central-Agent pages.
- [x] Add responsive RTL/LTR breadcrumbs on mobile HIMS, Ads & Rewards, and Activity & Audit pages, while reusing the desktop shell breadcrumb at wide widths.
- [x] Extend the responsive mobile breadcrumb to Finance & Profit, Support, and Conversations pages.
- [x] Extend the responsive mobile breadcrumb to System & Security, Overview, and the model-control landing page.
- [x] Extend the responsive mobile breadcrumb to the unified capability directory, unified model catalog, and media model catalog.
- [x] Add responsive mobile breadcrumbs to Credits & Wallet, Users & Accounts, published custom pages, Page Builder, Composio, Tavily, and the friction dashboard.
- [ ] Complete remaining domain-specific filters and consistent loading/empty/error/unknown/no-permission states.
- [x] Add 7-day and 30-day consumption windows to the Overview chart and show when its 2000-row data cap may make the view partial.
- [x] Keep the Overview alert state explicitly unavailable when model-health/error evidence is incomplete instead of showing a false “no alerts” result.
- [ ] Complete the remaining operational Overview metrics, service-health evidence, and real task/alert links without inventing unavailable values.
- [ ] Review Routing & Agent controls against the single central Agent and existing bounded worker/task execution model.
- [ ] Review Pricing & Plans, Credits & Wallet, Users & Accounts, Ads & Rewards, and Finance & Profit against existing audited RPCs and immutable financial history.
- [ ] Review Activity & Audit and HIMS & Content while preserving HIMS as a core entitlement/resource capability.
- [ ] Complete System & Security, notification availability, exports, localization, keyboard accessibility, and responsive Web/Android/iOS presentation.
- [ ] Record implementation and acceptance evidence in the appropriate project/test records; do not claim tests have passed until the comprehensive test campaign records results.

### Verification boundary
- Source review only for this implementation batch. Automated tests, typecheck, lint, SQL regression, live-provider probes, real-user actions, and device acceptance are not run here; keep them `NOT RUN` in the comprehensive test master plan.
- No production branch, production deployment, production migration, provider activation, real pricing change, wallet adjustment, or real HIMS/user mutation is authorized by this document.

---
## 1. Purpose and governing rules

The SULY Admin Control Center is the protected administrative workspace for operating the existing SULY product. Its redesign must make existing capabilities understandable and manageable without creating a parallel admin application, a duplicate data model, or a second authorization system.

### Non-negotiable rules

1. Preserve existing working features, routes, records, business rules, pricing, provider routing, subscriptions, wallet/ledger history, and HIMS behavior.
2. Do not delete, disable, replace, or silently alter an existing capability merely to simplify the interface.
3. Keep one central SULY Agent as the product's decision-making brain. Admin controls govern its verified models, capabilities, policies, and bounded workers; they must not create competing autonomous agents.
4. HIMS remains an entitlement and educational-resource capability integrated into the ordinary SULY conversation. It is not a separate chatbot or replacement chat route.
5. Enforce authentication and authorization on the server for every protected read and write. Hiding a button in the UI is not security.
6. Never expose provider API keys, service-role credentials, access tokens, raw activation codes, or other secrets to the client, repository, browser logs, or ordinary audit payloads.
7. Inspect existing tables, RPCs, Edge Functions, policies, and service code before proposing schema changes. Logical entities in this document are conceptual boundaries, not instructions to create new tables.
8. Do not invent provider support, model capability, price, FX rate, credit conversion, revenue, usage, or system health. Missing evidence is shown as Unknown / Unavailable, never as a fabricated zero or healthy state.
9. Preserve historical records. Prefer disable, deactivate, archive, or quarantine over destructive deletion. Financial and audit history must remain traceable.
10. Use the existing Expo shared application and server authorization model. Keep Web, Android, and iOS compatibility; adapt presentation only where platform behavior requires it.
11. All administrative mutations must use the existing approved service/RPC path or a reviewed server-side implementation. Sensitive operations require reason, confirmation, audit, and idempotency where appropriate.
12. A design approval is not permission to deploy, migrate production, change real prices, activate a provider/model, adjust a real wallet, or publish to production.

## 2. Approved visual identity and layout decisions

### 2.1 Visual identity

Use the approved SULY **Midnight Gold Luxury** design language:

| Token | Value | Intended use |
|---|---|---|
| Background | `#080B14` | Main application background |
| Surface | `#151A27` | Cards, panels, dialogs |
| Secondary surface | `#252B3A` | Nested panels, hover/selected surfaces |
| Gold primary | `#D4AF37` | Primary emphasis and key actions |
| Gold secondary | `#B88A2B` | Secondary gold details |
| Text | `#F5F0E2` | Primary readable text |
| Typography | Inter / Tajawal | English / Arabic |
| Icons | Lucide-style consistent line icons | Navigation and actions |

Use gold with restraint. Avoid oversized gradients, excessive glow, oversized headings, decorative robot imagery, and dashboard clutter. Provide coherent Light, Dark, and System theme behavior consistent with the existing application theme provider; the values above define the approved dark identity, not permission to hard-code dark colors into every component.

### 2.2 Three explicitly approved interaction choices

These choices were explicitly selected by the product owner:

- **Sidebar:** icons and labels are visible by default; the sidebar can collapse to icon-only mode. In collapsed mode, show the section name in a tooltip on hover/focus. Persist the preference only through an approved existing preference mechanism.
- **Home:** a combination of summary metrics and operational controls/activity—not a metrics-only dashboard.
- **Model catalog:** a toggle between Table view and Cards view. Both views use the same data source, filters, permissions, and actions; changing the view must not change model state or lose the current search/filter context.

### 2.3 Responsive behavior

- **Desktop:** full collapsible sidebar, compact top bar, content area with a readable maximum width, and data tables where they improve comparison.
- **Tablet:** collapsible navigation, reduced table columns, horizontal overflow only where necessary, and accessible action menus.
- **Mobile:** navigation drawer, compact top bar, cards or stacked rows instead of forcing a wide table, filters in a bottom sheet, full-screen forms/wizards, large enough touch targets, and safe-area/keyboard handling.
- Do not make mobile a read-only dashboard. Every action that is supported on the platform must remain usable.
- Unsupported platform-specific actions must be clearly disabled with an explanation; never render a control that appears functional but does nothing.

## 3. Global application shell

### 3.1 Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SULY  / Control Center       Search ( / )      Notifications   Help   Admin  │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Overview          │ Breadcrumb: Control Center / Current section             │
│ Providers & Models│ Page title                              Primary action    │
│ Capabilities      │ Short description                                         │
│ Routing & Agent   │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ Pricing & Plans   │ │ Metric       │ │ Metric       │ │ Metric       │       │
│ Credits & Wallet  │ └──────────────┘ └──────────────┘ └──────────────┘       │
│ Users & Accounts  │                                                          │
│ Ads & Rewards     │ Main content: table / cards / panels / charts             │
│ Finance & Profit  │                                                          │
│ Activity & Audit  │                                                          │
│ HIMS & Content    │                                                          │
│ System & Security │                                                          │
│                   │                                                          │
│ [Collapse]        │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 Top bar

- **SULY / Control Center:** returns to the overview route.
- **Global search:** opens searchable destinations and supported records; results must respect the current administrator's permissions.
- **Notifications:** opens the notification center with unread count only when the count is available.
- **Help:** opens existing documentation/help destination if configured; otherwise show a clear unavailable state rather than a dead link.
- **Administrator menu:** profile, language/theme preferences if already supported, session actions, and sign-out through the existing authentication flow.

### 3.3 Sidebar navigation

Use these exact 12 top-level administrative domains, matching the canonical SULY development plan:

1. Overview
2. Providers & Models
3. Capabilities & Tests
4. Routing & Agent
5. Pricing & Plans
6. Credits & Wallet
7. Users & Accounts
8. Ads & Rewards
9. Finance & Profit
10. Activity & Audit
11. HIMS & Content
12. System & Security

The sidebar item opens the section landing page. Nested pages appear under the active section or in its local navigation. Keep active location visually clear. Collapsing the sidebar must not change the route or discard page state.

### 3.4 Page header and breadcrumbs

Each page uses a consistent structure:

1. Breadcrumb path.
2. Page title and concise purpose statement.
3. Primary action, only if the role has permission and the action is supported.
4. Optional page-level search, filters, date range, export, and refresh.
5. Main content.
6. Pagination and result count for server-paginated lists.

When returning from a record detail page, preserve the prior list search, filters, sort, and page where practical.

### 3.5 Global command/search behavior

- `/` focuses global search when focus is not already inside an editable field.
- `Ctrl+K` opens the command palette.
- `Esc` closes the topmost dialog/menu/palette.
- `Alt+Left` uses normal browser/back navigation.
- Suggested command destinations: open a section, open a user by identifier, open a model, create a provider/model/plan/reward only when authorized.
- The command palette is navigation convenience, not a permission bypass. Every destination and mutation is re-authorized by the server.

## 4. Overview — operational home

### 4.1 Page composition

The Overview page combines summary metrics with operational state:

- Time range: Today, 7 days, 30 days, and custom range only if the backend supports it.
- Summary cards: users, requests/tasks, credit usage, revenue/cost where the underlying data exists.
- Operational health: Central Agent, AI Gateway, database, workers/queues, provider health, HIMS service.
- Task queues: queued, running, completed, failed/cancelled where available.
- Alerts: provider failures, service degradation, unusual cost, security findings, pending approvals.
- Recent administrative actions: actor, action, target, time, outcome.
- Quick actions: shortcuts to authorized common tasks, never fake or hard-coded success actions.

### 4.2 Metric and operational behavior

- Clicking a metric opens the relevant section with the same date range and compatible filters applied.
- Refresh reloads the relevant data without resetting the whole application.
- Show loading/skeleton while loading.
- Show Unknown/Unavailable when a source fails or has no reliable value.
- Show zero only when a successful query confirms zero.
- Distinguish administratively disabled from unhealthy/error.
- Do not infer global system health from one successful endpoint or one model probe.

## 5. Domain specifications

Each domain landing page follows the global page structure. The following are target information architecture and behaviors; actual data sources and existing RPC/API names must be discovered in the repository before implementation.

### 5.1 Providers & Models

**Purpose:** manage provider records and the model catalog without exposing credentials or enabling unverified models.

**Provider list**
- Columns/cards: provider name, provider type/protocol, configured status (without secret value), enabled/disabled state, health evidence, model count, last verified time.
- Filters: enabled state, provider type, health/verification state.
- Actions: view details, edit non-secret metadata, test connection where supported, enable/disable if authorized, view audit history.
- Credential replacement is a separate guarded flow. Show only configured/not configured and safe metadata; never return the secret to the client.

**Provider detail**
- Provider identity and protocol.
- Server-side credential status and last verification.
- Supported API compatibility and safe endpoint metadata.
- Associated models and recent probe results.
- Connection test action with explicit scope, timeout, and cost disclosure if a probe can incur cost.
- Enable/disable action with confirmation and reason where required.

**Model catalog**
- Default presentation: the owner-approved Table/Cards toggle.
- Shared filters: provider, model type, status, capability, verification state, and supported price filter only when comparable values exist.
- Table fields: model name/ID, provider, type, verified capabilities, verification status, enabled state, cost summary where verified, last health evidence, row actions.
- Cards: same fields summarized; never omit a warning or permission state present in the table.
- Row/card actions: details, edit metadata, capability review, test, enable/disable, audit history, and delete only if a reviewed safe deletion policy permits it.
- Search and pagination are server-side for large catalogs.

**Model detail**
- Identity and provider mapping.
- Type and descriptive metadata.
- Context/input/output limits only when verified.
- Capability evidence and test history.
- Pricing versions (read-only here; editing belongs to Pricing & Plans).
- Health history, routing eligibility, and audit/change history.
- Explicit reasons when the model is unavailable or ineligible.

### 5.2 Add Model wizard — five steps

Use a five-step wizard. The stepper always shows progress, current step, and completed steps. Back navigation preserves all entered data. Draft save does not activate the model.

1. **Select Provider:** choose an existing provider or follow the authorized provider-creation flow. Display only providers the administrator can view/use. Provider secrets are not entered in the model wizard.
2. **Model Information:** enter the model's identity, provider model identifier, type, description, and compatibility metadata. Detailed field contract is in Section 6.
3. **Capabilities:** choose only capabilities supported by the catalog and record their evidence/status. Distinguish provider-declared support from SULY-tested support. Do not mark a capability verified merely because a checkbox was selected.
4. **Pricing & Operation:** configure provider cost/customer price, units, currency, effective dates, operational limits, and enablement intent only when supported by the approved pricing model and owner decisions. Do not guess FX, credit value, or missing prices. Preserve price versions.
5. **Test & Review:** run permitted connection/model/capability tests, display exact results and timestamps, show missing evidence and pricing blockers, review all fields, then save. Activation is a separate guarded decision and is allowed only after required verification and permissions.

**Wizard-wide rules**
- Draft / Pending Validation / Verified / Enabled / Disabled are distinct states; do not collapse them into one boolean.
- A new or unverified model is not eligible for automatic routing.
- Do not make a model available to end users merely because its record was saved.
- A failed test must not erase entered metadata.
- Test requests must identify whether they are metadata-only, provider connectivity, or an actual inference request that may incur cost.
- Any destructive removal must be blocked when references/history would be orphaned; prefer disable/archive.

### 5.3 Capabilities & Tests

**Purpose:** manage what a model can do and the evidence that proves it.

- Capability catalogue: stable key, display name, explanation, modality, input/output expectations, constraints, and whether the capability is supported in the current product.
- Model-capability matrix: model, capability, provider-declared state, SULY test state, evidence, last tested, reason unavailable.
- Capability detail: expected inputs/outputs, requirements, compatible models, known constraints, cost unit if relevant, test suite/history.
- Actions: inspect, run an approved test, mark evidence for review, disable capability eligibility where authorized, view history.
- Do not infer support from model naming or provider marketing alone.
- Distinguish Declared, Tested/Passed, Failed, Unknown, and Unsupported.

### 5.4 Routing & Agent

**Purpose:** govern the one central Agent and its routing rules.

- Central Agent status and policy version.
- Task categories/classification and eligible model roles.
- Routing rules with priority, conditions, allowed model/provider sets, fallback, timeout, retry, and worker bounds where supported.
- Worker/task runtime overview: queued/running/blocked/failed tasks, dependencies, leases/checkpoints, cancellation, retries, and usage settlement status.
- Scenario tester: administrator enters a test request; system displays matched classification/rule, eligible candidates, selected candidate, reason, fallback, and constraints. It must be explicitly a dry run unless the administrator intentionally starts a billable live test.
- Actions: inspect policy, edit reviewed rule, validate/dry-run, publish policy version with authorization, pause/resume supported worker controls, inspect task, cancel/retry only through existing safe server workflow.
- No independent agents/brains. Planner/worker/reviewer/summarizer are constrained execution roles under the central Agent.
- A disabled/unhealthy/unverified provider/model must not be newly selected.

### 5.5 Pricing & Plans

**Purpose:** maintain customer plans and auditable service pricing.

- Plan list: name, status, included features/allowances, effective version, subscriber count where available.
- Plan detail: feature entitlements, limits, allowed capabilities, subscription behavior, and version history.
- Pricing catalogue: model/service, provider cost, customer price, currency, unit, margin, effective date, and version.
- Preserve the owner-approved target margin of 40% for chargeable provider-backed services: selling price = provider cost × 1.40. Free/promotional services follow an explicit separate policy.
- Never apply the margin formula to incomparable units or invent missing provider costs.
- Never guess exchange rates or credit value. If conversion settings are missing, block charging safely and request owner input.
- Changes create a new effective version for future usage; do not rewrite historical transaction prices.
- Deleting a plan with active subscriptions must be blocked until an approved migration/retirement path is defined.

### 5.6 Credits & Wallet

**Purpose:** inspect wallet balances and safely manage credit lifecycle.

- Overview: confirmed balances, reservations, settlements, releases/refunds, pending items, and reconciliation status.
- Wallet directory: user, available/reserved balance, last ledger event, account status.
- Wallet detail: immutable ledger timeline and linked task/order references.
- Actions: grant, debit, refund, release, reconcile, export—only if an existing authorized server-side workflow supports them.
- Every adjustment requires exact amount/unit, target, reason, confirmation, actor, and idempotency protection.
- Never edit a balance directly or silently rewrite ledger rows.
- Failed ledger queries show unavailable, not zero.
- Partial/cancelled work follows the approved settlement rules and charges only the performed work where those rules apply.

### 5.7 Users & Accounts

**Purpose:** provide secure, searchable user administration.

- Directory: name, email/identifier, account status, role, plan/subscription, entitlement indicators, created date, and safe summary fields.
- Search and filters: name/email/UUID, status, role, plan; use server-side pagination and exact counts where available.
- User detail tabs: profile, subscription/plan, wallet/ledger (read-only summary with authorized drill-down), usage/tasks, entitlements/HIMS, support/activity, security/session information only where the system actually stores it.
- Actions may include view, update permitted metadata, ban/unban, subscription grant/revoke, support actions, and account lifecycle actions only where existing server policy allows them.
- Creating an account must use the existing Auth lifecycle; do not insert a user profile row as a substitute for authentication.
- Sensitive actions require confirmation, reason, audit, and server authorization.
- Do not display fictitious devices, sessions, or security events when no source exists.

### 5.8 Ads & Rewards

**Purpose:** configure reward eligibility and inspect verified reward activity.

- Ad/reward units and configuration state.
- Reward rules, limits, eligibility, cooldowns, and user-facing entitlement.
- Verification and anti-replay status.
- Reward history with event ID, user, verified result, amount, and time.
- Reporting only when actual impression/reward/revenue telemetry exists.
- Actions: edit supported rules, enable/disable a unit, inspect event, export safe report.
- Do not claim AdMob impressions or revenue are live without verified backend reporting.
- Reward grants must be server-verified and idempotent; never trust a client callback alone.

### 5.9 Finance & Profit

**Purpose:** provide traceable financial reporting, not an editable substitute for accounting records.

- Revenue, provider cost, expenses, gross margin, unsettled items, currency, and period.
- Provider invoices/cost records and reconciliation status where integrated.
- Filters by period, provider, service, currency, and status.
- Reports/export only from confirmed source data.
- Clearly separate operational estimates from official reconciled financial values.
- Never sum different currencies without an approved FX source and timestamp.
- Never convert unlike units or treat missing costs as zero.
- Adjustments require the appropriate finance authorization and auditable source record.

### 5.10 Activity & Audit

**Purpose:** trace administrative and system activity.

- Separate views/filters for administrative audit events, application events, AI/task events, and security events where sources exist.
- Fields: timestamp, actor, action, target, outcome, source/trace ID, and safe context.
- Search by actor, target, event type, date, outcome.
- Detail drawer shows sanitized metadata and linked records.
- Audit history is append-only from the admin UI; no edit/delete action.
- Never log provider secrets, raw activation codes, passwords, tokens, or unnecessary private content.
- Failed log retrieval must be distinguishable from an empty period.

### 5.11 HIMS & Content

**Purpose:** preserve and administer the existing educational entitlement and resource system.

- Overview: activation-code status, active entitlements, resource inventory, and operational issues where confirmed.
- Activation codes: create, list safe fingerprints/metadata, inspect usage/expiry/limits, disable/reactivate where allowed, and audit history.
- Raw activation code is shown only once at creation if the existing secure workflow requires it; it must not be reloaded or exposed in list/detail views.
- Resource catalogue: title, category, visibility/active state, metadata, resource identity, and safe media reference.
- Resource actions: create/edit metadata, deactivate/reactivate, and view audit history using existing approved RPC/service behavior.
- Permanent deletion remains excluded unless a reviewed retention policy and data/media impact plan are approved.
- Student sends activation code as an ordinary message in the same SULY chat. On valid activation, entitlement is granted server-side and the central Agent can retrieve authorized learning resources.
- Do not create a second education chatbot or separate HIMS conversation.
- Keep student entitlement/resource authorization on the server. A client-side flag or chat message is never proof of entitlement.

### 5.12 System & Security

**Purpose:** expose safe operational configuration and security governance.

- System/service health with source and last-checked time.
- Admin users, roles, permission catalogue, and role assignment.
- Sessions/security events only if supported by existing storage.
- Integration configuration status without revealing secrets.
- Storage inventory and safe metadata; mutations only if separately reviewed and authorized.
- Maintenance/circuit-breaker controls with explicit current state, confirmation, reason, and audit.
- Backup/restore status only when a verified integration supplies it.
- Security findings grouped by severity, source, affected resource, and remediation status.
- Do not present an unknown state as disabled/healthy.
- Do not blanket-revoke database grants or add broad RLS policies without inspecting the exact table/function, caller, and intended access model.

## 6. Add Model wizard — Step 2 field contract

### 6.1 Purpose and boundary

Step 2, **Model Information**, defines the identity and provider compatibility metadata of a model. It does not define capabilities, pricing, routing eligibility, or production activation. Those belong to Steps 3–5 and the governed admin domains.

The provider selected in Step 1 is displayed as a read-only association. Provider credentials are configured and stored through the provider's secure server-side credential workflow, never in this step.

### 6.2 Section A — model identity

| Field | Control | Required | Validation and behavior |
|---|---|---:|---|
| Display name | Single-line text | Yes | Trim whitespace; reject empty value; apply a documented maximum length; reject control characters. |
| Provider Model ID | Single-line text | Yes | Exact identifier expected by the selected provider/API. Trim outer whitespace; preserve case and meaningful punctuation; validate against provider-specific format when known. |
| Short name / alias | Single-line text | No | Trim; enforce length; uniqueness only within the defined display namespace if the product requires it. |
| Description | Multiline text | Yes | Non-empty after trim; enforce length; plain text or sanitized supported Markdown only. |
| Model family | Text or approved catalogue selection | No | Do not infer from the display name; use verified provider/catalogue data. |
| Model version / revision | Text | No | Preserve provider's exact revision if supplied; otherwise leave unknown. |
| Provider association | Read-only summary | Yes | Must reference the provider selected in Step 1; cannot be silently changed here. |

**Identity rules**
- Display name is for administrators; Provider Model ID is the actual identifier sent through the provider integration.
- Do not substitute a friendly name for Provider Model ID.
- Duplicate check is scoped to the provider and exact provider model identifier, unless the existing registry defines a different unique key.
- Do not lowercase or rewrite case-sensitive provider IDs.
- If the provider's model list cannot be queried, allow manual entry only if the existing product policy permits it; mark the identifier unverified until Step 5 succeeds.

### 6.3 Section B — model classification

| Field | Control | Required | Validation |
|---|---|---:|---|
| Model category/type | Select | Yes | Must be one of the controlled values supported by the registry. |
| Additional classification | Multi-select or tags | No | Only approved taxonomy values; must not replace Step 3 capabilities. |

Suggested controlled top-level categories (subject to the existing registry's taxonomy): Chat/Text, Reasoning, Embeddings, Reranking, Image Generation, Audio, Video, Multimodal, Other.

A model may have multiple verified capabilities. The category is a broad catalogue classification and must not be treated as proof that the model supports a particular input/output modality.

### 6.4 Section C — API compatibility

| Field | Control | Required | Validation and behavior |
|---|---|---:|---|
| API protocol / compatibility | Select | Yes | Must be supported by the selected provider integration. |
| Endpoint/base URL | URL/text | Conditional | Required only when the provider integration expects a model-specific endpoint; validate scheme/host and allowed-host policy server-side. |
| API version | Text/select | Conditional | Required only when the provider requires an explicit version; must match supported integration versions. |
| Model ID placement | Provider-specific setting | Yes (system-derived where possible) | Determine whether identifier is sent as model field, deployment name, path, or another provider-specific field. Avoid free-form unsafe configuration. |
| Streaming support | Evidence-backed toggle/status | No | Do not mark supported unless provider metadata or a successful test confirms it. |
| Structured output support | Evidence-backed toggle/status | No | Do not infer from generic JSON mode claims; record tested support separately. |
| Tool/function calling support | Evidence-backed toggle/status | No | Do not enable unless the integration and model behavior are verified. |

**Endpoint safety**
- Do not accept arbitrary internal/private network targets without an explicit server-side allowlist/SSRF defense.
- Never allow client-provided endpoint values to bypass the provider's approved connection policy.
- Do not store authentication headers or secrets in model metadata.

### 6.5 Section D — technical limits and defaults

These values are optional unless the selected provider integration requires them. Each value must carry a source/status such as Provider metadata, SULY test, Owner-configured, or Unknown.

| Field | Control | Validation |
|---|---|---|
| Context window | Positive integer | Must be a known/verified limit; reject zero, negative, fractional, or unsafe values. |
| Maximum input tokens | Positive integer | Must not exceed a verified model/provider limit. |
| Maximum output tokens | Positive integer | Must not exceed a verified model/provider limit. |
| Default output tokens | Positive integer | Must not exceed maximum output tokens when both are known. |
| Default temperature | Decimal | Validate against the exact provider/model-supported range; do not assume a universal range. |
| Default top-p | Decimal | Validate against provider/model-supported range. |
| Request timeout | Positive duration | Must fit the server's configured timeout ceiling. |
| Maximum input size | Positive number + explicit unit | Unit must be explicit; do not compare bytes, tokens, seconds, or images as if equivalent. |

Do not prefill guessed specifications. If a provider does not publish a value and no successful SULY test establishes it, leave it unset/Unknown. Optional unknown values must not block saving unless the integration explicitly requires them.

### 6.6 Section E — state and provenance

The model's lifecycle must distinguish at least:

- Draft — entered but not yet submitted for verification.
- Pending Validation — saved and awaiting required checks.
- Verified — required identity/compatibility checks passed; this alone does not imply production enablement.
- Enabled — explicitly enabled through an authorized lifecycle action after required gates.
- Disabled — intentionally unavailable for new routing.
- Error/Restricted — latest evidence indicates a failure or policy restriction; show the reason and timestamp.

For each externally sourced or operational field, preserve provenance where the existing data model allows it: source, verification state, last checked timestamp, and safe notes. Do not convert missing data to a fabricated default.

### 6.7 Validation timing and error handling

1. **On blur / field change:** perform local format and required-field validation; do not send a billable inference request.
2. **On duplicate check:** query the existing registry using provider ID + exact Model ID. A network failure is not proof that the ID is unique.
3. **On provider catalogue lookup:** use only the selected provider's supported server integration. If unavailable, show a clear manual-entry path only when permitted.
4. **On Next:** validate all required fields again on the client for immediate feedback and on the server before accepting the step.
5. **On Save Draft:** persist valid partial data under the draft workflow; do not activate the model or make it routable.
6. **On back navigation:** preserve all entered values and validation messages where practical.
7. **On server failure:** retain user input, show a safe actionable error, and allow retry. Never display raw secrets or internal stack traces.

Validation examples:

| Condition | Expected result |
|---|---|
| Empty display name | Block Next; show field-level “Enter a model name.” |
| Empty Provider Model ID | Block Next; show field-level “Enter the exact provider model ID.” |
| Existing same provider + Model ID | Block Next; show duplicate record link if the administrator can view it. |
| Same Model ID under a different provider | Do not automatically reject; uniqueness follows the existing registry key. |
| Unsupported protocol for selected provider | Block Next and explain the supported compatibility choices. |
| Malformed endpoint | Block Next only if endpoint is required for this provider. |
| Unknown context/output limit | Allow blank/Unknown unless integration requires a value. |
| Output default greater than verified max | Block Next and identify the conflicting fields. |
| Provider catalogue lookup times out | Keep entered data; show lookup unavailable, not “model does not exist.” |
| Provider ID is manually entered but not tested | Save as Pending Validation; do not route. |

### 6.8 Step 2 layout and controls

Recommended visual order:

1. Stepper: Provider → Model Information → Capabilities → Pricing & Operation → Test & Review.
2. Provider summary (read-only).
3. Model identity fields.
4. Model type/category.
5. API compatibility.
6. Technical limits/defaults (collapsible advanced section).
7. Validation summary (only when errors/warnings exist).
8. Footer actions.

Footer actions:
- **Back:** return to Step 1 and preserve Step 2 data.
- **Save Draft:** save the current draft if authorized; do not activate or route.
- **Next: Capabilities:** validate required fields, persist the step draft, then open Step 3.
- **Check Model ID:** optional non-billable metadata/catalogue check if supported; clearly state whether it checks catalog presence or actual connectivity.
- Do not label a metadata lookup as a model inference test.

## 7. Common action patterns

Use the smallest interaction pattern that safely fits the action:

- **Modal:** simple confirmation or small edit with few fields.
- **Drawer:** medium-detail inspection or focused edit that benefits from retaining page context.
- **Dedicated page:** complex record details, permissions, financial/accounting review.
- **Wizard:** multi-step configuration such as model, provider, plan, or reward setup.

All forms must:
- Label required and optional fields.
- Explain units and expected formats.
- Validate locally for usability and on the server for trust.
- Preserve entered data on recoverable failure.
- Prevent double submission.
- Disable submit while a request is pending.
- Show a clear success result only after the server confirms success.
- Provide a safe retry path.
- Avoid clearing unrelated form fields after a partial failure.

## 8. Permissions and approval model

Use the existing authorization source and server-side policy. The following is a conceptual permission vocabulary, not a replacement for the actual roles/claims already in the system:

- View
- Create
- Edit
- Delete (rare; usually disabled/archive is preferred)
- Activate
- Disable
- Test
- Export
- Approve

Examples:
- An AI operator may view and test models but may not edit financial prices unless explicitly authorized.
- A finance operator may inspect cost and ledger reports but may not change provider credentials.
- A HIMS operator may manage allowed HIMS codes/resources but may not read provider secrets.
- A security administrator may manage roles only within the existing owner-approved authorization boundary.

Every mutation must be authorized by the server. Client-side role checks only control presentation. High-impact actions require confirmation and an audit event. Where the current role/permission model cannot express a needed boundary, stop and document the required owner decision rather than inventing privilege semantics.

## 9. Notifications, alerts, search, and exports

### Notifications

Each notification should contain severity, timestamp, affected service/resource, concise description, source, status, and a permission-checked link to details. Types may include service failure, security event, approval request, provider degradation, unusual cost, or HIMS activation issue—but only when a real source emits the event.

### Search

Global search may cover users, providers, models, plans, tasks, audit events, and HIMS resources where searchable sources exist. It must:
- respect permissions and row-level authorization;
- use server-side filtering/pagination for large data;
- distinguish no results from failed search;
- avoid exposing private conversation contents or secrets;
- preserve Arabic/English search behavior where supported.

### Export

CSV/Excel/PDF exports are available only for appropriate reports and authorized roles. Exports must:
- use the same server-side filters as the visible report;
- record export actor/time/scope where audit policy requires it;
- exclude secrets, raw activation codes, tokens, and unnecessary personal data;
- distinguish failed data retrieval from a legitimately empty export.

## 10. Shared UI states and accessibility

Every data-backed page and action must support:

- Loading / skeleton
- Success
- Empty (confirmed no records)
- Error / retry
- No permission
- Offline / connection unavailable
- Unknown / stale data where freshness cannot be established

Accessibility and localization:
- Arabic and English labels and messages.
- Correct RTL/LTR layout, including mixed identifiers and code.
- Keyboard navigation and visible focus on Web.
- Accessible labels for icon-only buttons.
- Sufficient contrast and touch-target size.
- Dialog focus management and escape behavior.
- Screen-reader status for validation and asynchronous results.
- Dates, numbers, and currency formatted using explicit locale and currency metadata.

## 11. Technical architecture boundaries

Target logical flow:

```text
Admin UI (shared Expo / React Native)
        │ authenticated request
        ▼
Existing Admin API / Edge Function / approved RPC boundary
        │ server authentication + authorization + validation
        ▼
Existing domain services and data sources
        ├── Provider / Model registry
        ├── Capability evidence and probes
        ├── Central Agent / routing / task runtime
        ├── Plans / pricing / subscriptions
        ├── Wallet / immutable ledger
        ├── Users / entitlements
        ├── Ads / rewards
        ├── Finance
        ├── Audit / notifications
        └── HIMS / resources
```

Rules:
- Reuse existing data sources and services where they correctly implement the business rule.
- Do not connect the UI directly to privileged tables or use service-role credentials in the client.
- Use server-side pagination, filtering, and sorting for large lists.
- Validate all input at the server boundary.
- Use transactions/atomic RPC behavior for financial or multi-record mutations.
- Use idempotency keys for retryable sensitive operations.
- Keep audit events separate from financial ledger entries.
- Preserve provider secrets once per provider in server-side secret storage; do not duplicate credentials in model records.
- Use explicit API contracts and typed UI models; do not let UI components invent database schema.
- Logical service names in this document are conceptual. Discover actual repository functions before implementation.

## 12. Data model and migration policy

The conceptual domains include administrator identity/permissions, providers, models, capabilities/evidence, routing policies, plans/subscriptions, wallets/ledger, tasks, rewards, finance, audit/notifications, and HIMS/resources.

This list is not a schema proposal. Before any migration:
1. inspect existing tables, columns, constraints, indexes, RLS, grants, RPCs, Edge Functions, and callers;
2. map each screen field to its current authoritative source;
3. identify missing fields versus already represented data;
4. prefer additive compatible changes only when necessary;
5. provide rollback and regression tests;
6. preserve production data and historical records;
7. do not apply production migrations without separate explicit owner approval.

## 13. Security and data integrity requirements

- Session and role validation on every protected server action.
- Least privilege and explicit authorization per operation.
- RLS and grants reviewed together; do not assume RLS alone describes all access.
- Fixed search_path and reviewed grants for privileged database functions.
- Input validation, rate limiting, exact-origin CORS where applicable, and SSRF protection for provider endpoints.
- Secret redaction in responses, logs, traces, and error messages.
- Secure activation-code hashing and no plaintext reload.
- Immutable audit and financial history.
- Atomic, idempotent wallet and subscription changes.
- Safe provider/model disable behavior: no new calls after confirmed disable.
- No silent fallback to an unverified model.
- No broad blanket policy/grant changes without function-by-function and table-by-table review.
- Security findings must show evidence and status; a warning is not automatically a confirmed vulnerability, and an unreviewed finding must not be marked resolved.

## 14. Testing and acceptance criteria

A section is not complete merely because its page renders. Each section must pass applicable checks:

1. **Source review:** existing routes, service calls, permissions, and data relationships are preserved.
2. **Functional:** list/detail/search/filter/sort/pagination and every advertised action work against the correct source.
3. **Authorization:** admin, non-admin, expired session, and insufficient-role cases are checked server-side.
4. **Data integrity:** duplicates, retries, concurrent operations, partial failure, and historical records are checked.
5. **Security:** secrets, IDOR, unsafe endpoint input, unauthorized RPCs, audit redaction, and RLS/grants are reviewed.
6. **Cross-platform:** Web, Android, and iOS shared exports/build checks; device acceptance is recorded separately.
7. **Localization/accessibility:** Arabic/English, RTL/LTR, keyboard, focus, screen-reader labels, and narrow viewport behavior.
8. **Failure states:** empty, unknown, timeout, offline, server error, and permission denied are not confused.
9. **Evidence:** record exact commit/PR, test command or scenario, result, date, and remaining limitation.
10. **Production separation:** no production deployment or data mutation is inferred from development CI or preview success.

For the Add Model wizard specifically, test:
- provider/model ID association and duplicate detection;
- exact case-sensitive identifiers;
- provider-specific protocol and endpoint validation;
- optional unknown limits;
- output default versus maximum;
- metadata lookup timeout versus confirmed absence;
- draft save/resume;
- back/next state retention;
- non-billable metadata lookup versus billable inference probe;
- unverified model exclusion from routing;
- server-side role denial and audit behavior.

The independent comprehensive test master plan remains the authoritative place for final acceptance evidence. This design document defines what should be tested; it does not claim those tests have passed.

## 15. Delivery sequence

Use this order for the admin design and implementation work, while respecting the canonical 17-phase project roadmap:

1. Inventory existing admin routes, components, services, RPCs, policies, and data sources.
2. Map the existing implementation to the 12 approved domains; identify gaps without deleting working routes.
3. Establish shared shell, tokens, responsive navigation, breadcrumbs, global search, and page-state components.
4. Implement/complete domain landing pages additively, reusing existing services.
5. Complete Providers & Models and the five-step model wizard with evidence-backed validation.
6. Complete capabilities/tests and central Agent/routing governance.
7. Complete plans/pricing, wallet/ledger, users/accounts, ads/rewards, and finance workflows.
8. Complete audit, HIMS/content, and system/security experiences.
9. Complete permission review, accessibility, localization, and cross-platform behavior.
10. Run the required tests and record evidence; leave unresolved owner decisions explicitly blocked.
11. Promote to production only through a separate owner-approved release process.

Do not treat this sequence as a change to the master roadmap's phase numbering or dependencies.

## 16. Decisions that must remain open until verified or approved

Do not fill these gaps by guessing:

- Any provider protocol/endpoint behavior not already supported by its integration.
- Model limits, capability claims, health, and pricing without provider/SULY evidence.
- Credit unit value and FX conversion when not owner-approved.
- Financial data sources and official reconciliation semantics where not integrated.
- Admin role boundaries not represented in the current authorization model.
- Permanent HIMS resource/media deletion and retention policy.
- Storage write operations beyond currently approved safe/read-only behavior.
- Any new notification channel, export destination, or integration not already configured.
- Any production schema, policy, provider, pricing, credit, or deployment change.

For each blocker, record the missing decision/evidence, safe interim behavior, and exact owner input required.

## 17. Document governance

- This is the detailed design reference for the SULY Admin Control Center.
- Update it when the product owner explicitly approves a design change or when implementation discovery proves a detail differs from the existing system; record the reason and preserve the audit trail.
- Do not overwrite the canonical project development plan or the implementation/verification record with design-only claims.
- If this document conflicts with the canonical development master plan, security invariants, or a newer explicit owner decision, the higher-authority/current decision wins and the discrepancy must be recorded.
- Every implementation report must distinguish: designed, implemented, CI-checked, manually tested, and production-deployed.
