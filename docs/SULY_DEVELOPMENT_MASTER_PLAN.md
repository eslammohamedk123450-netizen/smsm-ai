# SULY — Unified Development & Product Completion Plan

**Document type:** Master build/development plan (Track A)  
**Owner:** SULY product owner  
**Working branch:** `develop` only  
**Protected production branch:** `release/v1` — no direct work and no deployment without explicit approval  
**Status:** Active execution plan  
**Last updated:** 2026-11-16

## 1. Purpose and relationship to the test plan

This is the single authoritative plan for building, organizing, integrating, securing, and completing SULY. It contains 17 sequential development phases. The independent comprehensive verification campaign is defined in `docs/SULY_COMPREHENSIVE_TEST_MASTER_PLAN.md` (Track B), also with 17 groups.

Track A may run focused developer checks and regression tests continuously. Track B is the formal, end-to-end comprehensive test campaign and starts only after all 17 development phases are implemented and integrated. Passing a build or a subset of tests never proves the whole product ready.

The immediate execution gate is to close Phases 1–4. Do not begin Phase 5 until all mandatory Phase 1–4 criteria are verified or explicitly recorded as owner-blocked with a safe interim behavior. Report completion of Phases 1–4 to the owner before moving on to the unified UX implementation sequence.

## 2. Product invariants — must survive every phase

- One central SULY Agent decides whether a request is ordinary chat or requires planning, tools, or bounded workers. Do not create competing independent assistants.
- HIMS remains an entitlement and educational-resource capability inside the ordinary central chat. Preserve its existing tables, content, admin workflow, audit history, and authorization. Never disable or replace it.
- Preserve existing features, routes, records, and user workflows. Do not delete or hide functionality merely to simplify a redesign.
- Shared Expo application compatibility: Web, Android, and iOS; Arabic/RTL and English/LTR.
- Enforce authorization, entitlements, provider access, and billing on the server. Client state is never proof of permission.
- Never commit provider secrets, service-role credentials, or privileged keys.
- Preserve immutable usage/credit history. Reserve, settle, release, and cancellation accounting must be atomic and idempotent; charge only work actually performed.
- Do not guess model versions, provider mappings, prices, credit conversion, exchange rates, subscription grants, or reward amounts.
- Approved UX decisions: simple chat-first entry; central Agent auto-detects chat vs execution; all four Suly Lite/Pro/Max/Ultra profiles are visible with accurate access labels; Studio is for specialized media; plan allowance is monthly; purchased credits are intended never to expire. These are specifications, not proof that backend behavior already matches.
- Current approved visual foundation is clean, calm, premium black/white with light and dark themes. Do not reintroduce the former gold palette without a new owner decision.
- Work on `develop`; do not modify `release/v1`, production data, secrets, or production deployment without explicit authorization.

## 3. Phase status rules

Use the roadmap's evidence-based statuses:
- `DONE — VERIFIED`: implementation and required checks passed with exact evidence.
- `IMPLEMENTED — REVIEW REQUIRED`: code exists but required runtime, security, visual, cross-platform, or end-to-end verification is missing.
- `IN PROGRESS`: actively being changed.
- `BLOCKED — OWNER INPUT`: needs a user-owned account, content source, secret, or business decision.
- `NOT STARTED`: no implementation evidence.

A phase is complete only when every required acceptance item is verified or explicitly deferred by the owner. For each completed item record commit/PR/migration, test evidence, limitations, and verification date. Never claim real device, visual browser, production, or real-user verification unless performed.

## 4. The 17 sequential development phases

### Phase 1 — Repository, product, and system audit
**Goal:** Establish a reliable inventory and trace critical flows before risky changes.

Scope:
- Inventory repository structure, routes, screens, services, edge functions, migrations, tables, RLS, grants, triggers, storage, scheduled jobs, secrets/config references, CI, and deployments.
- Inventory user and admin capabilities: authentication, chat, central Agent, durable tasks, HIMS, projects, Studio/media, Library, billing, subscriptions, credits, rewards, providers/models, integrations, support, analytics, and audit.
- Trace UI → service/API → server function → database/provider → response → ledger for critical paths.
- Identify duplicate/dead code, route gaps, untested assumptions, privilege boundaries, and risky migrations. Do not delete anything during discovery.
- Establish reproducible typecheck, unit, Deno, SQL regression, Web export, Android/iOS bundle, and CI baselines.

Acceptance:
- Maintained feature/system inventory and critical-flow ownership/evidence matrix.
- Each critical flow is marked verified, review-required, or blocked with a named evidence gap.
- Existing functionality and data remain intact.

### Phase 2 — HIMS authorization, security, and preservation
**Goal:** Secure the existing education entitlement without creating a parallel education product.

Scope:
- Preserve HIMS tables, resources, administrator workflows, and historical data.
- Verify admin-only activation-code creation/management, secure hash storage, non-reusable redemption, expiration/usage rules where supported, replay prevention, rate limits, and audit events.
- Verify server-side student identity and entitlement on every protected resource request.
- Reject forged client flags, modified request bodies, expired/disabled/reused codes, and cross-student access.
- Verify least-privilege RLS/grants and private storage authorization.
- Review privileged RPC search paths, execute grants, input validation, and rollback safety.
- Never expose plaintext codes except the intended one-time creation response.

Acceptance:
- Admin authorization is server-confirmed.
- Valid eligible student activation succeeds; invalid, replayed, expired, forged, and cross-user attempts fail safely.
- No HIMS data loss or regression to admin workflows.
- Security-sensitive migrations have regression and rollback evidence.

### Phase 3 — HIMS natural experience inside the central chat
**Goal:** Make activation and authorized learning resources work naturally in the existing SULY conversation.

Scope:
- Student submits activation code as a normal chat message; show one concise confirmation only after server success.
- The central Agent answers ordinary questions naturally and retrieves a lecture/file only after explicit resource intent and server-side entitlement checks.
- Greetings, small talk, and unrelated questions must not trigger HIMS messages or resource lookup.
- Support ambiguous requests, missing content, denied access, unavailable files, and safe delivery links.
- Preserve chat history, normal Agent behavior, and existing admin content management.
- Do not invent course materials. Real student journey and lecture delivery require owner-approved test accounts and real content sources.

Acceptance:
- Regression/integration coverage for activation parsing, ordinary chat, academic Q&A, resource retrieval, denied access, missing resources, and follow-up references.
- No second chatbot, assistant, or standalone activation conversation.
- Every delivered resource is authorized server-side.
- Owner-dependent E2E items are explicitly blocked until safe test accounts/content are supplied.

### Phase 4 — Shared visual system and accessibility foundation
**Goal:** Establish consistent, maintainable, accessible UI foundations before the larger navigation and UX migration.

Scope:
- Standardize semantic colors, light/dark themes, typography, spacing, radii, borders, elevation, icons, and interaction states.
- Use the approved calm premium black/white visual direction and correct Arabic/English typography and RTL/LTR.
- Standardize reusable buttons, fields, cards, dialogs, menus, loading/empty/error states, and screen/layout primitives where compatible with current architecture.
- Audit contrast, text scaling, focus/pressed/disabled states, touch targets, keyboard/safe areas, responsive behavior, and accessibility labels.
- Migrate existing app/admin/HIMS surfaces incrementally without hiding or removing features.

Acceptance:
- Semantic token parity across themes and automated contrast checks for key text/control combinations.
- Primary shared components use semantic tokens rather than scattered hard-coded styles.
- Existing app, admin, and HIMS surfaces remain functional.
- Full screen-by-screen visual review is recorded as verified or explicitly deferred to later implementation/test phases; do not claim it complete based only on token tests.

### Phase 5 — Unified navigation and five product areas
**Goal:** Organize Home, Conversations, Studio, Library, and Account across mobile and web.
- Preserve all existing deep links, admin-only routes, HIMS chat/resource flow, support, integrations, billing, and task destinations.
- Mobile navigation respects safe areas and keyboard; web navigation is responsive.
- Acceptance: every capability remains reachable and route regressions are covered.

### Phase 6 — Chat-first interface and central Agent experience
**Goal:** Make ordinary chat the simplest entry point and the Agent the single execution brain.
- Header: navigation control and verified selected-model label/dropdown.
- Agent classifies ordinary chat vs task execution automatically; no mode-selection burden or competing task-mode cards.
- Show task plan/progress/results, cancellation, retry, partial billing, and truthful model/tool provenance.
- Preserve streaming, attachments, history, projects, task runtime, DAG, bounded workers, leases, idempotency, and HIMS.
- Acceptance: authenticated chat/task lifecycle and safe cancellation/settlement are verified.

### Phase 7 — Model catalog, selector, and server-side entitlements
**Goal:** Present all approved model profiles accurately.
- Show Lite, Pro, Max, Ultra with verified metadata and clear available/restricted status.
- Separate subscription plan from selected model; enforce all permissions and routing server-side.
- Do not activate unverified models or invent version/capability/price metadata.
- Acceptance: UI labels match server catalog and authorization tests.

### Phase 8 — Studio and media workflows
**Goal:** Provide focused image, video, audio transcription, and related media tools.
- Keep Studio specialized; allow the central Agent to invoke media tools from chat and return results to conversation/Library.
- Preserve provider freeze, cost guardrails, private delivery, content validation, and ownership.
- Acceptance: upload/generation/delivery failures, permissions, cost controls, and result linking are verified.

### Phase 9 — Library, files, and generated artifacts
**Goal:** Give users a secure, searchable home for owned resources.
- Preserve existing media ownership and delivery mechanisms; add organization/search/preview/download only where supported.
- Verify signed URLs, expiry, ownership, quotas, deletion/retention semantics, and cross-user isolation.
- Acceptance: file lifecycle and access-control tests pass.

### Phase 10 — Projects and conversation organization
**Goal:** Make project workspaces reliable and tenant-isolated.
- Reconcile the open Projects PR and existing merged implementation before any closure or branch cleanup.
- Preserve owner-scoped CRUD, conversation association, archive/restore, and deletion semantics.
- Acceptance: cross-user isolation and conversation/project integrity regressions pass.

### Phase 11 — Account, preferences, and security controls
**Goal:** Consolidate profile, locale, appearance, sessions, privacy, notifications, and account support.
- Preserve authentication/session behavior and server-verified profile/plan data.
- Acceptance: account lifecycle, session security, RTL/LTR, and preference persistence verified.

### Phase 12 — Subscriptions, wallet, credits, and accounting
**Goal:** Align product UX with a correct, auditable financial system.
- Inspect current schema, grants, expiry, ledger, holds, settlement, renewal, plan entitlements, and historical balances before proposing changes.
- Monthly plan allowance and never-expire purchased credits are approved target policies, but must be reconciled with current records, migrations, legal disclosures, and safe rollout.
- Keep unresolved prices, grant quantities, ad rewards, deduction priority, daily caps, FX, and credit conversion unapproved until costed and explicitly decided.
- Preserve atomic idempotent reserve/settle/release and charge only performed work.
- Acceptance: reconciliation, rollback, concurrency, duplicate callback, cancellation, and historical-balance tests pass before any production change.

### Phase 13 — Rewards and promotional credits
**Goal:** Add transparent, abuse-resistant rewards without corrupting accounting.
- Verify actual ad-network callbacks before granting rewards; client claims alone are not proof of a completed ad.
- Enforce caps, idempotency, fraud controls, source-level ledger, and approved expiry/limits.
- Acceptance: replay, spoof, concurrency, and reward-accounting tests pass.

### Phase 14 — Admin operations and governance
**Goal:** Maintain a secure operational control plane.
- Review admin authorization, provider/model catalog, evidence, routing, pricing, users, HIMS, credits, rewards, finance, ads, support, and audit.
- Least privilege, dual review for sensitive changes where appropriate, immutable audit trail, safe disable/quarantine.
- Acceptance: role matrix and RPC/RLS/function matrix verified.

### Phase 15 — Integrations, notifications, and background operations
**Goal:** Make supported integrations and asynchronous services reliable.
- Review connector permissions, OAuth/token storage, revocation, webhook signatures, retries, queue schedules, notification preferences, and observability.
- Acceptance: failure/retry/revocation and data-isolation checks pass.

### Phase 16 — Security hardening, reliability, and performance
**Goal:** Resolve cross-cutting risks discovered across all prior phases.
- Run database advisors, RLS/grant/RPC audit, dependency review, secret scan, input validation, rate limits, abuse controls, logging/privacy review, and performance/load checks.
- Review queue contention, worker limits, lease expiry, idempotency, provider outage/freeze, and graceful degradation.
- Acceptance: all high/critical findings fixed or explicitly accepted by owner with compensating controls; no secrets exposed.

### Phase 17 — Integration, release preparation, and handover
**Goal:** Assemble the finished product and prepare a controlled release.
- Reconcile all routes, features, data, migrations, configs, model metadata, billing, HIMS, Studio, Library, and admin.
- Prepare release notes, rollback plan, operational runbook, support guidance, and environment checklist.
- Run the Track B comprehensive test plan only after all development phases are integrated.
- No production deployment or production data mutation without explicit owner approval.
- Acceptance: all release gates documented, Track B completed, known issues disclosed, and owner explicitly authorizes release.

## 5. Immediate execution order and stop/go gates

1. Maintain this plan and the separate Track B plan in GitHub.
2. Close Phase 1 audit gaps using current source and repository evidence.
3. Close Phase 2 HIMS security defects only with reviewed migrations, targeted tests, and safe rollback. Never mutate production authorization casually.
4. Close Phase 3 code/test gaps; mark real-user/content tests as owner-blocked until safe test accounts and actual lecture source are available.
5. Close Phase 4 shared tokens/components/automated accessibility foundation; record any screen-by-screen checks that cannot be honestly completed without browser/device access.
6. Run relevant CI and inspect the exact current commit's workflow jobs.
7. Update both plans and the canonical 17-phase roadmap with evidence.
8. **Stop and report to the owner once Phases 1–4 meet their acceptance gates. Do not start Phase 5 before that report.**
9. After the owner has been informed, continue the unified design and UX implementation in sequence through Phases 5 onward, using the approved design spec and preserving all existing capabilities.

## 6. Required execution log

For each phase, maintain:
- Status and date;
- changed files/migrations/PRs/commits;
- tests and exact results;
- security/data impact;
- remaining limitations and owner dependencies;
- rollback or recovery notes;
- next permitted phase.

Never change the status to complete based on documentation alone.


## 7. Execution snapshot — 2026-11-16

- Both master-plan files are now committed on `develop`.
- Phase 1: **DONE — VERIFIED at source-audit level**. Inventory and critical-flow matrix: `docs/PHASES_1_4_BUILD_AUDIT.md`.
- Phase 2: **IMPLEMENTED — REVIEW REQUIRED**. Read-only hosted checks confirmed HIMS table isolation, RLS, RPC grants, fixed search paths, and server-side admin checks. Duplicate activation-code hash reactivation was found. Guard migration and rollback-only regression test are committed, but not applied/executed; do not call Phase 2 complete yet.
- Phase 3: **IMPLEMENTED — OWNER-BLOCKED for live acceptance**. Code-level intent/resource tests exist; actual student activation and lecture delivery need owner-approved test accounts and real course content.
- Phase 4: **IMPLEMENTED — REVIEW REQUIRED**. Theme tokens/primitives exist; muted text contrast was improved, core chat/Home/HIMS surfaces were migrated to semantic tokens, and expanded Jest checks were committed. Current-commit CI and complete screen/browser/device accessibility checks are pending.
- **Stop gate:** Phase 5 is not started. The first four phases remain open until the listed verification gaps are closed.
- No hosted database migration, production deployment, secret change, model/provider routing change, billing change, credit adjustment, or HIMS entitlement mutation was performed.
