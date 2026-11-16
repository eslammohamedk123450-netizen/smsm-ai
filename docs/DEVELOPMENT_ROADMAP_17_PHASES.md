# SULY — 17-Phase Development Roadmap & Execution Tracker

> **Purpose:** This is the canonical project-development handover document. Every developer, agent, or contributor must read it before changing the product. It records the product intent, approved decisions, phase scope, current evidence-based status, outstanding work, blockers, and verification requirements.
>
> **Last reviewed:** 2026-11-16 (two-track plan approved by the product owner)  
> **Working branch:** `develop` (all implementation and roadmap updates)  
> **Production branch:** `release/v1` (protected; no direct development work)  
> **Working rule:** The 17 phases below are the complete build, organization, integration, and implementation track. The independent comprehensive test track begins only after all 17 build phases and their integration work are complete. Routine developer/CI checks may still run during implementation to prevent regressions; they are not the final comprehensive test campaign. Never mark work complete merely because code was written or merged.
>
> **Authoritative plans:** [Unified Development Master Plan](SULY_DEVELOPMENT_MASTER_PLAN.md) (Track A) and [Independent Comprehensive Test Master Plan](SULY_COMPREHENSIVE_TEST_MASTER_PLAN.md) (Track B). These two files are maintained separately and must stay aligned with this execution tracker.
>
> **Current execution gate (2026-11-16):** Phases 1–4 implementation scope is complete and reported; their comprehensive verification is deferred to Track B. Phase 5 five-area navigation and Home foundation already exist on `develop`. Continue sequentially with Phase 6; do not duplicate the navigation foundation.

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

**Current status:** [x] DONE — VERIFIED (source-level audit). The maintained repository/system inventory and critical-flow ownership/evidence matrix are recorded in `docs/PHASES_1_4_BUILD_AUDIT.md`. Runtime journeys remain separately marked review-required or owner-blocked; this phase does not certify live user journeys.

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

**Current status:** [~] IMPLEMENTED — REVIEW REQUIRED. Live read-only checks on 2026-11-16 confirmed RLS enabled and client table privileges denied for activation codes, activations, and resources; admin RPCs require server-side admin checks, activation RPC is service-role-only, and student resource RPC is authenticated-only. A duplicate-hash reactivation flaw was confirmed in the applied creation RPC. A guard migration and rollback-only collision regression have been committed to `develop` (`20261116150000_hims_activation_code_collision_guard.sql`, `supabase/tests/hims_activation_code_collision_regression.sql`) but have not been applied or executed. Phase 2 remains open until migration/test verification and adversarial tests are complete.

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

**Current status:** [~] IMPLEMENTED — REVIEW REQUIRED / OWNER-BLOCKED for real-user acceptance. Source-level intent and resource-delivery gates plus Deno regressions exist. Actual student activation and lecture delivery remain unverified because owner-approved test accounts and the real lecture/content source have not yet been supplied. Do not use production student credentials.

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

**Current status:** [~] IMPLEMENTED — REVIEW REQUIRED. Shared semantic light/dark tokens and reusable UI primitives exist. On 2026-11-16, muted text tokens were strengthened, contrast regression coverage expanded to all shared content surfaces, and the chat header/empty state, Home brand mark, and HIMS download action were migrated to semantic tokens. The new test is included in the existing mobile test command. Exact CI and full screen/browser/device accessibility review are still pending.

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

**Current status:** [x] IMPLEMENTATION COMPLETE ON `develop` — Track B verification deferred. The five-section navigation foundation is present in `apps/mobile/src/components/navigation/MainNavigation.tsx`; source review confirms five primary destinations, mobile bottom navigation, responsive wide-web sidebar, native keyboard-aware bottom-bar hiding, and safe-area handling. The Home screen provides a welcome/primary action, focused shortcuts, and recent-chat loading/empty/error/retry states. Conversations provides search and a Projects entry; existing routes remain reachable through the five areas and secondary links. Earlier PR #117/PR #95 evidence and CI/deployment history are retained below as historical evidence, not a claim that the current `develop` head has passed those runs. Route-click, visual browser, native installation, and real-device checks are assigned to Track B.

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

**Current status:** [~] Studio UI foundation and moving image creation out of chat have been merged. A fresh read-only production DB inspection on 2026-11-16 found 4 media-generation model rows, 0 active; 0 rows in `suly_media_generation_prices`; 22 current rows in `suly_media_model_price_versions`; and 0 generation jobs. Therefore image generation remains unavailable because the runtime price table is empty and models are inactive, despite the separate 22-row price catalog. Do not enable models or populate runtime prices until a verified, audited mapping from catalog version/unit/EGP cost to provider USD cost, FX rate, and credit conversion is established. Video UI remains an explicit not-ready placeholder; audio and transcription have no end-to-end generation paths verified.

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

**Current status:** [~] Core organization features are implemented and merged; full visual/device and authenticated user-journey verification remains.

Verified implementation evidence (2026-11-16):
- PR #124 merged into `release/v1` as commit `c077526ae8033d3a04db0fc336e1d81b4f922065`.
- Added owner-scoped `suly_media_folders`, `suly_media_asset_folders`, and `suly_media_favorites` with RLS and composite owner-bound foreign keys.
- Added folder create/rename/delete, folder filtering, move/remove asset, favorites filtering/toggle in the existing Library screen.
- Rollback-only SQL regression passed for owner visibility, non-owner invisibility, cross-owner association rejection, and no residual fixture rows.
- PR checks passed: Expo TypeScript, Deno edge-function typecheck, currency-safe media billing tests, edge-function bundle verification, and media-billing guardrails.
- GitHub Pages deployment after merge completed successfully (workflow run `43858798658`). Expo OTA update failed (workflow run `43858798753`) because repository secret `EXPO_TOKEN` is missing; owner must add it in GitHub Actions secrets before OTA can publish.
- No visual browser or physical-device test is claimed.

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

**Current status:** [~] The Account information architecture and existing Plans/Subscription + Library entry points are implemented and merged (PR #125); authenticated profile mutation, payment/renewal lifecycle, and full billing verification remain open.

Verified code review and current implementation (2026-11-16):
- Existing settings screen already shows authenticated profile name/email, theme mode (system/light/dark), language (Arabic/English), server-loaded credit balance and recent ledger entries, support, conversation archive, integrations, privacy/terms notices, admin-only dashboard entry, and sign-out.
- Existing upgrade screen loads active plans/features and obtains the current tier from `suly_effective_subscription_tier`; it does not let the client grant a tier. Paid upgrade actions are explicitly not yet available.
- Added direct Account navigation to the existing Plans & Subscription screen and the existing Library screen; no duplicate billing or storage subsystem was introduced.
- Added display-name editing through Supabase Auth user metadata plus the existing `suly_upsert_my_profile` RPC. Email/identity fields remain server-derived; direct client writes to `suly_profiles` remain revoked. The name update is implemented but awaits CI and authenticated-session verification.
- PR #125 merged into `release/v1` as `965e6fc8809adb13af72a536755bf70609a7dd16`. CI passed: Expo TypeScript, mobile auth regression, static Web export, Android JS bundle, iOS JS bundle, and Deno Agent/scheduler tests/typecheck. The UI edit is code-reviewed and build-verified; authenticated end-user profile mutation still requires a real test session.
- Existing privacy/terms sheet explicitly states that official policy text/links are not configured. This remains an owner/legal-input blocker before public launch; no policy wording has been invented.
- Read-only Supabase audit (2026-11-16): 7 profile rows; 2 credit accounts; 174 holds (171 settled, 3 expired); 353 credit transactions (174 reserve, 171 settle, 3 expire, 4 admin_adjust, 1 daily_grant). No rows exist in either `suly_user_subscriptions` or legacy `user_subscriptions` at audit time.
- Credit ledger structural checks: zero holds missing a reserve event; zero settled holds missing a settle event; zero expired holds missing an expire event; zero settled holds missing `settled_at`. The 3 expired holds have `settled_at` as expected by the existing stale-hold release function.
- Credit-account snapshot check: no negative account balances and no mismatch between accounts and each user's latest ledger snapshot. One account has no ledger rows and has zero balance/reserved balance.
- `suly_credit_pricing` has no configured `credit_value_egp` or `usd_to_egp`; do not enable paid media or invent conversion settings. This is also a Phase 12 owner-input blocker.

Remaining Phase 9 work:
- Audit profile editing and identity synchronization against the hardened profile-write RPC; add only supported fields and preserve auth identity ownership.
- Audit subscription renewal/payment lifecycle and reconcile wallet/credit ledger semantics; do not add client-side payment or plan mutation.
- Determine which privacy/security/session controls are actually supported by the current auth provider; do not display fake session-management controls.
- Add/verify storage usage and notification preference screens only if backed by existing server/data capabilities.
- Run authenticated user-flow and billing reconciliation tests; no test user credentials have been supplied.
- Obtain owner-approved privacy policy and terms links/text before public launch.

Known evidence:
- PR #82 — server-side subscription permission foundation.
- PR #124 — Library navigation target now exists at `/(protected)/media`.
- This phase remains incomplete until its acceptance criteria and billing reconciliation are verified.

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

**Current status:** [~] Exact source-ID reconciliation is now complete for the 65 unique model/service identifiers extracted from the complete supplied file; all 65 are represented across the existing text-model registry and media price catalog. Remaining work is provider-account consolidation/owner confirmation, metadata completeness, and end-to-end admin workflow verification.

Verified database audit (2026-11-16):
- Source file was read in full (1,133 lines); case-insensitive extraction produced 65 unique identifiers across text, image, video, and transcription.
- All 65/65 source identifiers are represented in either `ai_models` or `suly_media_model_price_versions`; no missing source IDs were found. This confirms identifier coverage only, not SULY integration readiness.
- `ai_models`: 251 rows, 9 enabled, no missing model identifiers, and no duplicate `(provider_id, model_identifier)` pairs.
- 91 model identifiers occur under more than one provider account. This is historical/account duplication across provider records, not duplicate pairs within a provider. Do not delete rows or reassign routes automatically.
- `ai_providers`: 7 provider-account records, 3 enabled. Active global role assignments currently route all five roles through the two Groq model IDs. This differs from the stated one-provider/one-key target and must be reconciled against the owner's intended single API gateway before provider disabling, secret migration, or route changes.
- The admin UI already provides provider listing, model search/filter, health tests, model metadata editing, route governance, and pricing screens; complete permission and adversarial workflow tests remain.

Known evidence:
- PR #99 — model catalog/pricing work.
- PR #101 — corrections to o3 and o3-pro pricing.
- PR #85 — strict route governance and unverified-model quarantine.
- PR #125 — account navigation/profile improvements (merged).
- New/unverified catalog entries remain disabled by default; preserve historical rows and usage records.

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

**Current status:** [>] Additive capability-evidence registry and admin editor are implemented on branch `feat/model-catalog-capability-evidence-20261116`; merge and CI verification are pending. The existing production routing and legacy `capabilities_json` behavior are intentionally unchanged until the evidence catalog is populated and regression-tested.

Implementation evidence (2026-11-16):
- Added `ai_model_capability_evidence`, keyed by the existing integer `ai_models.id` and capability key. This deliberately does not reuse `model_capabilities`, which is FK-linked to the separate UUID-based `models` catalog.
- Each capability has three independent provenance levels: vendor claim (`unknown/supported/unsupported`), provider test (`not_tested/passed/failed`), and SULY integration test (`not_tested/passed/failed`), with separate evidence URLs, timestamps, notes, and admin attribution.
- Added admin-guarded RPCs for listing and atomically saving evidence, plus audit-log writes. Direct table access is revoked from anon/authenticated; RLS is enabled.
- Added `ModelCapabilityEvidenceAdminCard` to the existing Models & Routing admin screen. It allows searching/selecting models and editing capability evidence without changing runtime routing or activation.
- Expanded capability taxonomy to distinguish model-native input/output/generation/tool features from optional connector compatibility (Gmail/Drive/GitHub). Connector availability is not treated as a model-native modality.
- Live database verification after source seeding: **1,040 evidence rows across 147 provider-account model rows and 45 distinct text-model identifiers**. Every seeded row remains `provider_test_status=not_tested` and `suly_test_status=not_tested`; zero provider or SULY passes are claimed. RLS is enabled; anon has no table or RPC access; authenticated has execute permission only on admin-guarded RPCs and no direct table SELECT. Additional constraints and RPC validation require HTTPS evidence URLs before any non-unknown claim or test result can be saved. A real authenticated admin UI save test is still pending.
- Added a parallel media capability evidence registry keyed by the existing provider/service/model identity in `suly_media_model_price_versions`; this keeps image/video/audio metadata separate from the text runtime registry and price history. The media evidence table now contains 22 provider-advertised service claims: 12 image-generation, 7 video-generation and 3 transcription models. All remain not tested at the provider and SULY levels. RLS is enabled, anon has no table/RPC access, authenticated has access only through admin-guarded RPCs, and non-unknown claims/test results require HTTPS evidence URLs. Added a searchable media capability editor to the admin overview beside the existing media price card.
- Official documentation spot-checks were recorded as vendor-only evidence for exact identifiers: Anthropic Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Haiku 5.5; OpenAI GPT-6 Astra, GPT-6 Luna and GPT-5.5; Google Gemini 3.8 Flash. The seed created 1,040 evidence rows across 147 provider-account model rows (45 distinct text-model identifiers): 835 documented/provider-advertised capability claims are supported, 203 are explicitly unsupported, and two Gemini 4 Argon rows remain unknown because the ID was not found in the checked public Google/Soal catalogs. The evidence currently covers text for 44 identifiers, vision and function calling for 38 each, and multimodal audio/video input for 8 Gemini identifiers. Provider-test and SULY-integration pass counts remain **zero**; these claims are not proof that the configured gateway exposes the features.
- Provider identity reconciliation: `ai_providers` ID 22 is the enabled Soal Help OpenAI-compatible gateway at `https://soal.help/api/v1`; IDs 19 and 23 use the same base URL but are disabled. The public Soal Help catalog lists many of the same exact model IDs as the supplied file, confirming that several noncanonical-looking strings are gateway-facing IDs. Preserve them; do not replace them with upstream IDs without a live provider mapping check. Groq and Google provider records are separate active routes and are not changed here.
- Corrected canonical-ID review: OpenAI's public API reference accepts `gpt-6-sol` as well as `gpt-6.1-sol`, so the supplied `gpt-6-sol` is not classified as invalid. `Gemini 4 Argon` was not present in the checked Google public catalog or the checked Soal Help public catalog; keep it unverified and disabled until the provider confirms it.
- Lifecycle warnings from official documentation (2026-11-16): OpenAI `gpt-image-1` shut down 2026-10-23; `gpt-image-1.5` is scheduled to shut down 2026-12-01; `gpt-4.1-nano` shut down 2026-10-23; `gpt-5` and `gpt-5-mini` are scheduled to shut down 2026-12-11; `whisper-1`, `gpt-4o-transcribe`, and `gpt-4o-mini-transcribe` are deprecated for shutdown 2027-02-26. Google's `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview` shut down 2026-06-25; `gemini-2.5-flash-image` shut down 2026-10-02. The matching text models found in `ai_models` are disabled; media rows remain price-history only with SULY integration unverified, and runtime media models are inactive. Do not assume the gateway alias still works just because the upstream ID is retired—confirm Soal's mapping before enabling.
- Media aliases such as `kling-4`, `kling-4-flash`, `gemini-omni-flash`, and Nano Banana identifiers differ from upstream docs' current IDs; retain the supplied gateway IDs and require provider-specific mapping evidence before changing them.
- Official references checked: Anthropic Models Overview and Model IDs/versioning; OpenAI Models/API Reference, image generation, speech-to-text and deprecations; Google Gemini Models, Interactions API and deprecations; Kling API model reference and API updates; Soal Help public catalog.
- Detailed Google capability claims now include Gemini 3.7/3.6/3.5 Flash, 3.1 Pro Preview, 3 Flash Preview, 2.5 Pro and 2.5 Flash. The evidence distinguishes text/image/video/audio/PDF input from image/audio generation output; e.g. Gemini 3.8 Flash supports multimodal input, function calling, code execution, computer use and file search, but explicitly does not support image or audio generation. Gemini 2.5 Pro is deprecated and scheduled to route to Gemini 3.8 Flash effective 2026-12-01; its existing SULY model rows remain disabled.
- Runtime integration follow-up (PR #136): the central `ai-router` loads evidence for its enabled model candidates and blocks only explicit unsupported claims or failed provider/SULY probes for the required modality/tool. Missing/unknown evidence preserves legacy `capabilities_json` routing; a passing provider probe can validate a gateway alias, while a passing SULY integration test is authoritative. Connector capabilities remain governed by the connector registry, not model modality evidence.
- Provider text-probe follow-up (PR #137): the existing manual/scheduled `model-health-check` now synchronizes real text/chat probe outcomes into the capability evidence registry. Successful probes record provider pass; a single transient failure on a healthy model does not overwrite the last result; a restricted failure records provider failure and invalidates a stale SULY pass. Provider probes never invent vendor claims or mark SULY integration as passed. The admin evidence editor adds a direct **Test text now** action for the selected model.
- Media activation safety follow-up (PR #136): activating an image-generation runtime model now requires both provider-test and SULY-integration evidence to be `passed`. All current media evidence rows remain `not_tested`, so no media model becomes active by this change. The existing media admin atomic-save regression was run against the live Supabase project inside a rollback-only transaction and passed, including the new evidence-required activation rejection and the existing currency/FX guard.
- Official references checked: Anthropic Models Overview and Model IDs/versioning; OpenAI Models and GPT-5.5 model page; Google Gemini 3.8 Flash model page and model capabilities table.



Verified schema review (2026-11-16):
- Existing tables are reused: `ai_providers`, `ai_models`, `model_capabilities`, `ai_model_price_versions`, `ai_route_model_assignments`, `suly_media_generation_models`, `suly_media_generation_prices`, and `suly_media_model_price_versions`.
- Text models already carry `capabilities_json`, `task_roles`, `allowed_modes`, and route/health metadata. The text price-version table stores provider costs, selling prices, markup, currency, source, and effective/version history.
- Media price versions explicitly separate `provider_tested` from `suly_integration_verified`; all 22 current media price rows are provider-tested and none is SULY-integration-verified.
- The text catalog does not yet expose the same explicit three-level capability evidence (official/vendor claim, provider-tested, SULY integration-verified) as first-class fields. Do not infer those states from a marketing description, capability checkbox, price row, or model name.
- All tables listed above have RLS enabled; the full anon/authenticated/service_role grant-and-policy matrix still needs targeted regression coverage before this phase can close.
- No parallel routing table or duplicate provider-secret store was introduced.

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

**Current status:** [~] Text route governance and 40% markup are verified at the data level. Media generation remains safely disabled because the credit conversion/runtime price layer is incomplete.

Verified database audit (2026-11-16):
- Text prices: 46 version rows, 45 current versions across 45 models. Every current row uses `markup_rate = 0.40`.
- Media prices: 22 current versions (12 image, 7 video, 3 transcription/audio); every current row uses the 40% markup. All 22 are provider-tested; 0 are SULY-integration-verified.
- Media runtime registry: 4 image model rows, 0 active. No video/audio runtime model rows were found. `suly_media_generation_prices` has 0 rows. The image-model admin save path is now atomic and audited through a server-side RPC, but this does not populate runtime prices or enable generation.
- `suly_credit_pricing.credit_value_egp` and `usd_to_egp` are not configured. Do not calculate credits, activate media models, or enable chargeable Studio operations until the owner-approved credit value and FX policy are configured.
- Nine text models are enabled: seven in the free race with no current paid price row (consistent with the current zero-cost route), and two paid fallback models with current price versions. Do not treat missing free-route prices as permission to charge.
- All five active global role routes currently use Groq `openai/gpt-oss-120b` as primary and `qwen/qwen3.8-27b` as backup. Historical model attempts show prior successes, but full authenticated chat/Agent billing E2E remains open.
- No complete authenticated test of provider-disable during a real request, fallback settlement, or Studio job billing is claimed.

Known evidence:
- PR #85 — model routing governance.
- PR #99/#101 — catalog/pricing changes.
- Do not interpret routing timeout budgets as measured full user-task latency.

## Phase 13 — Build, organize, and secure the complete SULY Admin Control Center

**Goal:** Deliver the complete administrative control plane, including existing workflows and a protected dynamic page/component builder, without exposing privileged actions or replacing established business logic.

Required administrative modules (reuse existing sources and guarded services wherever authoritative sources already exist):
1. Overview & operational activity: verified user, task, model, wallet, service-health, and operational metrics. Unknown metrics remain explicitly unavailable rather than fabricated.
2. Providers & Models: provider accounts, masked credential status, model catalog, lifecycle, health, and metadata.
3. Capabilities & Verification: vendor claims, provider-test evidence, and SULY-integration evidence as distinct levels.
4. Central Agent & Routing: central-agent roles, route assignments, profiles, fallbacks, task queue, and routing history; no second independent agent or routing engine.
5. Pricing & Plans: immutable/effective-dated model and media price versions, plans, features, and approved margin rules.
6. Wallet, Credits & Coins only if a separate authoritative Coins ledger is confirmed: holds, transactions, adjustments, grants, settlement, and reconciliation. Never edit balances outside the authoritative ledger flow.
7. Users & Subscriptions: account status, server-derived entitlements, subscriptions, and permission-safe support actions.
8. Ads & Rewards: AdMob identifiers, reward claims, and verified ad-network settlement only when an authoritative settlement source exists.
9. Finance & Profit/Loss: reconciled provider costs, revenue, expenses, pending items, and unknown/unconverted amounts kept separate.
10. Activity & Audit: unified read experience over existing audit sources without deleting or silently merging historical records.
11. HIMS & Content: activation codes, student entitlements, resources, and educational administration while HIMS remains inside ordinary central chat.
12. System Settings & Security: admin roles, access controls, integration status, maintenance settings, security configuration, and audit protection.

Dynamic Admin Page & Component Builder (required within this phase; not merely an AdminShell/navigation redesign):
- Create, edit, rename, reorder, publish/unpublish, show, and hide administrative pages and sections, subject to permissions.
- Add, configure, reorder, and remove permitted presentation components on configurable pages.
- Support approved component types such as data tables, metric cards, charts, forms, lists, filters, and status panels.
- Bind components only to explicitly registered data sources and approved read/write operations. Do not permit arbitrary SQL, arbitrary RPC execution, or client-defined privileged actions.
- Configure page visibility and separate read/create/update/delete/sensitive-action permissions. Enforce every permission on the server/RPC/Edge Function and database layer, not only by hiding UI controls.
- Persist versioned page layouts, validate configuration, and provide safe preview/publish/restore behavior.
- Audit who changed what, when, and the previous/new configuration.
- Protect mandatory security, audit, identity, and core administration routes from being removed or hidden in a way that locks out the owner or bypasses required controls.
- Migrate existing admin pages gradually only after equivalent functionality and permissions exist. Keep current routes and workflows working during migration; do not delete the legacy implementation first.

Implementation and security requirements:
- Add safe filters, pagination, loading/error/empty states, confirmations, and audit history.
- Verify admin status on the server for every privileged operation.
- High-impact actions (provider disable, model activation, pricing changes, role/route edits, user privilege changes, wallet adjustments, HIMS entitlement changes, and builder publishing) require validated server-side operations and audit events.
- Keep provider secret values masked; show only safe metadata such as configured/not configured and last rotation if available.
- Reuse existing tables, RPCs, Edge Functions, and ledgers when authoritative. Do not create parallel registries or financial sources without a documented need.

Build exit criteria:
- All 12 administrative modules and the dynamic builder are implemented or have a specifically documented owner-approved blocker.
- Existing admin routes and workflows remain available until safely migrated.
- Privileged operations have server-side authorization, validation, least privilege, and audit coverage.
- The builder cannot bypass business rules, expose raw secrets, or execute arbitrary privileged operations.
- Final admin/user/adversarial test evidence is recorded in the independent comprehensive test track, not inferred from implementation or CI alone.

**Current status:** [>] Admin navigation and governance foundations exist; the image-generation model editor's high-impact save path has now been moved behind an atomic, audited server-side RPC. Remaining admin areas still need the same end-to-end and adversarial review.

New verified implementation (2026-11-16):
- Added migration `20261116130000_atomic_media_model_admin_save` and recorded it in `supabase_migrations.schema_migrations`.
- Added `suly_admin_save_image_generation_model`: server-side admin guard, active-provider check, HTTPS endpoint validation, strict tier/quality validation, price/credit/FX/margin checks, transactional model + four quality-price upsert, serialized default selection, and one audit event.
- Revoked direct authenticated INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges on `suly_media_generation_models` and `suly_media_generation_prices`; authenticated SELECT remains under admin RLS; service_role retains server writes.
- Updated `MediaGenerationModelsAdminScreen` to save through `adminService.saveImageGenerationModel` instead of a sequence of direct client writes.
- Rollback-only SQL regression passed: non-admin call denied; direct client writes denied; admin RPC creates model + all four price rows atomically; audit event present; activation with missing credit/FX rejected. Test rollback left zero fixture rows.
- Live privilege check: authenticated INSERT/UPDATE on both runtime tables is false; guarded RPC execute is true.
- PR #127 merged into `release/v1` as `ae2bebf26c4825ee8a5766e477e85f3929934787` after Expo TypeScript/auth/Web/Android/iOS exports, Deno typecheck/tests, Edge bundle verification, and media billing guardrails all passed.
- Studio generation remains disabled; this admin hardening does not activate image/video/audio services or invent credit conversion.

Remaining:
- Apply the same server-side atomic/audit review to provider, route, pricing, user privilege, and other admin workflows where still required.
- Verify admin access denial with real non-admin HTTP session and verify the screen visually on web/device.
- Complete the full admin navigation/permissions regression matrix.

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

**Current status:** [~] Persisted system/light/dark selection, hydration handling, and audited dynamic-palette migrations are merged (PRs #129, #130, #131). The shared UI and Balance follow the saved theme; remaining literal-color review, visual route coverage, and real-device checks remain open.

**Additional Phase 14 work merged (2026-11-16):** PR #131 merged as `ac861a1b6844cf3b7ca081b8fe34d65408c1ebc0`. It migrates the Balance screen to the shared `ThemePalette` and updates Toast, IconButton, BottomSheet, AttachSheet, SharedConversationPage, and ShareConversationSheet to consume `useSulyTheme()` rather than independently reading the OS color scheme. PR #131 passed Expo TypeScript, auth regression tests, static Web export, Android JS bundle, iOS JS bundle, and Deno Agent/Edge checks. A further focused pass for Support, Image Studio loading state, and Admin alert surfaces is open in PR #132; visual/browser/device coverage and the remaining hard-coded color audit are still open.

New implementation (2026-11-16):
- `SulyThemeProvider` now waits for the persisted appearance preference to load before mounting app screens, preventing a first-render flash in the wrong theme. While loading it shows a palette-backed neutral surface.
- Migrated all 11 audited legacy static `colors` imports to the active theme hook or system-aware palette (including auth screens/layouts, chat, balance, admin users, and Brain task UI). The remaining source scan finds 26 files with literal color values; some are intentional brand/status/code colors, while others need per-screen classification and replacement. No blind global replacement was applied.
- PR #129 build checks passed: Expo TypeScript, mobile auth regression, static Web export, Android JS bundle, iOS JS bundle, and Deno Agent/Edge Function checks. Route-by-route visual checks in light/dark/system remain pending.
- PR #130 dynamic-palette migration passed Expo TypeScript, mobile auth regression, static Web export, Android JS bundle, iOS JS bundle, and Deno Agent/Edge Function checks, and merged as `ec4d586162dfb464dcae18b5a4a19bd6ebf78487`.
- PR #131 extended dynamic palette coverage to shared surfaces and the Balance screen, passed all Expo/Deno CI checks including Web/Android/iOS exports, and merged as `ac861a1b6844cf3b7ca081b8fe34d65408c1ebc0`. PR #132 is the next small presentation-only pass for Support, Image Studio loading, and Admin alert surfaces; it is awaiting CI.

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

**Current status:** [~] Arabic/English preference persistence, root direction support, and saved-language hydration are merged (PR #129). Centralized translation coverage, mixed-direction content, and full RTL/LTR visual review remain open.

New implementation (2026-11-16):
- `LocaleProvider` now waits for the saved `ar`/`en` preference before mounting app screens, preventing a brief Arabic/RTL render when the saved preference is English/LTR (and vice versa).
- The app root applies the locale direction to the navigation container.
- User-facing strings remain distributed across feature screens; a full key-based translation catalog, mixed-script/model-ID review, and RTL/LTR visual/interaction tests are not complete.
- PR #129 build checks passed: Expo TypeScript, mobile auth regression, static Web export, Android JS bundle, iOS JS bundle, and Deno Agent/Edge Function checks. Full key-based translation catalog, mixed-script and RTL/LTR visual tests remain incomplete.
- Do not auto-translate or claim legal/policy text is approved.

## Phase 16 — Implement security, data integrity, and operational safeguards

**Goal:** Complete the security architecture and operational protections required by the product. The independent final comprehensive test track later validates these controls across the entire finished application.

Security and integrity controls to implement:
- Authentication, session handling, account isolation, authorization, admin escalation, RLS, storage, signed URLs, RPC grants, SECURITY DEFINER functions, search_path, and secret exposure.
- Activation-code brute force/replay, HIMS cross-student resource access, entitlement forgery, and resource link leakage.
- Provider credential exposure, model-route tampering, provider freeze bypass, prompt/tool injection, SSRF, unsafe URL/file handling, and untrusted tool outputs.
- Wallet/credits: negative balances, duplicate settlement, replay, race conditions, idempotency, cancellation, partial billing, refund/release, and concurrent requests.
- Rate limits, abuse controls, quotas, bounded task concurrency, worker leases, retries, and timeouts.
- Audit log integrity and sensitive data minimization.
- Dependency and build security where supported.

Functional behavior that must be implemented and preserved:
- Sign up/login/session restore/logout.
- Chat, central agent, tools, long tasks, cancellation, task recovery, and history.
- HIMS activation and authorized lecture delivery within normal chat.
- Studio confirmation, generation, status, billing, and Library output.
- Library upload/download/search/folder/favorite/delete.
- Account/subscription/wallet/transactions.
- Admin provider/model/pricing/routing/users/security workflows.
- Offline/network failure and retry behavior where supported.

Build exit criteria:
- Required security controls, authorization boundaries, data-integrity protections, rate limits, and recovery behavior are implemented.
- No known critical/high issue is knowingly introduced or left without a documented containment decision.
- Database and wallet-ledger invariants have defined authoritative sources and reconciliation procedures.
- Any accepted residual risk is documented with owner approval. Final pass/fail evidence belongs to the independent comprehensive test track.

**Current status:** [>] The original set of 57 authenticated-executable SECURITY DEFINER function bodies has now been reviewed individually. After the new least-privilege migration, 56 of the original functions remain executable by authenticated clients; the separate anonymous share-token endpoint remains intentional. The new `suly_admin_save_image_generation_model` RPC adds one more authenticated-executable function, bringing the current total to 57. Current classification: 43 functions contain a direct admin guard, 12 are caller/session-scoped, 1 legacy provider toggle delegates to the guarded lifecycle RPC, and 1 public-share function is scoped by its exact share token. All 57 authenticated-executable functions have fixed search_path settings. Targeted fixes and rollback-only SQL regressions passed; Deno Agent/Edge Function tests and typecheck, Edge bundle verification, and media billing guardrails also passed in PR #117 CI. Real authenticated HTTP/UI flows, true multi-session activation concurrency, and the independent final comprehensive test track remain open.

Known constraints:
- Supabase Free plan may not provide every optional security feature. Record limitations and compensating controls; do not claim unavailable controls are enabled.
- A previous advisor review surfaced warnings that require triage by actual function grants/body and RLS, not by warning label alone.
- Latest Security Advisor review (2026-11-16): 10 RLS-enabled/no-policy tables were flagged at INFO level; direct privilege inspection confirmed none grants table privileges to `anon`, `authenticated`, or `PUBLIC`, so they are not client-readable/writable through those roles. Two extension-in-public warnings (`vector`, `pg_net`) remain for separate migration planning.
- The intentional anonymous `suly_get_public_conversation(share_token)` endpoint remains scoped to the exact token and revocation regression. The new image-model admin RPC is executable by authenticated role only, explicitly checks `suly_is_admin()`, denies anon/PUBLIC execution, and passed a rollback-only non-admin denial + admin success/audit + no-credit-FX activation rejection test.

- Live Supabase advisor + read-only SQL recheck (2026-11-16): the 10 INFO-level RLS/no-policy tables still have RLS enabled and grant no SELECT/INSERT/UPDATE/DELETE to either `anon` or `authenticated`; the INFO findings are therefore not evidence of client access. The 9 multiple-permissive-policy warnings were inspected: overlaps are admin-read plus owner/active-read, or admin `ALL` plus a separate public/owner read policy. No policy was changed because combining them without targeted regression could alter administrator or public-plan visibility semantics.
- Performance advisor currently reports 68 unindexed foreign keys and 53 unused indexes (INFO). These are not auto-remediated: adding/removing indexes requires query-plan and workload evidence, and unused-index observations can be misleading on a young/low-traffic project.
- Remaining advisor owner action: enable leaked-password protection in Supabase Auth settings if available on the current plan. The `vector`/`pg_net` extension schema warnings need a dependency-reviewed migration plan; do not move extensions blindly. The 57 authenticated-executable SECURITY DEFINER warning rows still require preserving the documented per-function guard classification and regression evidence; the anonymous share-token endpoint is intentionally token-scoped.
- Fresh SQL verification (2026-11-16): all 57 SECURITY DEFINER functions executable by `authenticated` have a function-level `search_path` setting. Exactly one of those is also executable by `anon`: `suly_get_public_conversation(uuid)`, whose current SQL body selects only the conversation matching the supplied `share_token`, returns user/assistant messages only, and is capped at 300 messages. This matches the intentionally public share-link design; the revocation regression remains the required companion test.

## Phase 17 — Complete Expo Web, Android, and iOS compatibility and release preparation

**Goal:** Finish implementation, platform-specific configuration, build pipelines, and release/rollback preparation for all intended platforms. Final platform acceptance testing is recorded in the independent comprehensive test track.

Build and compatibility scope:
- Expo Web static export/build and deployment pipeline configuration.
- Android native project/build configuration, permissions, navigation, keyboard/safe-area handling, deep-link and file-handling integration, and notification integration where supported.
- iOS native project/build configuration, permissions, navigation, keyboard/safe-area handling, deep-link and file-handling integration, and notification integration where supported.
- Confirm platform-specific dependencies and permissions.
- Test production environment configuration without committing secrets.
- Verify CORS, auth redirects, universal/app links as applicable, storage access, and edge-function connectivity.
- Verify web deployment URL and smoke-test real user flows after deploy.
- Verify OTA/build workflows and secret configuration; never report an OTA update as published if the workflow failed.
- Prepare release notes and rollback/recovery instructions.

Build exit criteria:
- Web, Android, and iOS implementation/configuration and supported build/export workflows are prepared.
- Platform-specific dependencies, permissions, environment configuration, auth redirects, links, storage integration, and notification wiring are implemented where supported.
- Production secrets are stored only in appropriate secret managers.
- Release notes, artifact identification, and rollback/recovery instructions are prepared. Final device installation and user-journey pass/fail results belong to the independent comprehensive test track.

**Current status:** [~] Latest release deployment and all three platform JS exports have fresh passing evidence; OTA publish and physical-device end-to-end validation remain open.

Verified since the prior review:
- PR #125 merged as `965e6fc8809adb13af72a536755bf70609a7dd16`.
- Expo CI passed TypeScript, mobile auth regression, static Web export, Android JS bundle, and iOS JS bundle.
- GitHub Pages deploy for release commit `ac861a1b6844cf3b7ca081b8fe34d65408c1ebc0` succeeded (workflow run `43866014691`); the web deployment URL remains `https://eslammohamedk123450-netizen.github.io/smsm-ai/`.
- The PR #131 CI run passed all three JS platform exports (Web/Android/iOS), TypeScript, auth regression, and Deno checks (run `43865425383`). Post-merge release verification for `ac861a1b6844cf3b7ca081b8fe34d65408c1ebc0` also passed every TypeScript/auth/Web/Android/iOS/Deno step (run `43866014685`).
- Expo OTA publish failed because `EXPO_TOKEN` is unavailable (workflow run `43866014716`).
- JS bundle export is not the same as building/installing native APK/IPA or testing on real devices.
- New theme/locale hydration fixes are pending CI; no visual browser/device test is claimed.

---

## 3A. Approved plan structure — two independent tracks (owner-approved 2026-11-16)

The product owner approved separating the completion plan into exactly two major tracks. This is a roadmap/work-sequencing structure, **not two Git branches**.

### Track A — Complete build, development, organization, and integration (the 17 phases above)

- Phases 1–17 are the complete build track. They include discovery, implementation, UI organization, database and service integration, security architecture, admin control center construction, platform compatibility, and release preparation.
- Phase 13 explicitly includes the full 12-module Admin Control Center and the dynamic page/component builder.
- Phase 16 implements security and data-integrity controls; it is not the final application-wide test campaign.
- Phase 17 prepares platform implementations and release workflows; final platform acceptance testing belongs to Track B.
- Preserve existing behavior, data, HIMS entitlement semantics, the single central Agent, wallet/ledger invariants, provider/model identifiers, routing governance, and historical records.
- Focused developer checks and CI may run during implementation to prevent regressions. These are implementation quality gates, not completion of Track B.
- Track A is complete only when all 17 phases have their implementation scope delivered or a precise owner-approved blocker documented, major components are integrated, and a build handover inventory exists.

### Track B — Independent comprehensive verification after Track A

Track B begins only after the build track is declared implementation-complete. Its purpose is to verify that every required screen, feature, permission, data path, integration, and platform is present and works correctly as a whole. It is not a second implementation plan and must not silently introduce product scope.

During Track B:
1. Execute the test suites below systematically, one area at a time.
2. Record exact environment, commit SHA, test identity/role, setup, steps, expected result, actual result, logs/artifacts, and pass/fail status.
3. When a defect is found, create a specific repair item against the existing `develop` line, fix it without removing established functionality, and rerun the failed test plus affected regression suites.
4. Keep original failure and repair/retest evidence; do not overwrite failures with a later green status.
5. Distinguish automated tests, authenticated manual tests, provider integration tests, browser tests, and physical-device tests. Never claim one type from evidence of another.
6. Do not use real customer credentials or ask the owner to post passwords/API secrets in chat. Use controlled test accounts and approved secret storage.
7. Do not activate chargeable services, change live pricing/FX/credit conversion, grant real user entitlements, or make production financial adjustments merely to make a test pass. Use isolated fixtures/sandbox providers or explicitly approved test procedures.
8. Do not deploy to production until the complete test report, unresolved-risk list, and owner release approval are ready.

### Track B — Comprehensive test suites

| Test suite | Required coverage |
|---|---|
| 1. Product inventory and completeness | Reconcile every phase deliverable, route, screen, control, service, migration, RPC, Edge Function, and required admin module against the approved inventory; identify missing, duplicate, dead, or unreachable functionality. |
| 2. Authentication and account journeys | Sign-up, login, logout, session restoration, expired sessions, account/profile changes, password/reset flows where supported, and role/entitlement refresh. |
| 3. HIMS and educational entitlement | Admin code creation, student activation in normal chat, valid/invalid/expired/reused codes, attempt throttling, entitlement checks, authorized resource retrieval, cross-student isolation, and natural handling of unrelated chat. |
| 4. Central chat and Agent | Normal chat, fast responses, complex planning, DAG dependencies, bounded workers, tool calls, model selection, history, streaming/status, timeouts, retries, cancellation, recovery, and failure reporting. |
| 5. Wallet, Credits, and accounting | Reservation, settlement, partial billing, cancellation, release/refund, duplicate requests, idempotency, concurrent requests, negative-balance prevention, ledger reconciliation, and no charge for work not performed. |
| 6. Providers, models, and capability evidence | Credential secrecy, provider health, model identifiers, enabled/disabled governance, vendor/provider/SULY evidence distinctions, probe results, fallback behavior, freeze enforcement, and unsupported-capability rejection. |
| 7. Routing, pricing, and plans | Primary/backup selection, task-role allowlists, Lite/Pro/Max/Auto behavior, price-version selection, units, margin calculations, missing FX/credit conversion blocks, plan entitlements, and server-authoritative decisions. |
| 8. Studio media workflows | Image, video, audio, and transcription flows; input validation; user confirmation; provider integration; progress/status; cancellation; usage settlement; failures; and Library persistence. Test only modalities actually implemented and configured. |
| 9. Library and file security | Upload, list, preview, signed URL, download, rename, folder, favorite, search, delete/confirmation, retention behavior, path traversal protection, private storage, and cross-user isolation. |
| 10. Account, subscriptions, and billing | Profile and preferences, server-derived subscription tier, plan visibility, payment/renewal lifecycle where configured, billing history, storage usage, notification settings, and reconciliation against authoritative ledgers. |
| 11. Admin Control Center | All 12 modules, existing admin routes, filters, pagination, loading/error states, high-impact actions, direct API/RPC denial for non-admins, atomic writes, and audit events. |
| 12. Dynamic Admin Builder | Page/section create/edit/reorder/show/hide, component add/configure/remove, registered data-source bindings, layout save/version/restore, publish permissions, protected mandatory routes, audit history, and proof that arbitrary SQL/RPC or privilege escalation is impossible. |
| 13. Ads, rewards, and finance | Reward claim validation, duplicate/replay prevention, AdMob configuration, network settlement evidence if available, provider-cost ledger, revenue/expense classification, currency consistency, and explicit treatment of unknown/unsettled values. |
| 14. Security and adversarial testing | RLS/ACL, RPC/Edge Function authorization, SECURITY DEFINER/search_path, privilege escalation, tenant isolation, secrets, activation replay/brute force, prompt/tool injection, SSRF, unsafe files/URLs, rate limits, audit integrity, and dependency/build risks. |
| 15. UI, accessibility, theme, and localization | All screens in light/dark/system themes, Arabic RTL and English LTR, text overflow, keyboard/safe areas, responsive layouts, accessibility labels/focus/contrast, empty/loading/error states, and navigation/deep links. |
| 16. Integration, resilience, and load behavior | End-to-end cross-feature journeys, network loss/recovery, provider outage, timeouts, retries, concurrent users/tasks, worker leases, duplicate events, queue backpressure, and observable error recovery. |
| 17. Web, Android, iOS, and release acceptance | Web deployment smoke tests; Android/iOS build and installation where available; real login/chat/files/Studio/navigation/notifications/deep links; device-specific behavior; secret/config validation; release artifact checks; rollback rehearsal; and final release readiness. |

### Track B — Result and defect classification

Use these statuses for every test case:
- **PASS — VERIFIED:** Exact steps completed and expected behavior observed, with evidence attached.
- **FAIL — DEFECT:** Actual result differs from expected result; create a repair item and preserve failure evidence.
- **BLOCKED — EXTERNAL INPUT:** Requires an owner-supplied account, approved content, provider access, legal decision, device, or business setting.
- **NOT RUN:** Not yet executed. Never imply success.
- **NOT APPLICABLE:** Explain the technical reason and obtain owner acceptance where the requirement was part of the approved scope.

A test suite is not passed if critical cases are blocked or not run. The final report must include:
- Tested commit SHA and deployment/environment.
- Total cases: passed, failed, blocked, not run, and not applicable.
- Defects found, linked fixes, and retest/regression evidence.
- Unresolved security, data, billing, and platform risks.
- Tests requiring real provider accounts, real users, or physical devices.
- A clear release recommendation: ready, not ready, or ready only with explicitly owner-accepted limitations.

### Git and deployment governance for both tracks

- Keep implementation and repair commits on the existing `develop` branch. Do not create a separate Git branch for the testing track.
- Keep `release/v1` protected and unchanged during development and testing.
- Do not force-push, reset, or delete branches with unreconciled work.
- Prepare one coherent promotion from `develop` to `release/v1` only after Track B has passed and the owner approves release.
- A successful CI/build is evidence for that specific check only; it is not proof of complete functional, security, billing, or device acceptance.

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
- Latest PR #131 Expo TypeScript, auth regression, Web/Android/iOS exports, and Deno checks: **passed** (run `43865425383`). The separate post-merge release verification was still in progress at the latest check.
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

#### Phase 5 implementation disposition on `develop`

1. Five primary destinations and responsive mobile/web navigation are present.
2. Home, Conversations, Studio, Media/Library, Settings, and Projects route modules exist.
3. Conversations exposes search and Projects; Settings exposes balance/credit history, plan/upgrade, Library, support, and connected apps.
4. HIMS continues to redirect to the central chat and is not a separate assistant or navigation product.
5. Implementation is considered complete; route-click, current-head CI, visual browser, keyboard/safe-area, and Android/iOS device checks are deferred to Track B. Any defect found there returns as a scoped Track A fix.

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
- PR #119 merged into `release/v1` as commit `c2ffc15f79ce5922d2e8b8a424b81f0a20b0d899`. GitHub Actions run `43853785434` passed mobile TypeScript, mobile auth regression, Expo Web static export, Android JS export, iOS JS export, and Deno Agent/scheduler regression + typecheck. Follow-up release workflows were queued; no visual/device test is claimed.
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

**Historical Phase 5 stopping point:** Home implementation was merged and the Web static site deployment succeeded in the earlier release workflow. The current `develop` branch also contains the five-section navigation and Home implementation. Current-head route/browser/device verification is deferred to Track B; Phase 6 may proceed on `develop`.


### Phase 6 continuation — actual routed model display and regression — 2026-11-16

- PR #121 merged into `release/v1` as commit `6ddbe66254985d39d604b75ca1fd910fc5fb1154`.
- Verified the existing direct-chat router SSE payload includes the winning model's `model`, `model_id`, provider, and route metadata on streamed chunks. The mobile SSE parser now extracts the actual model identifier while preserving the first response chunk and existing event shapes.
- The chat screen displays the server-confirmed identifier and clears it when a new request starts. This is not inferred from the selected Auto/Lite/Pro/Max profile.
- GitHub Actions run `43854700204` passed both jobs: Expo TypeScript, mobile authentication regression, Expo Web static export, Android/iOS JavaScript exports, and Deno Agent/scheduler regression/typecheck.
- Added a regression in `apps/mobile/src/features/chat/chat-service.test.ts` for routed model metadata through retry. The first CI run caught a real omission: `retryAssistant` passed the callback into `regenerateAssistant`, but `regenerateAssistant` did not forward it into the stream manager. Fixed that forwarding and added a guard so the generic `agent` orchestration label is not presented as a concrete model. Follow-up PR #122 is awaiting final CI.
- **Remaining Phase 6 verification:** test the same metadata behavior on normal send (not only retry), review Agent/tool-stream model attribution where multiple internal roles may run, authenticated HTTP end-to-end chat/task/cancel/retry/partial-billing tests, and visual browser/device checks. Do not claim those tests are complete.


### Phase 6 continuation — routed model metadata regression merged — 2026-11-16

- PR #122 merged into `release/v1` as commit `66dc7ef6d295dd4619911777626a3942383a2377`.
- The additional regression caught and fixed a real retry-path omission: `retryAssistant` passed the model metadata callback into `regenerateAssistant`, but that method had not forwarded it to the stream manager.
- Both normal-send and retry-stream callback paths are now covered. The generic orchestration label `agent` is deliberately not shown as a concrete model identifier.
- GitHub Actions run `43856254766` passed: Expo TypeScript, mobile auth/chat regressions, Expo Web export, Android JS export, iOS JS export, and Deno Agent/scheduler regression and typecheck.
- This closes the current implementation/test slice for model metadata, but Phase 6 remains IN PROGRESS until authenticated HTTP E2E, Agent task lifecycle, cancellation/retry/partial-billing checks, and visual/browser/device verification are completed.

### Phase 7 — current production media audit — 2026-11-16

A second read-only audit confirms the exact boundary between the price catalogue and executable Studio services:

- `suly_media_model_price_versions`: 22 current price rows — 12 image, 7 video, 3 audio. All 22 are marked provider-tested based on the owner's supplied confirmation; all 22 have `suly_integration_verified=false`. Prices are EGP per image / video-second / audio-minute, with a generated selling price of provider cost × 1.40.
- `suly_media_generation_models`: only 4 image model rows exist; all 4 are inactive. All use the OpenAI Images-compatible protocol and the same provider endpoint. No video or audio generation model rows are registered here.
- `suly_media_generation_prices`: 0 runtime price rows. The image-generator rejects requests when the runtime price for a selected quality is missing. Its database constraint also requires positive provider cost, FX rate, credit value, valid margin, and enough credits to cover the configured gross-margin calculation before a price can be enabled.
- `suly_media_generation_jobs`: 0 current jobs at audit time.
- Studio presents image, video, audio, and transcription entry points, but only the image-generation backend path exists in this registry; video/audio/transcription are not end-to-end verified. No model was activated and no price was inserted as part of this audit.

**Phase 7 decision:** keep all media generation unavailable until the provider EGP catalogue is reconciled with runtime USD cost, FX, credit value, quality-specific price, and settlement. Do not invent an exchange rate or credit value, and do not treat provider-tested as SULY-integration-verified.

### Phase 8 — current Library audit — 2026-11-16

- Existing `MediaScreen` already provides owner-scoped asset listing, search by filename/prompt, image/video/file/in-progress filters, open/download, copy link, delete, and image reuse in chat. It also lists active generation jobs.
- The UI's manual upload controls are currently administrator-only; ordinary users' assets primarily arrive through existing chat/feature upload flows.
- No media-folder, asset-folder membership, or media-favorite tables exist in the current production schema.
- `global_media_assets` remains protected through the media-gateway and owner-scoped access path; no direct client write policy was added.
- **Remaining Phase 8:** add persistent user-owned folders and favorites with cross-owner isolation, integrate folder/favorite filtering into Library, and verify file lifecycle, downloads, deletes, and Studio outputs. Do not loosen `global_media_assets` policies to implement these UI features.



### Phase 8 implementation — persistent Library organization — 2026-11-16

- Applied Supabase migration `20261116112239_suly_media_library_organization` to the connected project.
- Added `suly_media_folders`, `suly_media_asset_folders`, and `suly_media_favorites`.
- All three tables have RLS enabled and authenticated owner-only policies. Anonymous access is revoked. Authenticated users have only the DML needed for their own records; service_role retains server access.
- Added composite foreign keys from (asset_id,user_id) to `global_media_assets` and (folder_id,user_id) to `suly_media_folders`. These enforce that a folder and its asset always belong to the same owner, even if a client forges a user_id.
- Folder names are trimmed, limited to 80 characters, and unique case-insensitively per owner. Each asset may belong to at most one folder. Deleting a folder cascades only its membership rows; it does not delete assets. Favorites are independent owner-scoped markers.
- Executed rollback-only regression `supabase/tests/suly_media_library_organization_regression.sql`: owner can create/read own folder, membership, and favorite; second user sees none of them; cross-owner favorite association is rejected by the composite FK. Transaction rolled back and a separate post-test query confirmed zero fixtures remain.
- Client service and Library UI implementation (folder create/rename/delete, folder filtering, move/remove asset, favorites filtering/toggle) is in the current Phase 8 branch and awaits CI/review.
- Existing `global_media_assets` direct client write restrictions and media-gateway flows were not loosened.



## SULY Control Center — approved admin-console implementation track (2026-11-16)

**Owner approval:** The product owner explicitly approved implementation of the SULY Control Center proposal. This work is additive to the existing 17-phase roadmap and must not replace, disable, or bypass existing admin workflows.

### Baseline inspected on `release/v1` at `a80574d992630934c3a83ecc2db41ade31a4be62`

**Existing admin UI and services (confirmed by source review):**
- `apps/mobile/src/features/admin/AdminDashboardScreen.tsx` is the current admin landing screen. It already loads model health, user count, failed model attempts, credit settlements, recent admin audit events, and maintenance mode; it links to model, user, credit, image-generation, and audit routes.
- Existing dashboard cards: `AgentTaskQueueCard`, `SulyFinanceOverviewCard`, `NegativeBalanceSettingsCard`, `SulyModelProfilesAdminCard`, `ModelPricingAdminCard`, `MediaModelPricingAdminCard`, and `MediaModelCapabilityEvidenceAdminCard`.
- `apps/mobile/src/features/admin/admin-service.ts` already contains guarded admin operations for providers, model overview/health, model and media price versions, provider lifecycle, model testing, and HIMS activation/resource management. Reuse these APIs and their guarded RPC/Edge Function paths; do not create parallel write paths.
- `ModelCapabilityEvidenceAdminCard.tsx` exposes three distinct evidence layers: vendor claim, provider test, and SULY integration test. PR #137 adds a real text/chat probe action and synchronizes provider probe outcomes without inventing vendor or SULY evidence.
- The current dashboard deliberately shows live online users as unavailable because no authoritative presence source exists. Keep this honest; do not display fabricated zero/online counts.

**Live database inventory (read-only catalog queries, 2026-11-16):**
- `ai_models`: 251 rows, 9 enabled.
- `ai_providers`: 7 provider-account rows, 3 enabled.
- `ai_model_price_versions`: 46 rows, 45 current.
- `ai_model_capability_evidence`: existing three-layer evidence registry.
- `suly_media_model_price_versions`: 22 current rows (12 image, 7 video, 3 audio); these catalog claims do not mean Studio integration is verified.
- `suly_media_generation_models`: 4 runtime models, 0 active.
- `suly_media_generation_prices`: 0 rows.
- `ai_route_model_assignments`, `suly_model_profiles`, `suly_model_profile_models`, and `ai_router_settings` already provide routing/profile configuration. The live route matrix has enabled assignments; do not replace it with a second routing registry.
- Wallet/credit sources already include `suly_credit_accounts`, `suly_credit_holds`, `suly_credit_transactions`, `suly_credit_pricing`, `suly_daily_credit_grants`, and legacy `credit_transactions`. Treat the append-only transaction history as the financial source of truth; do not edit balances directly from a new UI.
- Plan/subscription sources already include `subscription_plans`, `subscription_plan_features`, `suly_user_subscriptions`, and `user_subscriptions`.
- Audit sources include `admin_audit_logs` and legacy `audit_logs`; preserve both until their usage is fully reconciled.
- Finance/ad-related sources found include `suly_company_cost_ledger`, `suly_rewarded_ad_claims`, and `task_ledger`. The current rewarded-ad claims table records reward claims, not verified ad-network impressions, payout, or settlement. Do not report ad revenue from reward claims.
- No dedicated ad-network revenue/settlement table was found in the inspected public table-name inventory. No standalone Coins wallet/ledger was established by this inventory; do not merge Coins with SULY Credits or invent a conversion.

**Important financial configuration finding:** `suly_credit_pricing` row 1 is enabled, but `credit_value_egp` and `usd_to_egp` are NULL. Existing token-credit parameters are present. Therefore, do not infer a usable EGP/FX conversion, do not activate media runtime pricing, and do not calculate realized company profit from incomplete conversion data.

### Control Center module matrix

| Module | Existing evidence | Initial disposition |
|---|---|---|
| Overview | Existing dashboard metrics, alerts, queue, finance, audit cards | **EXTEND** into a grouped operational overview; keep unknown metrics as unavailable |
| Providers & models | Existing provider RPCs, model catalogue, health/probe data, lifecycle controls | **REUSE + ORGANIZE**; preserve provider account identity and model IDs |
| Capabilities & tests | Text model three-layer evidence and media evidence registry; PR #137 probe sync | **EXTEND** with clearer status/evidence display and modality-specific test actions only where real probes exist |
| Agent & routing | Existing route assignments, profiles, router settings, task queue | **REUSE + AUDIT**; one central agent only; no second routing engine |
| Pricing & plans | Versioned text/media price catalogues and plan tables | **REUSE + EXTEND**; retain effective-dated history and 40% target margin where already approved |
| Wallet & Credits | Credit accounts, holds, transaction ledger, daily grants, admin credit flows | **REUSE + HARDEN**; adjustments must be ledger transactions with idempotency/audit, never direct balance edits |
| Coins | No separate authoritative Coins ledger confirmed in this audit | **BLOCKED FOR DESIGN** until existing source is located or owner defines whether Coins are a distinct currency |
| Users & subscriptions | Profiles, subscriptions, existing user admin routes | **REUSE + AUDIT**; server-side admin checks and least privilege |
| Ads & rewards | Reward claims exist; no ad-network revenue/settlement source confirmed | **PARTIAL**; show reward claims separately; ad revenue stays unavailable until provider settlement data exists |
| Finance & P&L | Company cost ledger has provider cost, revenue, costs, gross profit fields; credit transactions and subscriptions exist | **EXTEND WITH RECONCILIATION**; distinguish actual, estimated, pending, and unknown; never sum incompatible units |
| Activity & audit | Admin audit and legacy audit logs exist | **UNIFY READ EXPERIENCE** without dropping either source or changing retention |
| HIMS & content | Existing HIMS admin activation-code/resource functions and protected central-chat entitlement | **PRESERVE + ORGANIZE**; HIMS stays inside the ordinary chat and central agent |
| System/security | Existing maintenance setting, admin permission guard, provider secret server-side paths | **EXTEND** with role-based least privilege, confirmation for destructive actions, and immutable audit history |

### Approved Control Center information architecture

1. Overview.
2. Providers & Models.
3. Capabilities & Verification.
4. Central Agent & Routing.
5. Pricing & Plans.
6. Wallet, Credits & (only if confirmed) Coins.
7. Users & Subscriptions.
8. Ads & Rewards.
9. Finance & Profit/Loss.
10. Activity & Audit.
11. HIMS & Content.
12. System Settings & Security.

The navigation is an administrative organization layer over existing screens and services. Keep current deep links and route behavior valid during migration. Do not hide or remove existing operations before equivalent paths are implemented and tested.

### Implementation sequence and guardrails

1. Complete the source/schema/route matrix for every existing admin screen, RPC, Edge Function, table, RLS policy, and audit event.
2. Refactor the admin shell/navigation and dashboard composition without changing business logic or query semantics.
3. Consolidate provider/model catalogue and evidence workflows using existing guarded APIs.
4. Consolidate route/profile governance and display the actual central-agent assignments without altering production assignments by default.
5. Consolidate price/plan editing while preserving immutable price versions and effective dates.
6. Review wallet adjustments, subscription changes, rewarded-ad claims, cost ledger, and P&L definitions; add missing financial sources only after source-of-truth and provider settlement semantics are documented.
7. Bring HIMS administration into the same console while preserving its existing secure code/resource workflows and ordinary-chat entitlement model.
8. Add permission-matrix, audit, RLS, rollback-only SQL, TypeScript, Deno, Web export, Android/iOS export, and cross-feature regression tests.

**Non-negotiable:** no direct table writes that bypass guarded admin RPCs; no service-role key in client code; no deleting provider/model/ledger/audit history; no guessed exchange rate, credit value, or Coins conversion; no fabricated ad revenue, presence, profit, or test result; no changes to current production route assignments or enabled models merely to make the console look tidy.

**Current Control Center status:** [>] IN PROGRESS — initial source/schema mapping and first navigation/screen foundation are implemented on branch `feat/suly-control-center-foundation-20261116`. The matrix above is an initial evidence-backed map, not a claim that every screen/RPC/RLS path has been fully audited.

**Initial UI slice now present on the working branch:**
- Reorganized the existing admin shell groups around Overview & Activity, Providers & Models, Accounts & Finance, Ads & Rewards, HIMS & Content, and System & Integrations. Existing route destinations were retained; the mobile menu now respects Arabic/English group labels.
- Added `/admin/ads` as a separate AdMob settings screen. It uses the existing admin-guarded service methods and saves only AdMob identifiers, without invoking plan updates. It explicitly does not claim ad-network revenue or settlement.
- Added `/admin/finance` as a dedicated read-only entry to the existing company-cost ledger overview. It clearly labels this as an operational ledger overview, not a complete P&L; missing FX/credit conversions and absent subscription/ad settlement sources remain excluded.
- No database migration, pricing edit, provider/model activation, routing assignment change, credit adjustment, HIMS entitlement change, or secret modification was performed in this UI slice.
- The legacy combined Plans + AdMob form has now been separated: the Plans screen loads/saves only plans and features, while the dedicated Ads screen owns AdMob settings. Remaining next steps: rerun CI against the latest branch head; complete the exhaustive route/RPC/table/RLS permission matrix; extend finance only after revenue/expense source reconciliation; then implement the remaining Control Center modules incrementally.


## Repository branch governance — approved 2026-11-16

The product owner requested a strict reduction in branch proliferation and merge risk. Effective immediately:

- Permanent branches are limited to `release/v1` (production) and `develop` (the single integration/development line).
- `release/v1` is protected and is never edited directly.
- All ongoing implementation work is accumulated on `develop`; do not create a new feature/fix/docs branch for every small task.
- A single consolidated PR from `develop` to `release/v1` is prepared only when a coherent release batch has passed the required checks.
- Do not open parallel PRs for pieces of the same work. Finish/reconcile the active integration item before starting another.
- Existing open PR #83 (Projects) and PR #138 (Control Center) must be reviewed and reconciled into the integration line; do not leave them as independent long-lived streams.
- Before retiring any legacy branch, verify its PR merge status and confirm its unique code/migrations/tests/docs are present in `release/v1` or `develop`. A squash-merged PR may still show as "ahead" in commit ancestry; merged PR status plus patch/content verification is required.
- Never force-reset a branch with unique commits. Preserve unresolved branches as archived/pending until their content is reconciled.
- Delete only branches proven fully integrated or empty. Keep a written cleanup inventory; no mass deletion based only on branch names or age.

**Integration-line reset performed:** GitHub compare confirmed `develop` was exactly 29 commits behind `release/v1` with zero commits ahead. It was safely fast-forwarded (no force push) to production commit `a80574d992630934c3a83ecc2db41ade31a4be62`. This establishes a clean integration baseline without losing unique work.

**Branch inventory observed:** 42 branches including the two permanent branches. The open PR list contains #83 and #138. Many old branches map to merged PRs (#137, #136, #135, #134, #133, #132, #131, #130, #129, #127, #126, #125, #124, #123, #122, #121, #120, #119, #118, #117, #116, #115, #114, #113, #112, #111, #110, #109, #108 and earlier merged PRs). These are cleanup candidates only after content/PR verification. Other branches have unique or unresolved work and must not be deleted until reconciled.

**Tooling limitation during this pass:** the connected GitHub actions expose branch listing/ref updates but no delete-reference operation. Therefore no branch was deleted in this pass. Do not claim the branch cleanup is complete; perform deletion later through an authorized GitHub repository UI/API operation after each branch is verified.


## Integration and branch cleanup checkpoint — 2026-11-16 17:20 +02:00

- PR #138 (SULY Control Center foundation) was squash-merged successfully into `develop` at commit `fe787973afa6506468ed8e7edec18a0fa0056682`. The PR is closed with `merged=true`.
- Latest PR #138 workflow run `43894112207` completed successfully. Expo TypeScript typecheck, mobile authentication regression tests, static Web export, Android JS bundle export, iOS JS bundle export, Deno Agent/scheduler regression tests, and Deno typecheck all passed.
- `develop` now points to `fe787973afa6506468ed8e7edec18a0fa0056682`; compare against `release/v1` confirms exactly 1 commit ahead and 0 behind. No production branch changes were made.
- PR #83 (Projects) remains open and unresolved. Its head `feat/projects-release-rebased-20261115` contains 11 changed files including project UI/service, conversation association, a database migration, and an owner-isolation regression test. It is 52 commits behind current `develop` and GitHub currently reports it non-mergeable. Do not delete its branch or claim its content is integrated. Reconcile its unique code and migration into `develop` after a conflict-aware review; do not force-reset the branch.
- Current repository branch listing returned 43 branches. The connected GitHub toolset has no branch-delete operation; no branches were deleted. The following existing branches are safe for owner-side deletion because their associated PRs are confirmed merged into `release/v1`, and `develop` contains the complete `release/v1` baseline:
  `docs/feature-registry-access-review-20261116`,
  `docs/hims-resource-gating-test-20261116`,
  `docs/phase5-final-verification-20261116`,
  `docs/phase7-8-media-audit-20261116`,
  `docs/phase10-12-catalog-routing-audit-20261116`,
  `docs/phase-status-and-audit-20261116`,
  `docs/security-advisor-audit-20261116`,
  `docs/security-audit-log-20261116`,
  `docs/security-function-audit-evidence-20261116`,
  `docs/security-share-routing-review-20261116`,
  `docs/update-roadmap-phase6-7-20261116`,
  `feat/agent-capability-evidence-routing-20261116`,
  `feat/model-catalog-capability-evidence-20261116`,
  `feat/phase6-conversation-header-mode-20261116`,
  `feat/phase6-show-actual-routed-model-20261116`,
  `feat/phase8-library-folders-favorites-20261116`,
  `feat/phase9-account-information-architecture-20261116`,
  `feat/phase13-atomic-media-admin-save-20261116`,
  `feat/provider-capability-probe-sync-20261116`,
  `fix/activation-attempt-throttle-20261116`,
  `fix/admin-dashboard-entry-auth-refresh-20261116`,
  `fix/phase14-support-theme-20261116`,
  `fix/phase14-shared-ui-theme-20261116`,
  `fix/phase14-dynamic-palette-coverage-20261116`,
  `fix/phase14-15-preference-hydration-release-20261116`,
  `security/feature-flag-write-privileges-20261116`,
  `test/phase6-model-metadata-pipeline-20261116`,
  `work/phase16-security-phase5-home-20261116`.
- Do not delete the Projects branch, PR #83, branches associated with closed-unmerged PRs #107/#128, or any remaining branch without a confirmed merged PR and content reconciliation. Future implementation commits must go directly to `develop`; keep `release/v1` untouched.


## Projects integration continuation on the single `develop` line — 2026-11-16

- PR #83 was retargeted to `develop` for reconciliation; it remains open and is not being merged as-is because its original protected-layout/drawer implementation predates the current `MainNavigation` architecture and conflicts with the current integration line.
- Read-only production schema verification confirms `public.suly_projects` exists, `suly_conversations.project_id` exists, the composite owner foreign key exists, four authenticated owner-only RLS policies exist, and anon has no table grants. No production schema write was performed in this integration pass.
- The Projects feature has been ported directly onto `develop` and adapted to the current product architecture:
  - Added the protected `/projects` route and localized, theme-aware Projects screen.
  - Added a Projects entry inside the Chats workspace without changing the five primary navigation destinations.
  - Updated active-section and safe-area handling for the Projects route.
  - Added owner-authenticated project list/create/update/archive service operations with input validation and UUID validation.
  - Added project-aware conversation creation and reads; a chat launched from a project receives its project ID when the first message creates the conversation.
  - Added a project input validation regression test.
  - Added the already-applied Projects migration and rollback-only cross-user isolation SQL regression to source control. The migration is **not being re-applied**; the live schema already exists. The migration version was not found in `supabase_migrations.schema_migrations` during read-only verification, so reconcile migration history before any future automated migration deployment.
  - Updated the verification workflow to run the project validation test and to trigger on pushes to `develop`.
- Current CI run for the latest code at the time of this note: `43896360850` — pending/in progress. Do not treat the Projects integration as CI-verified until Expo TypeScript, auth/project tests, Web/Android/iOS exports, Deno tests, and Deno typecheck complete successfully.
- No production deployment, provider routing, credit/price, HIMS, or user entitlement changes were made.
- Remaining Projects work: display conversations within each project and support safe reassignment of existing conversations; review project deletion semantics and user-facing confirmation before adding any destructive action; verify project create/list/archive/chat-link flows with authenticated test accounts. The existing PR #83 must only be closed after the integrated code passes CI and its complete patch is reconciled; do not delete its source branch before then.


### Projects security follow-up — least-privilege grants — 2026-11-16

- A deeper ACL inspection found that the live `suly_projects` table had broader direct privileges for `authenticated` than the migration's intended CRUD scope: TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN were also granted.
- Corrected the live table ACL with `REVOKE ALL PRIVILEGES ... FROM authenticated` followed by only SELECT, INSERT, UPDATE, DELETE. Read-only recheck now shows exactly those four authenticated privileges and no anon grants.
- Updated the source migration to revoke authenticated's prior/default privileges before granting the four required DML permissions. This is important because GRANTing CRUD alone does not remove pre-existing excess ACL privileges.
- Re-read all four RLS policies: SELECT/DELETE use owner-only `auth.uid()`; INSERT uses owner-only WITH CHECK; UPDATE uses owner-only USING and WITH CHECK. The composite project/user foreign key remains present.
- Re-ran the rollback-only two-user isolation test after the ACL correction. Cross-user SELECT, UPDATE, and cross-tenant conversation linking checks completed without exceptions; a separate query confirmed zero rollback fixture rows remained.
- The migration version `20261115220000` is not present in `supabase_migrations.schema_migrations`, although the live schema objects exist. Do not automatically re-apply or mark migration history as reconciled until the actual deployment/migration workflow is reviewed.
- CI run `43896360850` was still running its mobile regression suite at the time of this note; run `43896682177` was queued for the updated migration source. Record final results only after inspecting both runs.


## Phases 1–4 build checkpoint — 2026-11-16

**Working scope authorized by the product owner:** implement/reconcile only Phases 1–4 on `develop`; stop before Phase 5. This checkpoint is not authorization to deploy production or change live financial/provider/HIMS settings. Build-phase completion is assessed on implementation and source integration; end-to-end, browser/device, CI campaign, security adversarial, and live-user acceptance tests are tracked in Track B and are not reasons to hold a build phase open, unless a test reveals a defect that requires a code fix.

- **Phase 1 — Audit and inventory:** source-level inventory and critical-flow ownership matrix added at `docs/PHASES_1_4_BUILD_AUDIT.md`. It records the 604-entry repository tree, active runtime layers, key UI/server/data owners, existing verification evidence, and explicit unknowns. Source inventory is complete enough to guide implementation; it is not a browser/device or penetration-test certification.
- **Phase 2 — HIMS protection (implementation scope):** existing hash-only activation storage, admin-guarded RPCs, per-user activation throttle, private resource-table grants, authenticated student resource RPC, and resource-to-media authorization were reviewed. Added isolated parser/response regression coverage and committed the duplicate-code collision guard migration plus rollback-only regression SQL to `develop`. Applying/running that migration and adversarial verification are deferred to Track B; no live schema change was made.
- **Phase 3 — HIMS in normal chat:** existing central-router activation and explicit resource-intent path was reviewed; existing `feature_flags.test.ts` covers greetings, explicit lecture delivery, study explanations, and follow-up context. The new activation parser tests extend the ordinary-chat boundary. Real student activation and real lecture delivery are explicitly deferred to Track B; obtain isolated owner-approved test accounts and approved lecture content then. This dependency does not block completion of the Phase 3 implementation.
- **Phase 4 — Shared design system:** existing semantic light/dark tokens, system theme persistence, Cairo typography, and reusable UI primitives were reviewed. Added contrast/token regression tests for primary text, secondary text, muted text, and primary controls. The test identified light-theme muted text below the 4.5:1 AA contrast target; adjusted that semantic token from #737373 to #707070. Full screen-by-screen visual/accessibility and device verification is explicitly deferred to Track B; this does not block completion of the Phase 4 design-system implementation.
- The existing CI run `43896682177` succeeded on `e9908464835e2fce8d78762a24ccd3700135ca9d`; it predates the changes in this checkpoint. The updated workflow now includes the new activation and theme tests. A fresh run and the full runtime/device verification are recorded in Track B; they do not block the implementation milestone.
- No database migration was applied, no production data/configuration changed, no provider/model route or price was edited, no credits were adjusted, no HIMS entitlement was granted/revoked, and no secret was changed.
- **Stop line:** Phases 1–4 implementation scope is complete and reported. All remaining end-to-end, live-user, security-adversarial, visual/accessibility, cross-platform, SQL migration execution, and full-CI verification are Track B cases. Phase 5 navigation implementation is present on `develop`; continue sequentially with Phase 6. Track B remains a separate comprehensive campaign after all 17 build phases.

## Approved chat-first UX and credit-policy decisions — 2026-11-16

- The product owner approved three specification decisions: subscription-plan allowance is **monthly**; purchased credits **never expire**; and the model selector displays **all four profiles (Lite, Pro, Max, Ultra)** with clear available/restricted states.
- The detailed specification is maintained in `docs/SULY_CHAT_FIRST_UX_AND_CREDIT_POLICY.md`.
- The intended home experience is simple, chat-first: users write naturally and the single central Agent decides whether the request is ordinary chat or requires planning/tools. Specialized media workflows remain in Studio, while the Agent may invoke them from chat when appropriate.
- These are **approved product specifications, not verified current backend behavior**. No subscription, credit-ledger, expiry, pricing, model-routing, provider, HIMS, or production setting was changed by recording these decisions.
- Before implementation, inspect the existing plan/grant schedule, ledger and expiry semantics, model catalog/entitlements/routing, and current UI. Preserve historical balances and enforce server-side access. The specification explicitly leaves top-up prices, reward quantities/expiry, deduction priority, extra daily limits, and exact model capabilities/prices undecided.

