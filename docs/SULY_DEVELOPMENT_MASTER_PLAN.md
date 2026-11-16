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

Phases 1–4 implementation scope has been completed and reported. Their comprehensive runtime, live-user, browser/device, adversarial-security, and full-CI verification is carried into Track B. Continue Track A sequentially from Phase 5; do not block implementation progress solely on Track B tests.

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
- Existing implementation verified on `develop`: `MainNavigation.tsx` defines the five destinations, native bottom navigation hides while the keyboard is open, wide web uses a responsive sidebar, and route ownership maps chat/tasks/projects to Conversations, HIMS/media to Library, and settings/support/balance/upgrade/integrations to Account. Home, Conversations, Studio, Media/Library, Settings, and Projects routes exist; Conversations exposes project management and search.
- **Implementation status: COMPLETE — TRACK B route-click, browser/device, keyboard/safe-area, and visual checks deferred.** Do not duplicate or replace the existing navigation foundation; refine only when a concrete implementation defect or approved design requirement is identified.

### Phase 6 — Chat-first interface and central Agent experience
**Goal:** Make ordinary chat the simplest entry point and the Agent the single execution brain.
- Header: navigation control and verified selected-model label/dropdown.
- Agent classifies ordinary chat vs task execution automatically; no mode-selection burden or competing task-mode cards.
- Show task plan/progress/results, cancellation, retry, partial billing, and truthful model/tool provenance.
- Preserve streaming, attachments, history, projects, task runtime, DAG, bounded workers, leases, idempotency, and HIMS.
- Current `develop` implementation update: chat header now has a compact navigation menu and model selector dropdown; the menu links to new chat, conversations/search, projects, tasks, Studio, Library, credits, plans, integrations, and settings. The selector lists Auto and the three verified server profiles (Lite/Pro/Max), with plan-restricted entries disabled, and displays SULY Ultra as unavailable until a verified catalog/routing profile exists. The previous selector row above the composer was removed to keep the conversation area uncluttered. The actual server-confirmed model remains distinct from the selected profile. Authenticated app entry and successful password/OTP/Google/callback flows now land directly in `/chat`; Home remains available as a secondary destination. The empty chat state is simplified to a short welcome, a clear instruction to write naturally, and compact example prompts rather than large task cards. Support and Settings are separate menu destinations. The streaming indicator now shows the current localized task/status label and a localized Stop action.
- **Implementation status: IN PROGRESS.** Remaining Track A work includes full chat-first layout refinement and preserving/clarifying task progress, cancellation, retry, partial billing, and model/tool provenance. Comprehensive E2E, visual, browser/device, and accounting tests are Track B.

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
4. Complete Phase 3 implementation; defer real-user/content acceptance tests to Track B with safe test accounts and approved lecture source.
5. Complete Phase 4 shared tokens/components and semantic palette integration; defer screen-by-screen accessibility and browser/device checks to Track B.
6. Record all comprehensive CI, SQL migration execution, adversarial security, real-user, browser/device, and end-to-end acceptance tests in Track B; these tests do not hold implementation phases open.
7. Update both plans and the canonical 17-phase roadmap with source/change evidence and deferred test IDs.
8. Phase 1–4 implementation completion has been reported; their comprehensive checks remain in Track B.
9. Phase 5 navigation implementation is present on `develop` and recorded complete; preserve it.
10. Continue Phase 6 on `develop`: finish the chat-first header/menu/model selector and central Agent presentation, then report Phase 6 implementation status before Phase 7. Keep all comprehensive tests in Track B.

## 6. Required execution log

For each phase, maintain:
- Status and date;
- changed files/migrations/PRs/commits;
- tests and exact results;
- security/data impact;
- remaining limitations and owner dependencies;
- rollback or recovery notes;
- next permitted phase.

Never change the implementation status to complete based on documentation alone; verify that the scoped code/config/migration artifacts actually exist on `develop`. Comprehensive runtime acceptance remains a separate Track B result.


## 7. Execution snapshot — 2026-11-16

- Both master-plan files are now committed on `develop`.
- Phase 1: **DONE — VERIFIED at source-audit level**. Inventory and critical-flow matrix: `docs/PHASES_1_4_BUILD_AUDIT.md`.
- Phase 2: **IMPLEMENTATION COMPLETE — TRACK B VERIFICATION DEFERRED**. HIMS table isolation, RLS, RPC grants, fixed search paths, and server-side admin checks were reviewed. The duplicate activation-code collision guard migration and rollback-only regression SQL are committed to `develop`; isolated migration execution, rollback, and adversarial verification are Track B cases.
- Phase 3: **IMPLEMENTATION COMPLETE — TRACK B ACCEPTANCE DEFERRED**. Central-chat intent/resource paths and source-level regressions are present; real student activation and lecture delivery are Track B cases using safe test accounts and approved content.
- Phase 4: **IMPLEMENTATION COMPLETE — TRACK B VISUAL/DEVICE VERIFICATION DEFERRED**. Shared theme tokens, core chat/Home/HIMS semantic palette integration, and expanded contrast regression source are committed. Current-commit CI and full browser/device/accessibility checks are Track B cases.
- **Execution update:** Phase 1–4 implementation milestone reported; comprehensive tests deferred to Track B. Phase 5 five-area navigation and Home foundation are already present on `develop` and are treated as implementation-complete, with route/browser/device verification deferred to Track B. Continue Track A with Phase 6.
- No hosted database migration, production deployment, secret change, model/provider routing change, billing change, credit adjustment, or HIMS entitlement mutation was performed.
