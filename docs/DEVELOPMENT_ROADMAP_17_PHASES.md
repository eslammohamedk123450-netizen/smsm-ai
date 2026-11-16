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

**Owner direction (2026-11-16):** Prepare and organize the existing HIMS environment and authorized content-delivery path now. Defer student account, lecture retrieval, and end-to-end experience testing until the owner supplies test accounts and the real lecture/content source.

**Environment path inspected (code/schema only):**
- The central `ai-router` calls `isFeatureResourceRequest` before loading feature context. Greetings and general study questions do not satisfy the explicit resource-intent patterns; short follow-ups such as “send it” are recognized only when recent user messages mention a lecture/file/resource.
- `suly_feature_context(uuid)` is executable by `service_role` only and reads active feature resources; the router adds the resulting resource context only for an activated feature and an explicit resource request.
- Private HIMS media delivery in `media-gateway` requires both `suly_profiles.hims_activated = true` and an active `suly_feature_resources` row referencing that exact media asset.
- The profile entitlement column is now additionally protected by revoked client DML grants. The HIMS resource-gating rollback regression from PR #116 passed.
- This confirms the code/schema delivery path is prepared; it does not prove real student downloads until the owner supplies content and test accounts.

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

**Current status:** [~] The five-section navigation foundation is merged (PR #95), and the Home screen has been refreshed in the current work branch. Source review confirms five primary destinations, a mobile bottom bar, a responsive web sidebar at wide widths, native keyboard-aware bottom-bar hiding, and safe-area handling. The refreshed Home screen adds a clearer SULY welcome/primary action, four focused section shortcuts, and recent-chat loading/empty/error/retry states. PR #117 merged to `release/v1` as `fbce76281424adfc61903537dd603d776b6a5c39`. CI passed Expo TypeScript typecheck, mobile auth regression tests, static Expo Web export, Android/iOS JavaScript bundle exports, Deno Agent/Edge tests and typecheck, Edge bundle verification, and media billing guardrails. GitHub Pages build and deployment also reported success. Route-click, visual browser, native installation, and real-device regression testing is still required.

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

**Current status:** [>] The original set of 57 authenticated-executable SECURITY DEFINER function bodies has now been reviewed individually. After the new least-privilege migration, 56 remain executable by authenticated clients; the separate anonymous share-token endpoint remains intentional. Current classification: 42 functions contain a direct admin guard, 12 are caller/session-scoped, 1 legacy provider toggle delegates to the guarded lifecycle RPC, and 1 public-share function is scoped by its exact share token. All 56 authenticated-executable functions have fixed search_path settings. Targeted fixes and rollback-only SQL regressions passed; Deno Agent/Edge Function tests and typecheck, Edge bundle verification, and media billing guardrails also passed in PR #117 CI. Real authenticated HTTP/UI flows, true multi-session activation concurrency, and the full Phase 16 matrix remain open.

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
2. Finish Phase 5 Home/navigation implementation and its code-level checks; report the exact delivered experience to the owner.
3. After the Phase 5 report, continue through Phases 6–17 in their official order without skipping or parallelizing phase scope.
4. Keep HIMS content testing deferred until the owner supplies real test accounts and the lecture/content source.
5. Keep leaked-password protection deferred until the owner upgrades to a plan that exposes the setting.
6. Update this roadmap after every meaningful PR and produce the final owner-input report.

---

**Source of truth:** Current code, migrations, database state, CI evidence, and merged PRs take precedence over stale notes. When evidence conflicts, investigate and update this document rather than silently choosing the more optimistic status.

---

## 7. Dated execution log — 2026-11-16

### Session: Initial Supabase security triage and next-work baseline

**Target baseline:** `release/v1` at the currently reviewed project state on 2026-11-16.  
**Scope:** Read-only inspection of Supabase Security Advisor and PostgreSQL catalog metadata. No database rows, grants, policies, functions, migrations, or application code were changed in this audit pass.

#### Work performed
- Re-read this canonical roadmap before beginning.
- Queried Supabase Security Advisor for security, performance, and health findings.
- Inspected PostgreSQL catalog metadata for exposed `SECURITY DEFINER` functions, effective EXECUTE privileges, configured search paths, RLS-enabled tables with no policies, and effective client DML grants.
- Inspected the public conversation-share function definition and share-token column type.
- Reviewed current GitHub workflow status for the release baseline.

#### Verified findings

1. **RLS-enabled tables with no policies: 10.**
   - `agent_step_usage`
   - `agent_tool_execution_checkpoints`
   - `brain_attempt_logs`
   - `brain_usage_daily`
   - `brain_usage_events`
   - `cloudinary_integration_settings`
   - `composio_integration_settings`
   - `suly_image_generation_settings`
   - `suly_rewarded_ad_claims`
   - `tavily_integration_settings`
   
   The catalog check found no effective SELECT/INSERT/UPDATE/DELETE privileges for either `anon` or `authenticated` on these ten tables. This is consistent with server-only/service-role access and RLS fail-closed behavior. The Advisor warning is therefore **not, by itself, evidence of public table exposure**. Remaining check: inspect each server-side access path and confirm that service-role access is limited to trusted Edge Functions.

2. **SECURITY DEFINER inventory:**
   - 114 SECURITY DEFINER functions exist in the `public` schema.
   - 57 are executable by `authenticated`.
   - Exactly 1 is executable by `anon`: `suly_get_public_conversation(uuid)`.
   - All 57 authenticated-executable SECURITY DEFINER functions have an explicit function-level search_path setting (including the intentionally empty search_path used by the task cancellation function).
   - The catalog scan found no authenticated-executable SECURITY DEFINER function missing both an `auth.uid()` check and an explicit `suly_is_admin()` check, except the public conversation-share function, whose intended anonymous access is reviewed separately below.
   
   The count of 57 is an inventory count, **not 57 confirmed vulnerabilities**. Each function still requires classification by intended caller, ownership checks, admin checks, data returned, and mutation scope.

3. **Public conversation sharing:**
   - `suly_get_public_conversation(uuid)` is intentionally executable by anonymous users and reads a conversation using its `share_token`.
   - The share token column is UUID typed.
   - The function returns the conversation title and up to 300 user/assistant messages.
   - This may be the intended public-link feature, not an accidental exposure. Before changing grants, verify token generation, uniqueness, entropy, revocation behavior, and that the UI only enables sharing after explicit owner action. **Do not revoke anonymous execution until this product flow is confirmed**, because doing so could break shared-conversation links.

4. **Advisor interpretation:**
   - Security Advisor reported the 10 no-policy tables and the anonymous/authenticated SECURITY DEFINER counts described above.
   - The performance Advisor reported unindexed foreign keys (65 findings in the reviewed result). These are performance candidates, not automatically security issues; index additions must be justified against existing indexes and write cost.
   - Health Advisor returned no findings in the reviewed result.
   - Extensions in `public` (`vector`, `pg_net`) were reported by the Security Advisor. Do not relocate extensions without checking dependencies and Supabase-supported migration procedure.

5. **Release workflow baseline:**
   - Latest reviewed web deployment workflow on the current release SHA completed successfully.
   - Latest reviewed OTA publish workflow failed because `EXPO_TOKEN` was unavailable to GitHub Actions. No OTA publication is claimed.
   - This audit did not perform a visual browser test or authenticated end-to-end user journey.

#### Changes made
- No application code or database changes in this audit pass.
- This execution record is being added to the canonical roadmap so the next contributor can distinguish verified observations from pending investigation.

#### Remaining work — security triage
- [>] Inspect all 57 authenticated-executable SECURITY DEFINER functions in batches, grouping them into admin-only, self-owned user operations, internal/service-only candidates, and intentionally public operations.
- [>] Inspect the complete definition and caller path of `suly_get_public_conversation(uuid)`; verify share-token uniqueness/generation/revocation and explicit sharing UX before changing its grant.
- [>] Trace service-role-only access to the ten no-policy tables through Edge Functions; verify no client-supplied user ID or untrusted parameter can cross user boundaries.
- [>] Review model/provider administrative RPCs for policy bypasses, especially model re-enable/reset operations versus provider lifecycle and route allowlists. Admin-only access is not a substitute for correct state-transition rules.
- [>] Review the 65 unindexed-FK findings against existing indexes; add only indexes proven useful and non-duplicative.
- [x] Mapped current extension dependencies. Keep `vector` and `pg_net` in their current placement for now; do not relocate without a dedicated compatibility migration and full regression.
- [x] Added rollback-only regression coverage for profile DML isolation, safe profile RPC continuity, admin/non-admin RPC behavior, model-health reset state preservation, and the legacy provider lifecycle wrapper.
- [x] Re-ran Security Advisor after the hardening migration: 10 intentional server-only RLS/no-policy INFO findings, 2 extension-placement WARN findings, 1 intentional public-share SECURITY DEFINER WARN, and 56 authenticated SECURITY DEFINER WARN findings remain.
- [ ] Update this log with exact migration IDs, changed functions, tests, deployment evidence, and remaining risks.

#### Owner input / blockers
- No owner decision is required to continue read-only inspection.
- OTA release publication remains blocked until the owner configures `EXPO_TOKEN` as a GitHub Actions secret. Never place the token in source code or the roadmap.
- Public conversation sharing must be preserved unless the owner confirms the feature should be removed; current safe approach is to verify and harden it, not disable it.

#### Next concrete action
Continue the function-by-function security review, beginning with the anonymous public-share function and high-impact administrative state-changing RPCs. Make no production permission or schema changes until the relevant caller flow and regression coverage are understood.

### Session continuation: Public sharing and model-routing state transitions

**Scope:** Read-only verification of public conversation sharing, route-assignment RPCs, provider lifecycle controls, and relevant current admin UI call sites. No database or application changes were made.

#### Additional verified findings

1. **Public conversation sharing — intended path confirmed by schema and function inspection.**
   - The share-token column is UUID and has a UNIQUE index/constraint.
   - The owner-only `suly_set_conversation_sharing(uuid,boolean)` RPC requires an authenticated user and updates only a conversation whose `user_id = auth.uid()`.
   - Enabling sharing creates a token with `gen_random_uuid()`; disabling sharing sets the token to NULL, revoking the public link.
   - Anonymous direct SELECT on `suly_conversations` and `suly_messages` is blocked by the RLS policies, which are scoped to the authenticated role and the owning user (plus the separate admin conversation-read policy).
   - The only anonymous SECURITY DEFINER RPC, `suly_get_public_conversation(uuid)`, reads by exact share token and returns the title plus at most 300 user/assistant messages.
   - **Assessment:** The anonymous function is consistent with the explicit public-share feature, not evidence of a general anonymous conversation read. Preserve it. Remaining test: exercise enable → public fetch → revoke → public fetch returns no conversation using two authenticated test accounts and an anonymous request.

2. **Model routing administration — current route RPC reviewed.**
   - `suly_admin_save_route_models(text,integer[])` is executable by authenticated users but first requires `suly_is_admin()`.
   - The latest database definition requires one primary and allows at most one backup; it validates enabled model/provider, `free_race` routing group, health restriction state, task-role compatibility, and chat capability/media-model exclusions before replacing a role's assignments in the function transaction.
   - Direct INSERT/UPDATE/DELETE grants on `ai_route_model_assignments` are revoked from `public`, `anon`, and `authenticated`; authenticated SELECT remains available for the admin UI.
   - The current admin UI saves role assignments through the guarded RPC.
   - **Assessment:** No anonymous or ordinary-user route mutation path was found in the inspected database grants/RPC. Continue testing admin/non-admin RPC behavior and the model-capability edge cases before marking routing security complete.

3. **Provider lifecycle — correct UI path confirmed, legacy alternative remains.**
   - The current admin screen calls `suly_admin_set_provider_lifecycle` when toggling a provider.
   - Disabling through that lifecycle RPC disables the provider, route assignments, subscription-profile assignments, media-generation model activation, and clears legacy direct model overrides.
   - The older `suly_admin_set_provider_enabled` RPC remains executable by authenticated users but is also guarded by `suly_is_admin()`. Its implementation only toggles provider/model enabled flags and does not perform the full lifecycle freeze.
   - The current admin-service file still contains a helper for the older RPC, but the inspected current provider-toggle UI uses the lifecycle RPC.
   - **Assessment:** This is an admin-only legacy state-transition inconsistency, not an anonymous privilege escalation. Do not revoke or remove it until all call sites and older-client compatibility are checked. Recommended follow-up: remove the unused helper and revoke the legacy RPC's authenticated EXECUTE grant only after confirming no supported client depends on it.

4. **Model health reset — explicit admin action.**
   - `suly_admin_reset_model_health(integer)` requires admin authorization, clears the health restriction counters, and sets the model's `enabled` flag to true.
   - The current admin UI presents a confirmation explicitly stating that the action re-enables the model.
   - It does not itself re-enable disabled route-assignment rows; provider enabled status is still checked by routing.
   - **Assessment:** This is a documented privileged administrative action, not a user-facing bypass. Test that a disabled provider remains frozen after health reset and that reset does not restore route/profile assignments disabled by provider lifecycle.

#### Updated security status
- No confirmed anonymous table-read or ordinary-user administrative RPC bypass was identified in the inspected paths.
- The public-share anonymous RPC is intentional and guarded by a unique owner-generated UUID token; keep it pending end-to-end revocation tests.
- The 10 RLS/no-policy tables remain server-only by effective client grants.
- One legacy provider-toggle RPC is an admin-only lifecycle inconsistency and needs compatibility review.
- The full review of all 57 authenticated-executable SECURITY DEFINER functions is **not complete**. Do not mark Phase 16 complete.

#### Next concrete action
Continue auditing the remaining authenticated SECURITY DEFINER functions in groups, checking exact row ownership, privilege boundaries, returned columns, dynamic SQL, and mutation scope. In parallel, inspect Edge Function service-role access to the ten server-only tables. Only after the relevant paths are mapped should targeted regression tests and any least-privilege migration be prepared.

### Session continuation: Provider credential read isolation — implemented and database-verified

**Finding confirmed:** PostgreSQL ACLs showed `authenticated` had table-level SELECT on `public.ai_providers`. Its RLS policy limited rows to administrators, but an administrator using the client Data API could still read all columns, including `api_key`, `encrypted_api_key`, and `api_key_vault_id`. This violated the server-only credential invariant.

#### Compatibility investigation
- Searched current mobile/web source for direct `ai_providers` table reads. No client-side direct SELECT was found.
- The current admin provider list uses `suly_admin_list_providers()`, whose return shape contains only non-secret metadata.
- The inspected Edge Function references use server-side provider access; `service_role` is retained.
- Before the change, the ACL was SELECT-only for `authenticated`; `anon` had no SELECT, and `service_role` retained SELECT/INSERT/UPDATE/DELETE.

#### Change implemented
- Migration: `20261116100513_restrict_provider_secret_table_read.sql`
- Database migration name/version: `restrict_provider_secret_table_read` / `20261116100513`
- Change: `REVOKE SELECT ON TABLE public.ai_providers FROM authenticated;`
- Regression test added: `supabase/tests/provider_secret_access_regression.sql`
- GitHub PR: [#110 — revoke client read access to provider credentials](https://github.com/eslammohamedk123450-netizen/smsm-ai/pull/110)
- Database migration was applied successfully to the connected Supabase project on 2026-11-16. The PR is the source-control handover for the migration and test.

#### Verification performed
- Executed the regression SQL against the connected Supabase database: **PASS**.
- Post-migration catalog check confirmed:
  - `anon` SELECT on `ai_providers`: false.
  - `authenticated` SELECT on `ai_providers`: false.
  - `authenticated` SELECT on `api_key`, `encrypted_api_key`, and `api_key_vault_id`: false.
  - `service_role` SELECT on `ai_providers`: true.
  - Authenticated EXECUTE on safe `suly_admin_list_providers()`: true.
  - Anonymous EXECUTE on that admin RPC: false.
- Regression test also confirmed a non-admin authenticated context is denied by the admin-list RPC.
- No provider secret value was selected, copied, or exposed during this work.

#### Remaining verification
- [~] Confirm the real admin UI still loads provider metadata through the safe RPC in an authenticated browser session. The database function signature and grants are preserved, but no visual/browser session test was available in this work session.
- [ ] Run the full Edge Function integration smoke test to confirm server-side provider lookups continue to work with `service_role`.
- [ ] Re-run the full app build and admin regression suite after PR merge.
- [ ] Continue auditing the remaining authenticated-executable SECURITY DEFINER functions; this targeted fix does not complete Phase 16.

**Current status:** The database access restriction is implemented and its privilege regression test passed. The corresponding migration/test are in PR #110 pending source-control merge and app-level verification.

#### Post-fix regression expansion — 2026-11-16
- Re-ran `supabase/tests/provider_secret_access_regression.sql`: **PASS**.
- Re-ran `supabase/tests/model_routing_governance_regression.sql`: **PASS**; required routes, provider-enabled eligibility, media/provider freeze, and direct route-write denial remain intact.
- Re-ran `supabase/tests/model_price_admin_access_regression.sql`: **PASS**; non-admin access to pricing mutation RPCs remains denied.
- Inspected the current `sync-models` Edge Function: it uses a server-side service-role client for provider reads, separately validates the caller JWT and administrator status using the caller-scoped client, and returns discovery counts/status rather than the API key.
- Current app code references provider metadata through the guarded admin RPC; no direct mobile/web read of `ai_providers` was found in the code search.
- These SQL regressions and code inspection do not replace a live authenticated admin UI test or full provider request smoke test.

**Updated status:** Database privilege hardening and three targeted SQL regressions are complete. PR #110 remains subject to its current GitHub Actions checks before merge.

### Next security finding identified: Activation-code attempt throttling

**Status:** [x] IMPLEMENTED — database migration applied, regression checks passed, PR #111 merged, and ai-router v53 deployed ACTIVE.

#### Evidence
- `suly_activate_feature(uuid,text)` is restricted to the service role, hashes the submitted code with SHA-256, locks the matching activation-code row, checks active/expiry/max-use conditions, and increments usage atomically. It does not expose the raw stored code.
- The admin UI's default code generator uses Expo Crypto `randomUUID()`, producing a high-entropy UUID-based bearer code. The UI also permits an administrator to enter a custom code of 12 or more characters.
- In `ai-router/index.ts`, activation is processed before the later `reserve_credits` call. The earlier `suly_claim_ai_request` RPC provides idempotency and request ownership checks, but it is not a request-rate limiter.
- The legacy `suly_check_ai_rate_limit(uuid)` was changed by migration `037_credit_gated_text_chat_no_daily_limit.sql` to delegate text-chat gating to credits; its current implementation no longer increments the old `suly_ai_rate_limits.request_count` or applies a request limit.
- The existing `suly_ai_rate_limits` table remains RLS-protected from client roles and service-role-only, but its old per-user counter is not currently used by the activation path.

#### Assessment
- No direct way for an unauthenticated user to call `suly_activate_feature` was found; the RPC requires the service role and is invoked by the authenticated chat Edge Function.
- Generated UUID-based codes have high entropy, so this is not evidence that those codes can practically be guessed.
- However, the activation path currently has no explicit per-user attempt throttle before checking a custom or weak code, and activation commands return before the credit reservation. This leaves an avoidable abuse/guessing path if a manually entered code is predictable. External platform-level rate limits were not verified and must not be assumed.

#### Implementation and verification — 2026-11-16
- Reused `suly_ai_rate_limits` rather than creating a duplicate table. Added separate activation-only window/count/last-attempt columns, leaving legacy/general AI counters untouched. Database inspection found no active function referencing the old table counters after the credit-gating change.
- Applied migration `20261116101305_feature_activation_attempt_throttle` to the connected Supabase project.
- Added `suly_check_feature_activation_rate_limit(uuid)`: service-role-only, SECURITY DEFINER with fixed `search_path`, per-user row lock (`FOR UPDATE`), 5 attempts per 15-minute window, and a 3-second minimum interval. The row lock serializes concurrent attempts for the same user.
- The Edge Function checks the limiter before `suly_activate_feature`. If the limiter is unavailable, explicit activation fails closed without checking the code. Throttled responses do not reveal whether a submitted code exists. Bare-code messages preserve the existing ordinary-chat fallback.
- SQL regression executed against the connected database: **PASS** for RLS/ACL, service-role-only RPC execution, fixed search path, row-lock presence, five allowed attempts, sixth-attempt denial, cooldown denial, and window reset. Test changes were rolled back.
- The regression verifies the row-lock implementation and sequential limits; a multi-session concurrency stress test and full authenticated chat activation smoke test remain outstanding.

#### Remaining verification
- [x] PR #111 merged into release/v1 (merge commit bf03b01820e371df069d11e8489b68cae5a96eea).
- [x] ai-router deployed to Supabase as version 53, status ACTIVE; existing verify_jwt=false setting preserved. Retrieved deployed function source and confirmed the activation throttle RPC call is present.
- [x] Database activation regression: valid code activates, repeat activation returns already_active, and max-use accounting increments only once (transaction rolled back).
- [x] Database public-share regression: owner enables sharing, token fetch returns the bounded payload, owner revokes, and the same token no longer resolves (transaction rolled back).
- [ ] Run authenticated chat smoke tests for activation, throttled explicit commands, and ordinary conversation behavior when owner-provided test accounts are available.
- [ ] Confirm ordinary chat and HIMS resource retrieval remain unchanged in a real authenticated session when owner-provided test accounts and the real lecture source are available.

**Current status:** Database protection is applied and SQL-verified, and the Edge Function change is merged and deployed. Phase 16 remains open until authenticated end-to-end tests and the broader security audit are complete.



### Supabase Security Advisor review — 2026-11-16

**Scope:** Read-only security, performance, and health advisor scan after the provider-secret isolation and activation-throttle migrations. This is a triage snapshot, not a claim that every warning is a vulnerability.

#### Security advisor findings and disposition

- **10 rls_enabled_no_policy INFO findings:** The listed tables have RLS enabled and no client policies. The earlier ACL review found no anon or authenticated table privileges for these server-side tables; this is intentional service-only isolation, not a reason to add permissive client policies. Keep them closed and verify each server access path as it is audited.
- **2 extension_in_public WARN findings:** `vector` is used by three live `vector(1536)` columns (`agent_memories`, `ai_response_cache`, `user_task_memories`), each with an HNSW cosine index. `pg_net` backs `net.http_post` calls in the scheduled model-health check, model-recovery, and agent-task-scheduler functions; the three corresponding cron jobs are active. No extension move was made. Keep the current placement until a separately reviewed, Supabase-supported migration proves every type/operator/function/cron dependency remains valid.
- **1 anon SECURITY DEFINER WARN:** public.suly_get_public_conversation(uuid) is the intentional public-share endpoint. Its lookup is by the exact share token, it returns only the conversation title and up to 300 user/assistant messages, and revocation clears the token. Preserve this feature; the enable → anonymous fetch → revoke → anonymous fetch regression remains an end-to-end test item.
- **56 authenticated SECURITY DEFINER WARN after hardening (57 in the original audit inventory):** This linter finding means signed-in users can invoke SECURITY DEFINER functions; it does not by itself prove unauthorized access. The original 57 function bodies were reviewed individually. One legacy media self-registration RPC was removed from client EXECUTE; the remaining functions were classified by direct admin guard, delegated admin guard, caller/session ownership, or intentional public-share token lookup. Do not mass-revoke EXECUTE because legitimate app and admin workflows depend on guarded RPCs.
- **1 auth_leaked_password_protection WARN:** Supabase Auth leaked-password protection remains disabled. The owner explicitly deferred this because the current plan does not expose the setting; revisit it after upgrading to a plan that supports the feature. Do not claim it is enabled in the meantime.

#### Additional security review evidence

- The activation limiter function is service-role-only, uses a fixed search_path, serializes each user's attempts with FOR UPDATE, and has SQL regression coverage for client ACL denial, 5 attempts per 15 minutes, 3-second cooldown, and window reset.
- The ai_providers direct authenticated SELECT grant remains revoked; the safe admin metadata RPC and server-side service-role access remain intact.
- The 10 RLS-without-policy tables were not opened to clients to silence the advisor. No destructive cleanup or broad privilege change was made based only on lint output.

#### Next security priorities

1. Keep the 57-function semantic review evidence current; revisit any changed SECURITY DEFINER function in the same PR that modifies it.
2. Run authenticated end-to-end tests for public-share revocation, activation flows, media ownership, and admin RPC denial for non-admin users.
3. Revisit leaked-password protection only after the owner upgrades to a plan that exposes the setting.
4. Map vector and pg_net dependencies before deciding whether either extension can be moved safely.

**Phase 16 status:** IN PROGRESS — targeted fixes and SQL regressions are complete, but the full function audit, account-level setting, and authenticated end-to-end coverage are not yet complete.


#### SECURITY DEFINER source-level inventory — 2026-11-16

- Current catalog query classified the 57 authenticated-executable SECURITY DEFINER functions as: 42 functions whose source contains the administrator guard helper, 14 functions scoped to caller/session identity, and one public-share function scoped by an unguessable share token. This is a source-level classification, not proof that all 56 guarded functions have been semantically audited.
- Catalog verification: all 57 authenticated-executable SECURITY DEFINER functions have an explicit fixed search_path; 0 are missing it. The only anonymous-executable SECURITY DEFINER function remains suly_get_public_conversation(uuid), the intentional share-token endpoint.
- Additional database regression: valid activation, already_active idempotency, and max-use accounting **PASS**; public-share enable/fetch/revoke/token invalidation **PASS**. Both tests ran inside transactions and were rolled back, leaving production data unchanged.
- Reviewed function bodies for representative high-impact paths: cancel_agent_task_job, suly_claim_daily_credits, suly_effective_subscription_tier, suly_media_register_self, suly_media_register_self_v2, suly_media_attach_to_message, suly_my_feature_resources, suly_upsert_my_profile, suly_admin_update_provider, and public-share lookup. These inspected paths enforce owner identity, administrator membership, service-role restriction, or exact share-token lookup as appropriate.
- Remaining: inspect the full bodies of all 57 functions individually for edge cases in dynamic SQL, row mutation scope, returned fields, and helper-call semantics. Do not treat the static counts as closure of Phase 16.


### Feature flag registry write isolation — 2026-11-16

**Finding:** public.suly_feature_flags is the registry that maps feature keys to profile columns. The table had RLS enabled and only an active-row SELECT policy, so authenticated client writes were already denied by RLS. However, authenticated still held table-level INSERT/UPDATE/DELETE and related DML grants. Because several SECURITY DEFINER routines use profile_column values from this registry in identifier-safe dynamic SQL, the broad client grants were unnecessary defense-in-depth exposure.

**Fix applied:** migration 20261116102324_revoke_feature_flag_client_writes revokes INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER from PUBLIC, anon, and authenticated. Authenticated SELECT remains for active feature metadata. service_role and SECURITY DEFINER admin RPC paths retain their required mutation privileges. No registry rows or feature flags were changed.

**Regression executed against Supabase: PASS** — RLS remains enabled; authenticated SELECT retained; authenticated/anon DML denied; service_role DML retained; guarded admin grant RPC remains executable and contains the administrator check.

**Current status:** Database migration applied and regression passed; PR #114 merged into release/v1 (merge commit e0cd1d3acdf5c576a414fe5de5a19eff63e23cb4). This hardens the metadata registry without changing HIMS activation behavior or normal chat.


#### HIMS and provider table boundary cross-check — 2026-11-16

- public.suly_feature_resources: authenticated/anon have no table grants; RLS remains enabled. The authenticated SELECT policy is not independently sufficient without a grant, so student resources continue through the owner/activation-checked SECURITY DEFINER RPC path.
- public.suly_feature_activations and public.suly_activation_codes: service_role only table privileges; client roles have no grants and have explicit deny-client RLS policies. Raw activation codes are not stored; the admin list RPC returns no plaintext code.
- public.suly_feature_flags after PR #114: authenticated retains SELECT only (RLS restricts it to active flags); all client DML grants are revoked. service_role retains required administration access.
- public.ai_providers after PR #110: authenticated and anon have no table privileges; service_role retains access. The admin UI continues through the guarded metadata RPC, which excludes credential fields.
- These checks support the intended rule: students read eligible resources through the central chat/RPC path, while activation records, raw provider credentials, and feature registry mutations remain server-controlled.

- HIMS resource access regression executed against Supabase: **PASS** — a temporary active HIMS resource was invisible to an active but unactivated test profile, then visible after the profile's HIMS activation flag was enabled within the test transaction. The transaction was rolled back; the temporary resource was confirmed absent afterward and the profile was unchanged.


### Session: SECURITY DEFINER audit closure pass and Phase 5 Home implementation — 2026-11-16

**Working branch:** `work/phase16-security-phase5-home-20261116`  
**Base:** current `release/v1` at `4a8f3f20a63523a68b0d4d1d4e41b5c6f925397c`.  
**Scope:** Complete source-level review of the original 57 authenticated-executable SECURITY DEFINER functions, apply narrowly scoped permission/state fixes, map extension dependencies, prepare HIMS without content testing, and implement the Phase 5 Home screen refinement. No real user passwords or provider credentials were used.

#### SECURITY DEFINER review — verified results

- Reviewed the complete function definition of each of the original 57 authenticated-executable SECURITY DEFINER functions, including caller identity, admin guard/delegation, row ownership, dynamic SQL, returned fields, and mutation scope.
- After the client-EXECUTE revocation below, the current catalog reports **56 authenticated-executable SECURITY DEFINER functions**, **1 anonymous-executable public-share function**, and **0 functions missing an explicit fixed search_path**.
- Current classification of the 56 authenticated-executable functions:
  - 42 contain a direct `suly_is_admin()` guard.
  - 12 are scoped to the caller/session identity.
  - 1 legacy provider-toggle function delegates to the full guarded provider-lifecycle RPC.
  - 1 public conversation-share function uses the exact share token and is intentionally available to anonymous callers.
- The legacy `suly_set_model_settings` planner/summarizer preference remains an admin-only preference that only reorders candidates already admitted by the current role-filtered route pool. It does not bypass the strict role allowlists, but it is a legacy secondary preference control to reconcile with the single-source routing UX during the later Conversations/routing phase.

#### Security fixes applied to the connected Supabase project

Migration: `harden_profile_writes_and_model_health_reset`, database version `20261116104027` (source file `supabase/migrations/20261116104027_harden_profile_writes_and_model_health_reset.sql`).

1. **Profile entitlement write isolation**
   - Revoked client INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges on `public.suly_profiles` from PUBLIC, anon, and authenticated.
   - Authenticated SELECT remains available under the existing self/admin RLS policy; service-role and SECURITY DEFINER server workflows remain available.
   - This closes direct client write access to sensitive columns such as `hims_activated`, `is_banned`, and `subscription_tier`.
   - The supported `suly_upsert_my_profile` RPC was tested under a normal authenticated identity simulation and continued to update only its intended profile fields.

2. **Legacy media-registration RPC**
   - Revoked PUBLIC/anon/authenticated EXECUTE on `suly_media_register_self(...)`.
   - Repository code search found no current app call site; the current supported upload flow uses the `media-gateway` Edge Function and the scoped `suly_media_register_self_v2(...)` RPC.
   - The v2 RPC remains executable by authenticated users and its existing feature/owner/conversation/ticket guards remain intact.

3. **Model health reset**
   - Replaced `suly_admin_reset_model_health(integer)` so it clears automatic health restriction state without changing `ai_models.enabled`.
   - It now preserves a model that the administrator manually disabled and writes an `admin_audit_logs` event.
   - This prevents a health reset from unintentionally reactivating a quarantined or administratively disabled model.

4. **Legacy provider toggle**
   - Replaced `suly_admin_set_provider_enabled(integer,boolean)` with a compatibility wrapper that delegates to `suly_admin_set_provider_lifecycle(...)`.
   - Older clients can no longer invoke the partial provider toggle path that skipped route/profile/media freeze behavior.

#### Database regression evidence

Executed `supabase/tests/profile_and_model_health_security_regression.sql` against the connected database: **PASS**. The test is rollback-only and verifies:
- Authenticated profile DML is revoked while SELECT remains.
- Service-role profile UPDATE remains.
- Safe profile upsert still works for a normal authenticated identity simulation.
- Legacy media registration client EXECUTE is revoked while v2 remains available.
- The legacy provider toggle delegates to the full lifecycle guard.
- Admin identity can list safe provider metadata and reset model health.
- A normal authenticated identity is denied by the admin provider-list and model-health-reset RPCs.
- Resetting model health does not re-enable a manually disabled model.

Also re-executed the activation-throttle SQL regression: **PASS** for client ACL denial, service-role-only execution, fixed search_path, `FOR UPDATE` row locking, five allowed attempts, sixth-attempt denial, 3-second cooldown, and window reset. All test counter changes were rolled back.

**Not yet performed:** a true multi-session concurrency stress test and authenticated chat HTTP/UI smoke test. The owner will provide test-user accounts later; do not use the owner's live account as a substitute. The row-lock implementation and sequential regression are verified, but they are not claimed as proof of a real concurrent request test.

#### Admin permission testing approach

- Database authorization tests used existing admin and non-admin user subjects in simulated JWT claim contexts inside rollback-only SQL transactions.
- This verifies the database RPC guards without requiring passwords or exposing login credentials.
- It does **not** replace a real browser/app login and admin UI journey. That is deferred until the owner provides test accounts.

#### Extension dependency decision

- `vector` is used by `agent_memories.embedding`, `ai_response_cache.embedding`, and `user_task_memories.embedding`, all typed `vector(1536)` and backed by HNSW cosine indexes.
- `pg_net` is called through `net.http_post` by the scheduled model-health check, model-recovery, and agent-task-scheduler functions. Their cron jobs are active (daily, every 20 minutes, and every minute respectively).
- No extension relocation was attempted. Current warnings remain documented/accepted until a dedicated compatibility migration is designed and proven.

#### Owner-deferred items and HIMS preparation

- Leaked-password protection remains disabled by owner decision until the owner upgrades to a plan that exposes the setting. This is an accepted deferred item, not a code fix.
- HIMS work for this session is limited to preparing the existing environment and preserving the current entitlement/content access boundary. Student experience testing and real lecture delivery are deferred until the owner supplies test accounts and the actual lecture/content source.
- No synthetic course content or fake student test results were created.

#### Phase 5 route and access source audit

- The five navigation destinations remain `/home`, `/conversations`, `/studio`, `/media`, and `/settings`.
- Existing routes remain in the protected Expo route tree: `/tasks`, `/chat`, `/hims`, `/balance`, `/upgrade`, `/support`, `/integrations`, `/image-studio`, and `/video-studio`.
- `/hims` redirects to the central chat as designed; no separate HIMS assistant or main-navigation destination was introduced.
- The Settings screen still exposes balance/credit history, support, and connected apps. Dedicated balance and upgrade routes remain available.
- Admin routes remain outside ordinary navigation. The protected admin layout checks `suly_is_admin()`, redirects denied users to Home, and fails closed if the check errors.
- Navigation source inspection confirms mobile bottom navigation, keyboard-aware hiding on native, a web sidebar at widths of 900px or more, and SafeArea handling.
- This is a route/source audit only; actual navigation clicks, visual browser testing, and Android/iOS device checks remain outstanding.

#### Phase 5 Home implementation in this branch

Updated `apps/mobile/src/features/home/HomeScreen.tsx`:
- Reworked the landing hero into a clean SULY workspace welcome with a direct New Conversation action.
- Added four clear shortcuts: Conversations, Tasks & Agent, Studio, and Library.
- Reframed recent chats as a continue-work section, with pinned state, correct RTL/LTR chevrons, and direct conversation reopening.
- Added explicit loading, empty, error, retry, and refresh states.
- Reused existing auth, chat, theme, locale, and navigation services; no new dependencies, tables, routes, or parallel chat behavior were introduced.
- All visible text supports Arabic/English and layout direction follows the current locale.
- The existing five-section navigation and route mapping were preserved; no HIMS, account, admin, credit, support, or legacy routes were removed.

**Verification limitation:** no browser/visual device session is available in this work session. The source is ready for repository CI typecheck/export and later visual route/device regression. Do not claim visual verification until that is performed.

#### Remaining work before reporting Phase 5 complete

1. [x] GitHub Actions typecheck, mobile auth tests, Deno Agent tests/typecheck, Edge bundle verification, media billing guardrails, Expo Web export, and Android/iOS JavaScript exports passed on the code commit in PR #117.
2. Review and merge PR #117 only after final diff/branch-head verification.
3. Re-check the deployed web entry and preserve the existing five-section navigation.
4. Run route-click checks for HIMS, Library, credits/plan, support/integrations, and admin access; perform actual visual/device tests when a test session is available.
5. Stop after Phase 5 and report the delivered Home experience and remaining verification. Continue to Phase 6 only after that report, following the approved 17-phase order.

#### Current status

- **57-function source audit:** completed for the original inventory; current client-executable count reduced to 56 after retiring the legacy media RPC.
- **Targeted security hardening:** implemented and database-regression verified; source PR/CI review pending.
- **Activation concurrency:** implementation and sequential lock regression verified; true concurrent stress test deferred to owner-provided test accounts.
- **Admin permissions:** database identity simulation passed; real admin UI/session verification deferred to test accounts.
- **Extension relocation:** intentionally not performed; current dependency map supports retaining the current placement.
- **HIMS:** environment/boundary preparation only; content and student E2E testing deferred.
- **Phase 5 Home:** PR #117 merged and GitHub Pages deployment succeeded. Code CI passed (TypeScript, auth tests, Web static export, Android/iOS JS exports). Visual route/device regression remains.




### Phase 6 continuation — conversation mode selector placement — 2026-11-16

- Re-inspected the current `release/v1` chat screen, chat service, execution-mode resolver, intent classifier, and unified-agent architecture before changing code.
- Confirmed the Auto/Lite/Pro/Max profile selector was rendered immediately above the composer, inside the keyboard-adjacent area. This contradicted the approved requirement that model mode selection remain in the chat header/top area and not compete with the keyboard.
- Moved the existing selector into a dedicated row directly below the conversation app bar. The profile choices are horizontally scrollable on narrow screens; existing localized labels, tier-lock checks, profile descriptions, and request payload semantics are unchanged.
- No model routes, subscription rules, credit logic, Agent orchestration, database schema, or provider settings were changed.
- Implementation is in PR #119: https://github.com/eslammohamedk123450-netizen/smsm-ai/pull/119
- Branch: `feat/phase6-conversation-header-mode-20261116`; initial commit: `cb342edac36933b945b9938e4d43846faf9ff398`.
- GitHub Actions run `43853785434` was in progress at the time of this record. Do not mark this change verified/merged until Expo typecheck, mobile regression tests, Web/Android/iOS exports, and Deno Agent tests/typecheck pass.
- Visual browser/device confirmation remains unavailable and is not claimed.
- Existing PR #83 for project workspaces remains open and based on an older release SHA; GitHub reports it as not mergeable. It was not merged or rebased automatically. Reconcile its changes against current release before using it in the Phase 6/9 work, to avoid stale or conflicting implementation.

**Phase 6 status:** IN PROGRESS. This is a targeted UI correction only; remaining work includes authenticated chat/Agent end-to-end coverage, real task/stream/cancel/retry/partial-billing verification, actual model-used display where server evidence is available, and a broader conversation UI review.

### Post-merge verification — 2026-11-16

- **PR #117:** merged successfully into `release/v1`.
- **Release commit:** `fbce76281424adfc61903537dd603d776b6a5c39`.
- **Supabase migration:** `20261116104027_harden_profile_writes_and_model_health_reset` is applied; post-migration catalog confirms 56 authenticated-executable public SECURITY DEFINER functions, 1 anonymous-executable public-share function, and 0 missing fixed search_path configurations.
- **PR CI passed:** Expo TypeScript typecheck; mobile authentication regression tests; static Expo Web export; Android JavaScript export; iOS JavaScript export; Deno Agent/scheduler tests and typecheck; Edge Function bundle verification; media billing guardrails.
- **GitHub Pages deployment:** workflow run `43852894653` completed successfully. The static build artifact was exported, uploaded, and deployment reported success for:
  `https://eslammohamedk123450-netizen.github.io/smsm-ai/`
- **Visual verification limitation:** the deployment action succeeded, but this session could not retrieve/render the page in a browser. Do not treat deployment success as proof of visual correctness or authenticated user flows.
- **Expo OTA update:** workflow run `43852894585` failed before publishing because the GitHub Actions secret `EXPO_TOKEN` is missing. No OTA update was published. Owner action is required only if EAS OTA publishing is desired; this does not block GitHub Pages deployment.
- **Post-merge verification:** the Deno/Expo workflow triggered by the release push was still running at the time of this note; the PR CI run for the exact code changes had already passed. Check the release-push run before considering the post-merge workflow fully closed.

**Phase 5 stopping point:** Home implementation is merged and the Web static site deployment succeeded. Stop here for the owner report. Do not start Phase 6 until the owner has received this report. Remaining Phase 5 checks are visual/browser, actual route clicks, authenticated navigation, and Android/iOS device installation.
