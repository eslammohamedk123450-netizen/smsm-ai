# SULY — 17-Phase Development Roadmap & Execution Tracker

> **Purpose:** This is the canonical project-development handover document. Every developer, agent, or contributor must read it before changing the product. It records the product intent, approved decisions, phase scope, current evidence-based status, outstanding work, blockers, and verification requirements.
>
> **Last reviewed:** 2026-11-16  
> **Target branch:** `release/v1`  
> **Working rule:** Update this document in the same change/PR that materially advances a phase. Never mark work complete merely because code was written or merged.

---

## 1. How to read and update statuses

Use exactly one primary status per work item:

- **[x] DONE — VERIFIED:** Implemented and passed the relevant checks. State what was tested and where.
- **[~] IMPLEMENTED — REVIEW REQUIRED:** Code or configuration exists, but functional, security, cross-platform, or end-to-end verification remains.
- **[>] IN PROGRESS:** Work is actively being implemented.
- **[!] BLOCKED — OWNER INPUT:** Cannot safely proceed without a user-owned secret, business decision, legal text, account access, or other explicit input. Record the exact request and safe interim behavior.
- **[ ] NOT STARTED:** No implementation evidence yet.
- **[-] NOT APPLICABLE:** Explain why; do not use this to hide unfinished scope.

A phase may contain a mixture of statuses. The phase is **not complete** until all required items are verified or explicitly accepted as deferred by the product owner.

For every completed item, record:
1. PR/commit/migration or exact artifact;
2. tests executed and their results;
3. remaining limitations;
4. date of verification.

Do not claim visual, production, Android, iOS, or end-to-end verification unless that exact test was actually performed. CI build success is not proof that a user journey works.

---

## 2. Product vision and non-negotiable decisions

SULY is a unified AI product with a natural conversational experience, agentic task execution, creative tools, a file library, account services, and an integrated educational benefit. It must feel like a polished AI product—not like a collection of disconnected systems or an education-only application.

### Product structure
The five primary user areas are:
1. **Home** — entry point, useful shortcuts, recent work, and clear product discovery.
2. **Conversations** — normal chat and the single central SULY agent.
3. **Studio** — image, video, audio generation, and audio transcription.
4. **Library** — saved files, generated outputs, documents, and task artifacts.
5. **Account** — profile, preferences, security, plan, billing, storage, help, and app information.

On mobile, use a suitable bottom navigation pattern; on web, use a responsive sidebar/navigation layout. Preserve safe areas, keyboard behavior, deep links, and existing working routes.

### One central agent
- There is **one central SULY agent** responsible for understanding the user, planning complex work, choosing tools/models, coordinating bounded workers, and reporting results.
- Do not create multiple independent agents/brains that compete or make conflicting decisions.
- Preserve the existing task runtime, DAG/dependency handling, checkpoints, leases, cancellation, idempotency, and usage ledger.
- Model roles (chat, planner, worker, reviewer, summarizer) are constrained execution roles, not separate product assistants.
- Show the actual model used where appropriate. Auto/Free/Pro/Max are selection modes/profiles, not necessarily subscription names.

### HIMS / HRMS educational entitlement — not a separate chat product
The existing education feature is an entitlement integrated into the **same ordinary SULY conversation**:
- An administrator creates an activation/access code and sends it to a student.
- The student sends the code as a normal chat message.
- On successful validation, the student gains the authorized educational access.
- The student then continues using the same chat and the same central agent. No separate chatbot, independent assistant, or separate chat page is to be introduced for this entitlement.
- If the student asks for a lecture, course file, or educational resource they are authorized to access, the agent should retrieve and deliver the relevant resource.
- If the student asks a general study question, answer normally and use educational search/retrieval when useful.
- Greetings, small talk, unrelated questions, and ordinary conversation must remain natural. Do not mention HIMS/HRMS, activation, or the education system on every turn. Do not inject promotional/system-status messages unless an actual activation or access event requires a concise confirmation.
- Keep authorization, resource access, and audit enforcement on the server. A client-side flag or a message in chat is never proof of entitlement.
- Preserve the existing system and its data; do not replace it with a new parallel system.

### Security, data, and compatibility invariants
- Do not remove, disable, or silently change an existing working feature to simplify a redesign.
- Do not create duplicate tables or a parallel routing/billing system before inspecting the existing schema and code.
- Never expose provider secrets, service-role keys, or privileged credentials to the mobile/web client or repository.
- Store a provider credential once per provider on the server; do not duplicate the same API key in every model row.
- Enforce authorization server-side and use least privilege, RLS, fixed search paths for privileged database functions, validation, rate limits, audit trails, and idempotency where applicable.
- Do not expose plaintext activation codes after creation; store and verify secure hashes where the design supports it.
- Preserve historical usage, billing, model, and audit records. Prefer quarantine/disable over destructive deletion.
- Newly discovered/unverified models remain disabled and are not automatically routed.
- Keep provider-offline/disabled behavior fail-closed: no new calls to a disabled provider.
- Maintain Expo compatibility for Web, Android, and iOS from the shared application codebase.
- Primary languages: Arabic and English, with correct RTL/LTR behavior throughout the app.

### Pricing and credits
- Approved target margin for chargeable provider-backed services: **selling price = provider cost × 1.40**.
- Do not apply a 40% uplift to zero-cost/free promotional services; use an explicit separate policy.
- Keep provider cost, customer price, margin, currency, unit, precision, effective dates, and pricing version distinguishable and auditable.
- Support the correct unit for each service (for example input/output tokens, image, video second, audio minute). Never compare or convert unlike units.
- Never guess EGP/USD conversion rates or credit value. If required conversion settings are missing, disable charging/generation safely and ask the product owner.
- Reserve/settle/release credits atomically and idempotently. For cancelled work, charge only the work actually performed according to the approved ledger rules.

---

# 3. The 17 development phases

## Phase 1 — Audit the existing project and map all functionality

**Goal:** Establish a reliable baseline before changing architecture or UI.

Scope:
- Inspect repository structure, app routes, components, services, edge functions, database schema, migrations, RLS policies, storage buckets, triggers, scheduled jobs, secrets/configuration references, and deployment workflows.
- Inventory every user-facing feature and admin capability, including HIMS, chat, tasks/agents, credits/wallet, subscriptions, media, library/files, integrations, support, and analytics/audit.
- Trace critical flows from UI → API/edge function → database/provider → response and billing.
- Identify duplicate/obsolete code, dead routes, inconsistent data models, missing tests, and risky assumptions without deleting anything prematurely.
- Establish a baseline of TypeScript, Deno, SQL regression, Expo export, and CI/deployment checks.

Acceptance:
- A maintained feature/system inventory exists.
- Each critical flow has an owner and verification status.
- No existing feature is removed as part of the audit.

**Current status:** [~] Initial audits and multiple schema/repository reviews have been performed. A single complete, maintained inventory and full flow matrix still need to be finalized.

Evidence/notes:
- Prior security foundation and model-routing governance migrations exist.
- Continue from the actual current `release/v1` state; do not replay old assumptions blindly.

## Phase 2 — Protect HIMS and preserve its operation

**Goal:** Secure the existing education entitlement without turning it into a separate product.

Scope:
- Preserve existing HIMS tables, resources, admin workflows, and historical records.
- Verify administrator-only code creation, secure code hashing, expiration/usage limits if supported by the existing design, one-time/controlled redemption, replay prevention, and audit events.
- Verify student identity and entitlement on the server for every protected resource request.
- Prevent students from forging an entitlement by editing local storage, request bodies, profile fields, or chat messages.
- Prevent one student from accessing another student's lectures/files.
- Apply least-privilege RLS and storage object authorization.
- Rate-limit activation attempts and ensure error responses do not leak code validity details unnecessarily.
- Ensure disabling/revoking access follows the established business rules and is auditable.

Acceptance:
- Admin can create/manage codes only with server-confirmed admin permission.
- Student can redeem only an eligible code under the defined rules.
- Unauthorized, expired, reused, forged, or cross-user requests are rejected.
- No regression to existing HIMS data or administrator workflows.

**Current status:** [~] Important security foundations have been merged, including hashed activation-code handling and protected student resources. Full adversarial and end-to-end student/admin verification remains.

Known evidence:
- PR #92 — activation-code security/hash work.
- PR #93 — student resource access protection.
- Database advisor/security checks and broader function review remain part of Phase 16.

## Phase 3 — Complete the HIMS student experience inside normal chat

**Goal:** Deliver authorized educational content naturally through the existing SULY conversation.

Scope:
- Activation code is submitted as a normal chat message and validated securely.
- After successful activation, show one concise confirmation; do not create a new chat, page, assistant, or independent system.
- When a student requests a lecture/resource, identify the relevant course/lecture and verify entitlement before returning a signed/authorized download or view link.
- When the student asks a general academic question, respond naturally and use approved search/knowledge sources where appropriate.
- Greetings and unrelated requests must not invoke HIMS or trigger repetitive education-system announcements.
- Do not force every conversation into an educational intent.
- Handle ambiguous lecture requests with a concise clarification only when necessary.
- Preserve conversation history and normal SULY agent behavior.
- Support resource availability, missing-content, and access-denied cases with clear user-facing messages.
- Admin content management remains in the existing admin experience. The product owner may supply actual lecture/content sources later; do not invent course content.

Acceptance:
- Activation, ordinary chat, academic Q&A, lecture retrieval, unauthorized access, and missing-resource scenarios pass integration tests.
- No repeated HIMS branding/system explanation on greetings or unrelated messages.
- Resource access is enforced server-side.

**Current status:** [~] Conversational intent behavior was improved and merged; the core experience still needs full student-session testing and verified lecture delivery.

Known evidence:
- PR #96 — conversational HIMS behavior: ordinary greetings/small talk should not trigger the education workflow; general study questions remain natural.
- One active HIMS resource was observed in the database at the latest review. The owner still needs to provide/confirm the real lecture/content source before content completeness can be verified.

## Phase 4 — Establish the visual identity and shared design system

**Goal:** Make all product areas visually consistent, accessible, and maintainable.

Scope:
- Establish design tokens for surfaces, text, borders, spacing, radii, typography, elevations, icons, and interaction states.
- Approved direction: clean, calm, premium white/black visual foundation with light and dark themes; avoid copying another product's identity.
- Use suitable Arabic/English fonts and consistent hierarchy.
- Build reusable buttons, fields, cards, dialogs, menus, empty states, loading states, error states, and navigation components.
- Ensure contrast, focus/pressed/disabled states, responsive layouts, and accessibility.
- Avoid inconsistent one-off colors/styles across screens.

Acceptance:
- Shared tokens/components are used by primary app sections and admin/HIMS surfaces.
- Both themes render consistently with accessible contrast.
- No existing feature is hidden or removed by the redesign.

**Current status:** [~] Design-system and theme foundations were merged. Complete visual audit across every screen and accessibility review remain.

Known evidence:
- PR #94 — visual identity/theme foundation.
- PRs #102 and #103 — theme improvements for admin and HIMS surfaces.

## Phase 5 — Reorganize Home, navigation, and the five primary sections

**Goal:** Provide a coherent five-section information architecture across mobile and web.

Scope:
- Home, Conversations, Studio, Library, Account are the five primary destinations.
- Mobile navigation must respect safe areas, keyboard visibility, and device layout.
- Web navigation should use a responsive sidebar or equivalent layout without creating a separate product.
- Preserve direct/deep links and old working routes (including chat/task, media, HIMS, support, integrations, billing, and admin).
- Home should be useful and focused rather than an overloaded dashboard.
- Keep admin access restricted and separate from ordinary user navigation.
- Ensure every existing capability remains reachable after the navigation migration.

Acceptance:
- All five areas are reachable on web and mobile.
- Legacy routes/deep links continue to work or have safe redirects.
- No keyboard overlap, safe-area obstruction, or lost navigation entry.
- HIMS remains accessible through the ordinary chat/authorized resource flow.

**Current status:** [~] Main five-section navigation has been merged, but route-by-route and device-level regression testing is still required.

Known evidence:
- PR #95 — five-section navigation.
- PR #95 must not be treated as proof that every legacy destination is still discoverable; explicitly verify HIMS, credits/plan visibility, library, and admin access.

## Phase 6 — Rebuild Conversations and the central SULY agent experience

**Goal:** Make conversation the natural interface to one reliable, capable agent.

Scope:
- Consolidate the conversational experience around one central agent and the existing task runtime.
- Support normal chat, long/complex tasks, planning, task progress, outputs, cancellation, retries, and useful status messages.
- Preserve DAG dependencies, bounded workers, checkpoints, lease fencing, idempotency, and durable task state.
- Cancellation must stop queued work and safely handle running work; bill only performed work as defined by the usage ledger.
- Preserve chat history, rename/pin/archive/delete semantics, attachments, and conversation navigation.
- Model selector Auto/Free/Pro/Max should be clear and located in the chat header/top area—not obscured above the keyboard.
- Show the real model used when available; do not claim a model was used if routing did not confirm it.
- The central agent selects model/tool according to task, permission, quality, latency, availability, and cost, with bounded safe fallbacks.
- Avoid unbounded loops, uncontrolled parallelism, hidden retries, arbitrary model fallback, and duplicate charges.
- HIMS academic requests are handled as a capability within this same agent/chat—not a parallel assistant.

Acceptance:
- Authenticated end-to-end tests cover chat, agent planning, tool calls, cancellation, partial billing, retries, and failure recovery.
- No duplicate execution/charge on retries.
- Model permissions and provider freeze rules are enforced on every new call.
- Normal greetings and simple questions remain fast and natural.

**Current status:** [~] Significant agent runtime and model-governance work is already merged. Full authenticated HTTP E2E, latency measurements, and complete chat UI verification remain.

Known evidence:
- PR #85 and earlier runtime work established strict model-role allowlists, guarded routing, provider freeze behavior, safe fallbacks, and regression checks.
- Some prior tests were static/Deno/SQL checks; do not mistake router time budgets for measured end-to-end user response time.

## Phase 7 — Complete SULY Studio (image, video, audio, transcription)

**Goal:** Provide a dedicated creative workspace, separate from chat execution and billing confirmation.

Scope:
- Studio is a primary section accessible directly from navigation and via a contextual card/link from chat.
- Chat may explain or suggest a media action, but it must not start generation or charge credits just because the user mentioned an image/video/audio request.
- User reviews the request/settings and explicitly confirms generation inside Studio.
- Support distinct service flows for image generation, video generation, audio generation, and audio transcription.
- Each service has its own verified models, parameters, input validation, pricing unit, progress state, failure handling, cancellation behavior, and output storage.
- Never show an unsupported model capability based only on its name.
- Separate provider-tested status from SULY integration-verified status and official vendor capability.
- Generation must be blocked if no enabled/verified model, price, currency conversion, or credit conversion exists.
- Persist output and metadata in Library when appropriate.
- Keep provider credentials server-side.

Acceptance:
- Each supported media flow passes a real provider integration test and an authenticated billing/settlement test.
- User confirmation is required before chargeable generation.
- No generation can bypass server-side credit checks.
- Failures release unused holds; partial work is charged only according to measured/verified usage.

**Current status:** [~] Studio UI foundation and moving image creation out of chat have been merged. Media billing safety checks pass, but full image/video/audio provider integration and conversion/pricing are not verified. Media models observed in the database were inactive; do not enable them until checks pass.

Known evidence:
- PR #104 — move media creation from chat into Studio.
- PR #105 — allow Studio credit reservation with a nullable conversation ID.
- Media Billing Guardrails workflow passed on the latest reviewed release commit.
- At last database review, four image model rows were inactive and the media-generation price table used by the credit conversion path was empty. Re-query before acting.

## Phase 8 — Complete SULY Library

**Goal:** Create one organized home for files and generated/user outputs.

Scope:
- Unified list of user-owned documents, uploads, generated images/videos/audio, transcriptions, and task artifacts.
- Search, filtering, type/category, folder organization, favorites, sorting, and clear file metadata.
- Preview where supported, safe download, rename where supported, and delete with appropriate confirmation.
- Show processing/failed/completed status for asynchronous outputs.
- Enforce per-user ownership on every list, preview, signed URL, download, and delete operation.
- Prevent path traversal, cross-user object access, public exposure of private files, and unsafe content handling.
- Keep storage lifecycle/retention behavior explicit; do not silently delete user files.
- Make outputs from Studio and agent tasks appear in the same Library where appropriate.

Acceptance:
- Authenticated user can access only their own files.
- Upload/download/preview/delete/favorites/folders/search pass tests.
- All media/task outputs are traceable to their originating job and usage record where applicable.

**Current status:** [~] A library/file experience exists in the project, but the complete requested organization (folders/favorites/filters) and end-to-end ownership/security verification remain.

## Phase 9 — Reorganize Account, settings, subscriptions, and billing

**Goal:** Make account management clear and keep entitlement decisions server-authoritative.

Scope:
- Profile and account details.
- Preferences, language, theme, accessibility, and notification preferences.
- AI preferences and model behavior preferences.
- Privacy and security: active sessions where supported, credential safety, account controls, and security notices.
- Plan/subscription, balance, credit history, billing/transactions, and renewal information.
- Storage and Library preferences.
- Help/support and About SULY.
- Keep admin-only functions outside ordinary user account access.
- Subscription tier, limits, and permissions must be resolved server-side; never trust client-provided plan labels or balances.
- Preserve existing payment/renewal and wallet ledger semantics.

Acceptance:
- Account settings persist correctly and are scoped to the authenticated user.
- Client cannot upgrade its own plan, alter balance, or grant itself privileges.
- Billing history reconciles with wallet/usage ledgers.

**Current status:** [~] Some settings and server-side subscription permission foundations exist. A full account information architecture and billing lifecycle audit remain.

Known evidence:
- Earlier subscription authorization work was merged (PR #82 in the prior history); verify current code before extending.

## Phase 10 — Import and govern the complete provider model catalog

**Goal:** Make the supplied provider catalog manageable from the admin panel without activating unverified models.

Scope:
- Reconcile the full user-supplied catalog (text, image, video, audio, transcription) with existing provider/model records.
- Preserve exact provider model IDs and service identifiers.
- One provider API credential is stored once on the server; do not duplicate secrets per model.
- Import all catalog entries and metadata needed for administration.
- Keep new/unverified entries disabled and out of routes by default.
- Admin can inspect, search, filter, enable/disable, and review model metadata with safe permissions.
- Track source of model metadata and last verification.
- Keep old/historical usage rows intact; quarantine rather than delete deprecated models.
- Distinguish model catalog presence from provider-tested and SULY-integration-verified states.

Acceptance:
- Catalog import is complete and reconciled against the supplied source.
- No duplicate model IDs or credential copies.
- Unverified models are not routable.
- Admin operations are atomic and audited.

**Current status:** [~] Catalog/governance foundation and pricing work exist, but full reconciliation against the complete supplied catalog and single-provider credential policy still need verification.

Known evidence:
- PR #99 — model catalog/pricing work.
- PR #101 — corrections to o3 and o3-pro pricing.
- Previous governance work quarantined unverified models and constrained route assignments.
- Re-read the original supplied catalog before any further import or price change; do not reconstruct it from memory.

## Phase 11 — Normalize model, capability, price, and routing data

**Goal:** Maintain a clean and auditable data model using existing tables where possible.

Scope:
- Inspect existing schema/migrations before creating or changing tables.
- Represent provider, credential reference, model, service type, capability claims, verification state, price versions, route assignment, health, and usage history without duplicating existing concepts.
- Capability states must distinguish:
  1. official capability stated by the model/vendor;
  2. provider-tested capability;
  3. SULY integration-verified capability.
- Maintain precise units/currency and immutable/versioned price history.
- Separate media service routing from the central agent's five execution roles.
- Preserve existing routing as the single source of truth; do not introduce a parallel router.
- Enforce uniqueness, foreign keys, constraints, indexes, and RLS.
- Keep administrative writes behind validated RPCs/server-side functions where appropriate.

Acceptance:
- Schema has no redundant competing sources of truth.
- Constraints prevent invalid route/price/model combinations.
- RLS and grants are tested for anon, authenticated, and service roles.
- Migrations are repeatable and rollback/forward recovery is documented.

**Current status:** [~] Existing model and routing governance tables/migrations are present. Full schema normalization, source reconciliation, and all-role RLS/constraint testing remain.

## Phase 12 — Model selection, routing, cost calculation, and 40% pricing

**Goal:** Route requests to suitable verified models and calculate customer charges accurately.

Scope:
- Central agent chooses from eligible models using task type, capabilities, quality, latency, cost, provider health, role permissions, and subscription policy.
- Enforce strict allowlists; no silent fallback to arbitrary models.
- Keep at most the approved primary/backup arrangement per role/route and validate assignments atomically.
- Provider disable/freeze must prevent all new requests to that provider, including media calls and direct overrides.
- Model health and measured latency should inform routing; do not infer success from catalog status.
- Apply approved 1.40 multiplier to chargeable provider cost.
- Maintain exact units and EGP pricing versions; store provider cost and customer price separately.
- For USD-based costs, use an explicitly configured and auditable FX rate with effective time. Do not invent it.
- Free models/services must follow a separate zero-cost promotional policy.
- Credit holds, settlement, partial execution, refunds/releases, and idempotency must reconcile.
- Media services use their own model/service pricing and do not get billed merely from chat intent.

Acceptance:
- Regression tests cover every route role, disabled provider, missing model, fallback, price boundary, FX conversion, zero-cost service, cancellation, duplicate webhook/retry, and partial billing.
- Displayed price matches server settlement.
- No unverified model is selectable or routable.

**Current status:** [~] Text-model governance and 40% pricing foundations exist. Media credit conversion is not complete; current price/FX settings and media price rows must be revalidated before enabling chargeable Studio generation.

Known evidence:
- PR #85 — model routing governance.
- PR #99/#101 — catalog/pricing changes.
- Do not interpret routing timeout budgets as measured full user-task latency.

## Phase 13 — Rebuild and secure the admin panel

**Goal:** Give administrators a clear control center without exposing privileged actions to ordinary users.

Required areas:
- Overview.
- Providers and credential status (never reveal full secrets).
- Model Catalog.
- Routing.
- Pricing & Profit.
- Health / Tests.
- Users.
- Security / Audit.
- Existing HIMS administration and other established admin tools must remain accessible.
- Add safe filters, pagination, loading/error states, confirmations, and audit history.
- Verify admin status on the server for every privileged operation.
- High-impact actions (provider disable, model activation, pricing changes, role/route edits, user privilege changes) require validated server-side operations and audit events.
- Keep provider secret values masked; show only safe metadata such as configured/not configured and last rotation if available.

Acceptance:
- Admin can complete intended workflows.
- Non-admin cannot read or invoke admin operations by direct API/RPC.
- Sensitive changes are atomic, validated, and audited.
- Existing admin features are not lost during navigation redesign.

**Current status:** [~] Admin navigation/theme and some model governance controls are present. Full functional and adversarial review of every admin area remains.

## Phase 14 — Complete light, dark, and system theme support

**Goal:** Provide consistent theme behavior across the whole app.

Scope:
- Light, dark, and system/automatic modes.
- Persist preference appropriately and respect system setting when automatic.
- Cover every user and admin screen, modal, menu, chart, input, empty state, error, loading state, and navigation component.
- Remove hard-coded colors that break the selected theme.
- Verify contrast and status colors in both themes.
- Avoid flash-of-wrong-theme on app startup.

Acceptance:
- Theme selection persists and works across navigation/restart.
- All major routes have been visually checked in all supported modes.
- No unreadable text, invisible controls, or mismatched surfaces.

**Current status:** [~] Theme foundation and multiple screen updates are merged. Full route-by-route visual verification remains.

## Phase 15 — Complete Arabic and English localization and RTL/LTR

**Goal:** Make both languages first-class across the entire product.

Scope:
- Centralize user-facing strings; avoid scattered hard-coded labels.
- Correct Arabic RTL and English LTR at screen, navigation, input, icon, list, modal, and text-alignment levels.
- Format dates, numbers, currency, and units appropriately without changing stored canonical values.
- Ensure mixed Arabic/English/model IDs/code snippets display correctly.
- Localize errors, empty/loading states, notifications, email templates, admin panel, Studio, Library, and HIMS messages.
- Persist language choice and support device/system default if appropriate.
- Do not machine-translate legal/business text and present it as approved policy without owner review.

Acceptance:
- All supported routes have no missing translation keys.
- RTL/LTR screenshots and interaction tests pass.
- Text does not overflow or reverse code, IDs, or numeric values incorrectly.

**Current status:** [~] Localization foundations exist, but full application/admin coverage and RTL/LTR verification are not complete.

## Phase 16 — Security, data integrity, and end-to-end functional testing

**Goal:** Test the product as an attacker and as a real user before declaring readiness.

Security test areas:
- Authentication, session handling, account isolation, authorization, admin escalation, RLS, storage, signed URLs, RPC grants, SECURITY DEFINER functions, search_path, and secret exposure.
- Activation-code brute force/replay, HIMS cross-student resource access, entitlement forgery, and resource link leakage.
- Provider credential exposure, model-route tampering, provider freeze bypass, prompt/tool injection, SSRF, unsafe URL/file handling, and untrusted tool outputs.
- Wallet/credits: negative balances, duplicate settlement, replay, race conditions, idempotency, cancellation, partial billing, refund/release, and concurrent requests.
- Rate limits, abuse controls, quotas, bounded task concurrency, worker leases, retries, and timeouts.
- Audit log integrity and sensitive data minimization.
- Dependency and build security where supported.

Functional tests:
- Sign up/login/session restore/logout.
- Chat, central agent, tools, long tasks, cancellation, task recovery, and history.
- HIMS activation and authorized lecture delivery within normal chat.
- Studio confirmation, generation, status, billing, and Library output.
- Library upload/download/search/folder/favorite/delete.
- Account/subscription/wallet/transactions.
- Admin provider/model/pricing/routing/users/security workflows.
- Offline/network failure and retry behavior where supported.

Acceptance:
- All critical tests pass with evidence.
- No unresolved critical/high security issue.
- Database and wallet ledgers reconcile.
- Any accepted residual risk is documented with owner approval.

**Current status:** [>] Security and workflow review is ongoing. Prior RLS/security foundations and model-routing regression tests exist, but this full test matrix is not yet complete.

Known constraints:
- Supabase Free plan may not provide every optional security feature. Record limitations and compensating controls; do not claim unavailable controls are enabled.
- A previous advisor review surfaced warnings that require triage by actual function grants/body and RLS, not by warning label alone.

## Phase 17 — Expo Web, Android, iOS validation and release

**Goal:** Ship a stable, tested experience on all intended platforms.

Scope:
- Expo Web static export/build and deployment.
- Android build/install/start/login/navigation/keyboard/safe area/deep links/file handling/notifications where supported.
- iOS build/install/start/login/navigation/safe area/deep links/file handling/notifications where supported.
- Confirm platform-specific dependencies and permissions.
- Test production environment configuration without committing secrets.
- Verify CORS, auth redirects, universal/app links as applicable, storage access, and edge-function connectivity.
- Verify web deployment URL and smoke-test real user flows after deploy.
- Verify OTA/build workflows and secret configuration; never report an OTA update as published if the workflow failed.
- Prepare release notes and rollback/recovery instructions.

Acceptance:
- Web deployment succeeds and core user flows pass.
- Android and iOS builds/installations and critical flows are verified on real or supported test devices.
- No platform has a broken critical path.
- Production secrets are stored only in appropriate secret managers.
- Final release report lists tested commit, artifacts, test results, known limitations, and rollback procedure.

**Current status:** [~] Web build/deploy succeeded on the latest reviewed release workflow. Expo OTA publish failed because `EXPO_TOKEN` was unavailable in GitHub Actions. Android/iOS end-to-end device validation remains outstanding.

---

# 4. Verified implementation history known at this review

This list is a starting evidence index, not a substitute for inspecting current `release/v1`:

| PR | Known purpose | Recorded state at 2026-11-16 |
|---|---|---|
| #82 | Server-side subscription permission foundation | Previously merged |
| #85 | Central model routing governance, strict role allowlists, provider freeze, safe fallbacks | Merged |
| #92 | HIMS activation code security/hash work | Merged |
| #93 | HIMS student resource access protection | Merged |
| #94 | Visual identity/theme foundation | Merged |
| #95 | Five-section navigation | Merged |
| #96 | Natural HIMS conversational behavior | Merged |
| #99 | Model catalog and pricing foundation | Merged |
| #101 | o3 / o3-pro pricing correction | Merged |
| #102–#103 | Admin and HIMS theme improvements | Merged |
| #104 | Move image creation from chat into Studio | Merged |
| #105 | Fix Studio credit reservation when no conversation ID exists | Merged |

Additional known checks from the latest reviewed release commit:
- Media Billing Guardrails workflow: **passed**.
- Edge Function deployment artifact verification: **passed**.
- Web build and deployment jobs: **passed**.
- Agent Deno typecheck: **passed**.
- Expo TypeScript check: was still in progress at the time of the last status query.
- OTA publish: **failed** because `EXPO_TOKEN` was not configured/available.
- Do not infer all app functions are live merely because these checks passed.

---

# 5. Open owner decisions / inputs — do not block unrelated work

Keep these items visible and proceed safely with all independent work:

1. **Expo OTA credential:** Owner must add a valid `EXPO_TOKEN` as a GitHub Actions repository secret. Never request or commit the raw token in source code or chat.
2. **Credit conversion settings:** Owner must confirm the approved EGP value of one credit and the USD→EGP rate/source/update policy, unless an existing approved configuration is found. Until then, do not activate chargeable media generation.
3. **Provider catalog source:** Re-read and reconcile the complete user-supplied catalog file from the project/library. Do not guess missing model IDs, capabilities, units, or prices.
4. **Single-provider confirmation:** Reconcile the existing multiple provider records against the approved one-provider/one-key design. Do not disable providers or rewrite routing until existing active production/test routes are mapped and safe migration is prepared.
5. **Lecture/content source:** Owner will supply or confirm the actual lecture files/source and course structure. Do not invent educational resources.
6. **Legal text:** Owner/legal reviewer must supply or approve Privacy Policy and Terms. Do not fabricate official legal terms.
7. **Device verification:** Owner/tester may need to provide Android/iOS test devices or report installation/device-specific failures if the environment cannot run those devices.

---

# 6. Execution protocol for every contributor

Before making a change:
1. Read this roadmap and inspect the current branch/commit.
2. Inspect the relevant implementation, migrations, tests, and existing data before editing.
3. Identify the exact phase and acceptance criteria affected.
4. Prefer small, reversible, focused changes.
5. Preserve existing user-visible functionality and data.
6. Do not add a dependency, new table, new provider, new agent, or new pricing assumption without demonstrating why it is required.
7. Keep secrets out of source control and client bundles.
8. Add/update tests alongside code.

Before marking work complete:
1. Run the narrow relevant test first, then broader type/build/security tests.
2. Inspect CI results and actual deployed function/version when deployment is part of the change.
3. Test the real authenticated flow where possible.
4. Record what was not tested.
5. Update the status and evidence in this file in the same PR.
6. Never mark a phase DONE if required owner input is outstanding or a critical acceptance test is unverified.

### Handover report format

For every work session, report:
- **Phase(s) touched**
- **What changed** (files, migrations, PRs)
- **What passed** (exact tests/results)
- **What remains**
- **Blockers / owner input**
- **Security/data risks**
- **Next concrete action**

### Immediate next work order

1. Re-check current CI and the latest `release/v1` commit.
2. Complete the phase 5 route/accessibility regression, including HIMS entry, Library, credits/plan visibility, and admin gating.
3. Complete Studio service separation and media billing readiness without enabling unverified models.
4. Finish Library and Account user journeys.
5. Complete the admin catalog/provider/pricing/routing workflows.
6. Complete localization/theme audits.
7. Run the full Phase 16 security and end-to-end matrix.
8. Complete Web/Android/iOS validation and release checks.
9. Update this roadmap after every meaningful PR and produce the final owner-input report.

---

**Source of truth:** Current code, migrations, database state, CI evidence, and merged PRs take precedence over stale notes. When evidence conflicts, investigate and update this document rather than silently choosing the more optimistic status.
