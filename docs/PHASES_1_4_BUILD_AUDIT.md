# SULY — Phases 1–4 Build Audit & Baseline

**Date:** 2026-11-16  
**Branch:** `develop`  
**Baseline commit before this audit:** `d925a70502ee16197348d3f914c1ff2748a2c101`  
**Purpose:** Record the source-level system inventory and the existing implementation evidence used to continue the first four build phases. This is an engineering inventory, not a penetration-test, production-acceptance, or device-test certificate.

## Repository and runtime inventory

The repository tree at the baseline contains 604 entries. The active product is the Expo Router application in `apps/mobile/`; `supabase/` contains PostgreSQL migrations, RLS/security regressions, Edge Functions, and the server-side AI runtime. The root Node package is a pinned esbuild bundle tool, not a second client application.

| Area | Main source locations | Current responsibility |
|---|---|---|
| Application shell and routes | `apps/mobile/app/`, `src/components/navigation/MainNavigation.tsx` | Expo Router auth/protected routes, web/mobile navigation, deep links |
| Authentication | `src/features/auth/`, `src/lib/supabase/` | Supabase Auth session, callback, protected route state |
| Chat and conversations | `src/features/chat/`, `app/(protected)/chat.tsx` | Messages, SSE streaming, conversation history, attachments, retry |
| Central agent and durable tasks | `supabase/functions/ai-router/`, `brain-router/`, `agent-task-worker/`, `agent-task-scheduler/`, `_shared/agent_task_queue.ts` | One central request router, bounded planning/execution, durable queue, cancellation, usage settlement |
| HIMS entitlement and content | `src/features/hims/`, `src/features/admin/HimsAdminScreen.tsx`, `_shared/activation_command.ts`, `_shared/feature_flags.ts`, `_shared/feature_resource_context.ts` | Admin code/resource management, chat activation, server-side entitlement, authorized resource context |
| Media and Studio | `src/features/media/`, `src/features/studio/`, `media-gateway/`, `image-generator/` | User media uploads/delivery, Studio entry points, provider-backed generation guardrails |
| Library and storage | `src/features/media/media-service.ts`, `global_media_assets`, Cloudinary delivery helpers | Owned media metadata, signed/authenticated delivery |
| Projects | `src/features/projects/`, `src/features/chat/chat-service.ts`, `suly_projects` migration/tests | Owner-scoped project CRUD and optional conversation association |
| Admin | `src/features/admin/`, `app/(protected)/admin/`, guarded admin RPCs | Providers/models, evidence, routing, pricing, credits, users, HIMS, audit, finance, ads |
| Billing and credits | `src/features/credits/`, `src/features/billing/`, `suly_credit_*`, usage ledger functions | Holds, transactions, daily grants, plan/entitlement and usage settlement |
| Ads and rewards | `src/features/ads/`, `suly_rewarded_ad_claims` | Reward UI and claims; claims are not verified ad-network revenue |
| Theme and localization | `src/theme/ThemeProvider.tsx`, `colors.ts`, `LocaleProvider.tsx`, `PremiumText.tsx` | Light/dark/system theme, Arabic/English locale, shared semantic palette and typography |
| Deployment and checks | `.github/workflows/`, `apps/mobile/package.json`, root `package.json` | Expo typecheck, Jest, web/Android/iOS exports, Deno tests/typecheck, Pages/Edge deployment workflows |

## Critical flow ownership and evidence matrix

| Critical flow | UI/client owner | Server/data owner | Baseline status and evidence |
|---|---|---|---|
| Sign-in/session | Auth screens and `auth-provider.tsx` | Supabase Auth and profile policies | Existing auth regression tests; current device/session UX remains for Track B |
| Normal chat | `chat-service.ts`, chat route and SSE manager | `ai-router/index.ts`, provider adapters | Existing chat/retry tests; authenticated live provider E2E not established by source review |
| Complex agent task | Chat/Brain task services | Central Agent, task worker/scheduler, queue and usage ledger | Durable queue, cancellation, fencing and settlement regression suites exist |
| HIMS activation | Normal chat submission; HIMS admin screen | Activation parser, rate limiter, `suly_activate_feature`, feature registry | Hash-only code storage, admin guard, rate limiting and bounded activation responses are present; live student journey still needs owner-supplied test accounts |
| HIMS resource retrieval | Normal chat and HIMS resource viewer | Explicit-intent gate, `suly_feature_context`, student resource RPC, `media-gateway` | Resource-intent regression tests exist; protected media requires activated profile plus exact active resource mapping; real lecture delivery is not yet owner-verified |
| Provider/model routing | Chat model selector and admin screens | Route assignments, profiles, eligibility, capability evidence | Existing route governance and evidence registries; provider assignment changes intentionally excluded from this pass |
| Credits and settlement | Balance/upgrade/admin credit screens | Credit holds, transaction ledger, usage settlement RPCs | Regression SQL exists; no balances or pricing changed |
| Media upload/delivery | Attachments, Studio, Library | `media-gateway`, Cloudinary, `global_media_assets` | Authenticated delivery path present; live media acceptance remains separate |
| Projects/conversation linking | Projects screen and chat service | Owner RLS and composite project-owner FK | Source and rollback-only isolation test present; PR #83 remains open/non-mergeable and must be reconciled before closure |
| Admin operations | Admin shell and feature screens | Guarded admin RPCs and audit tables | Broad foundation exists; exhaustive route/RPC/RLS matrix remains a later admin audit item |
| Theme/locale | Shared theme and locale providers | Local persisted preference only | Light/dark/system and Arabic/English foundations exist; full screen contrast/accessibility review remains |

## HIMS security and experience baseline

Source review confirms these safeguards already exist on `develop`:

- Activation codes are stored as SHA-256 hashes; the raw bearer code is returned only by the guarded creation RPC and the list RPC returns no plaintext code.
- Admin code creation/listing checks the database-backed admin predicate.
- Activation attempts use a service-role-only per-user limiter with a 15-minute window, a five-attempt cap, a three-second minimum interval, and row locking.
- Direct client-role access to the private feature-resource table is revoked. Authenticated students use the bounded `suly_my_feature_resources` RPC, which returns resources only for the authenticated active HIMS user.
- The central AI router checks explicit resource intent before loading feature context. General study explanations and greetings are covered by regression tests and should remain ordinary chat.
- Private HIMS media delivery checks both the student's activation and the exact active resource-to-media mapping.
- The HIMS screen is a resource viewer/management surface; it does not create a second conversational agent. Activation and resource requests remain in the ordinary central chat.

**Known security item for targeted review:** the activation-code creation RPC currently uses an `ON CONFLICT (code_hash) DO UPDATE` path that can reactivate/update an existing hash. Do not reuse an old bearer code to reset its usage/disabled state. A safer duplicate-code policy needs a reviewed migration and rollback regression; it was not changed in this audit because schema migration tooling/verification must be completed before changing live authorization behavior.

## Phase 4 shared design baseline

- `ThemeProvider` supports `system`, `light`, and `dark`, persists the user's choice, and resolves a semantic palette.
- `colors.ts` provides matching semantic keys for dark and light palettes (surface, text, muted text, primary, status colors, borders, cards, inputs, overlays).
- `PremiumText` standardizes Cairo regular/bold typography; reusable `SulyButton`, `SulyCard`, and `SulyScreen` components exist.
- The current roadmap's approved visual direction is a restrained black/white light-and-dark foundation. Do not reintroduce an older gold palette unless the owner explicitly changes the approved direction.
- A Jest regression now checks semantic token parity and WCAG AA contrast for primary/secondary/muted text and primary controls. It exposed the light-theme muted-text contrast gap; the light token was corrected to #707070. Existing app/admin/HIMS surfaces still contain local styles; a full visual/accessibility sweep is not claimed complete by this source inventory.

## Baseline verification and constraints

- GitHub Actions run `43896682177` succeeded on code commit `e9908464835e2fce8d78762a24ccd3700135ca9d`: Expo TypeScript typecheck, selected mobile auth/chat/project tests, static Expo Web export, Android and iOS JS bundle exports, Deno Agent/scheduler regression tests, and Deno typecheck.
- The current `develop` head at audit start was `d925a70502ee16197348d3f914c1ff2748a2c101`; the successful run above is a nearby prior code baseline, not a check on this audit commit.
- No browser automation, installed native app, or real Android/iOS device was available in this audit; no visual or device pass is claimed.
- No production deployment, database write, provider routing change, model activation, credit adjustment, HIMS entitlement change, or secret change was performed.
- PR #83 remains open and non-mergeable. Its unique patch must be reconciled; do not close/delete it based only on the project files already present.

## Phase 1 disposition

The source inventory, critical-flow ownership matrix, and baseline evidence are now recorded in this maintained document. The inventory is source-level and intentionally records unverified runtime journeys as such. Continue updating it as implementation reveals more dependencies; do not convert an unverified flow to PASS without evidence.


## Execution update — 2026-11-16

### Phase 1 — source inventory disposition
- **DONE — VERIFIED (source-level).** The inventory and critical-flow ownership/evidence matrix above meet the repository/source audit deliverable. It does not certify live end-to-end behavior; those gaps remain in their owning phases.

### Phase 2 — HIMS live authorization review
Read-only checks against Supabase project `razvryvazmqvvqkzetuo` confirmed:
- `suly_activation_codes`, `suly_feature_activations`, and `suly_feature_resources` have RLS enabled.
- Direct anon/authenticated table privileges are denied for these three tables.
- The client-deny policies on activation-code and activation tables are explicitly false for all client operations.
- `suly_activate_feature(uuid,text)` is SECURITY DEFINER with a fixed search_path and is not executable by anon or authenticated; the central server path is the only permitted caller.
- Admin code create/list/resource-management RPCs are executable by authenticated callers but contain server-side `auth.uid()` plus `suly_is_admin()` checks. `suly_my_feature_resources` is authenticated-only and returns resources for the current user.
- Resource table SELECT is protected by an active-resource policy and no direct authenticated table SELECT privilege is granted; the approved bounded RPC remains the student path.
- The project is ACTIVE_HEALTHY on PostgreSQL 17.11. Live migrations include the HIMS hash-only, resource isolation, student-resource RPC, rate-limit, and profile-write protections through the current project migration set.

**Confirmed defect:** the deployed `suly_admin_create_activation_code` still uses `ON CONFLICT (code_hash) DO UPDATE`, which can reactivate or mutate an existing bearer code and reset its configured limits. This is not acceptable for a one-time bearer credential.

**Committed but not yet applied/executed:**
- `supabase/migrations/20261116150000_hims_activation_code_collision_guard.sql` changes duplicate hash handling to `DO NOTHING` followed by SQLSTATE 23505; existing code state is not modified.
- `supabase/tests/hims_activation_code_collision_regression.sql` verifies a duplicate is rejected and prior disabled/used/label/limit state remains unchanged inside a rollback-only transaction.

The migration source and rollback-only regression are implementation artifacts committed to `develop`. Applying the migration in an isolated test environment, running the SQL regression, reviewing rollback, and any live student/admin journey checks are deferred to Track B. No hosted schema changes were made.

### Phase 3 — student journey
- Source-level parser, intent, and protected-resource paths are present.
- Real student login/activation and actual lecture delivery are **DEFERRED TO TRACK B**; use dedicated test accounts and approved lecture/content source at that time. No passwords or secrets should be sent in chat.

### Phase 4 — design system
- Existing theme provider supports system/light/dark and persisted preference; shared tokens and reusable `SulyButton`, `SulyCard`, and `SulyScreen` primitives exist.
- Muted text tokens were updated to dark `#888888` and light `#6B6B6B`.
- Chat header credit pill, chat empty state, task prompt text, task icon surface, chat usage/share icons, selected rating stars, Home brand mark, and HIMS download icon now use shared semantic palette tokens rather than fixed light/dark colors.
- Automated contrast coverage now checks primary/secondary/muted text against background, surface, elevated surface, card, and input backgrounds, plus primary button foreground/background.
- The test file is included in the existing GitHub Actions Jest command. Current-commit CI execution, full visual browser review, and Android/iOS device review are **DEFERRED TO TRACK B**.

### Current first-four-phase implementation disposition
- Phase 1: implementation/source inventory complete.
- Phase 2: HIMS security implementation and duplicate-hash guard migration source committed; migration execution and adversarial validation deferred to Track B.
- Phase 3: central-chat HIMS intent and protected resource-delivery implementation present; real-user acceptance deferred to Track B.
- Phase 4: shared semantic theme tokens, core-surface migration, and automated contrast regression source committed; full screen/device/accessibility validation deferred to Track B.

**Rule:** Do not keep a build phase open only because its comprehensive tests have not yet run. Record all such tests in Track B. If Track B discovers a defect, create a linked implementation fix in Track A/develop and rerun the relevant case. This document records implementation status, not a claim that the product has passed comprehensive testing.


## متابعة تنفيذ HIMS — 2026-11-16 (بعد تحديث الخطة الرئيسية)
- تصحيح سجل المرحلة 2: هجرة `20261116180955_hims_activation_code_collision_guard` موجودة في سجل هجرات مشروع Supabase المتصل، ومصدرها على develop يرفض تكرار hash ولا يغيّر سجل الكود الأصلي. لا تخلطها مع مسودة الهجرة الأقدم.
- فحص صلاحيات القراءة أكد RLS ومنع صلاحيات الجدول المباشرة عن anon/authenticated لجداول الأكواد والاستحقاقات والموارد، وقصر `suly_activate_feature` على service_role.
- فحص دوال الإدارة أكد وجود تحقق `auth.uid()` و`suly_is_admin()` في الدوال المفحوصة؛ لا تُسقط تحذيرات Advisor على أنها ثغرات مثبتة دون تدقيق كل دالة.
- أضيفت اختبارات Deno لحد المحاولات fail-closed، وretry-after، وتنقية أخطاء التفعيل، ومنع جلب موارد HIMS للمستخدم غير المفعّل في `supabase/functions/_shared/feature_flags.test.ts`، commit `391feae982ad092eaba3214947e85064b97fb66e`.
- لم يُنفذ اختبار SQL متغير للبيانات لأن Supabase project لا يحتوي حاليًا على فرع تطوير معزول؛ لم تُجرَ أي كتابة جديدة على قاعدة البيانات في هذه الدفعة.
- **خطر متبقٍ:** سباق كودين مختلفين للمستخدم نفسه قد يزيد `used_count` للكود الثاني رغم أن إدخال الاستحقاق قد اصطدم بقيد فريد. يلزم اختبار متزامن وإصلاح ذري بهجرة جديدة في بيئة معزولة قبل إغلاق Phase 2.
- Phase 3: تنفيذ المصدر في المحادثة العادية موجود؛ قبول طالب/مدير حقيقي وتسليم محتوى فعلي يظل BLOCKED حتى توفير حسابات اختبار ومحتوى معتمد.
- Advisor snapshot الحالي: 12 RLS-without-policy informational findings، 2 extensions-in-public warnings، 1 anon SECURITY DEFINER public-share warning، 61 authenticated SECURITY DEFINER warnings، وleaked-password protection disabled. لم يتم تغيير أي إعداد منها في هذه الدفعة.
