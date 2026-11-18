# SULY Admin 3.0.0 — Repository Audit Report

- **Audit scope:** Phase 0 — read-only repository audit
- **Repository:** `eslammohamedk123450-netizen/smsm-ai`
- **Audited branch:** `develop` (all inspected source references explicitly pinned to this branch)
- **Plan:** `docs/ADMIN_3.0.0_PLAN.md`
- **Baseline commit inspected:** `e6b6ac536d735c0ff720fb02cee0171b42f88862`
- **Audit date:** 2026-11-18
- **Status:** Inventory assembled from repository source and GitHub CI metadata. This report does not certify production runtime behavior.

## 1. Executive summary

The repository already contains a substantial Expo/React Native administrative workspace, a large Supabase-backed administration service, SQL RPCs and RLS policies, operational Edge Functions, and a dedicated HIMS student/admin feature. Admin 3.0.0 should therefore consolidate and govern existing capabilities rather than create parallel replacements.

No application code, migrations, production settings, or database objects were changed during the audit. The only intended repository change is this report.

Important audit findings:

1. Admin routes currently live under `apps/mobile/app/(protected)/admin`; implementation is shared across `apps/mobile/src/features/admin`.
2. The admin service exposes 64 async operations, backed by 18 directly referenced tables, 27 RPC names and 3 invoked Edge Functions (static extraction from the current service file).
3. The Supabase migrations directory contains 170 entries. Six three-digit migration version prefixes are duplicated; migration ordering and deployment history must be reconciled before any schema work.
4. HIMS is a first-class feature with student UI, admin management UI, activation-code lifecycle, feature-resource management, media delivery dependencies, and server-side activation checks. It must be preserved.
5. GitHub Actions metadata for the inspected baseline commit shows successful jobs for mobile typecheck/Jest/export, Edge Function checks, HIMS regressions, and other targeted checks. These are CI results, not a fresh local test run.
6. The default repository branch is `release/v1`; all audit reads and the report write are explicitly pinned to `develop`.

## 2. Repository architecture

### Main components

| Area | Current location | Responsibility |
|---|---|---|
| Expo application | `apps/mobile` | Shared mobile/web application |
| File-based routes | `apps/mobile/app` | Expo Router route tree and protected areas |
| Feature modules | `apps/mobile/src/features` | Admin, HIMS, auth, media and application features |
| Shared UI/theme | `apps/mobile/src/components`, `apps/mobile/src/theme` | Reusable components, theme and locale providers |
| Supabase schema | `supabase/migrations` | Database schema, policies, RPCs and triggers |
| Edge Functions | `supabase/functions` | Server-side API/runtime functions |
| SQL regression tests | `supabase/tests` | Database security and behavior regressions |
| CI/CD | `.github/workflows` | Type checks, tests, exports, bundles and deployment |
| Documentation | `docs` | Architecture, security and implementation plans |

### Technology inventory

- Expo SDK 58, React Native and Expo Router.
- TypeScript 6.0.3, React/Jest toolchain, npm lockfile v3.
- Supabase JS 2.119.0 in the application lockfile.
- Supabase Postgres, Auth, RLS, SQL RPC and Storage.
- Deno-based Supabase Edge Functions.
- GitHub Actions and GitHub Pages export/deployment workflow.

Versions above are repository declarations/lockfile values, not a statement that every dependency is current or vulnerability-free.

### Edge Function inventory

The current `supabase/functions` directory contains:

- `admin-storage`
- `agent-task-scheduler`
- `agent-task-worker`
- `ai-router`
- `brain-router`
- `composito-integration`
- `image-generator`
- `media-gateway`
- `model-health-check`
- `sync-models`
- `upload-media`
- `_shared` (shared runtime utilities)

## 3. Existing admin pages and routes

Route inventory under `apps/mobile/app/(protected)/admin`:

| Route | Existing capability / target area |
|---|---|
| `index.tsx` | Admin home/dashboard |
| `ads.tsx` | Ads and rewarded-ad settings |
| `agents.tsx` | Agent registry and task overview |
| `api-keys.tsx` | Provider credentials/provider administration entry |
| `audit.tsx` | Audit trail |
| `brain.tsx` | Brain/planner operations |
| `circuit-breaker.tsx` | Model health/circuit breaker |
| `composio.tsx` | Composio integration |
| `conversations.tsx` | Conversation operations |
| `credit-management.tsx` | Credits, wallet and adjustments |
| `finance.tsx` | Finance and usage/cost operations |
| `friction.tsx` | Friction/operational diagnostics |
| `hims.tsx` | HIMS administration |
| `image-generation.tsx` | Image generation configuration |
| `media-catalog.tsx` | Media model catalog |
| `model-capabilities.tsx` | Model capability administration |
| `model-capability-review.tsx` | Capability evidence/review |
| `models-catalog.tsx` | Text/model catalog |
| `models-operations.tsx` | Model operational controls |
| `models.tsx` | Model management |
| `page-builder.tsx` | Custom admin page builder |
| `pricing.tsx` | Pricing and plans |
| `storage.tsx` | Storage bucket/object browser |
| `support.tsx` | Support operations |
| `tavily.tsx` | Tavily integration |
| `users.tsx` | User/account administration |

The directory also contains `_layout.tsx`. The route count above is 26 named screens plus the layout file (27 files total). The broader route directory listing may include additional nested content; this table records the top-level entries observed.

### Reusable admin implementation

- `apps/mobile/src/features/admin/AdminScreens.tsx`: shared provider, model, user, credit, pricing, circuit-breaker and agent screens.
- `apps/mobile/src/features/admin/admin-service.ts`: central admin data/action service.
- `apps/mobile/src/features/admin/HimsAdminScreen.tsx`: HIMS-specific administration.
- `apps/mobile/src/features/admin/GmailModelPickerCard.tsx`, `RouteModelChainsCard.tsx`, `ModelPricingAdminCard.tsx`: specialized reusable model controls.
- `apps/mobile/src/features/admin/provider-presets.ts`: provider presets.
- `apps/mobile/src/features/admin/admin-confirm.ts`: confirmation helper.
- `apps/mobile/src/features/admin/AdminMobileBreadcrumb.tsx`: admin navigation context.

The shared service and screens should be evaluated for reuse before introducing new services or duplicate UI.

## 4. Authentication, roles and permissions

Observed permission architecture:

- Protected app routing is organized under `(protected)`.
- Supabase Auth session is used by the client.
- `suly_is_admin()` is the principal database-side admin predicate used by admin RPCs and the storage Edge Function.
- Admin RPCs commonly use `SECURITY DEFINER`, explicit admin checks, and explicit execute grants/revokes.
- RLS is enabled on core tables in the initial policy migration and on later feature tables in subsequent migrations.
- The `admin-storage` Edge Function validates the bearer JWT with `auth.getUser`, calls `suly_is_admin` using the user-scoped client, and only then uses the service-role client for Storage listing.

### Permission audit cautions

- A client-side route guard is not a substitute for server-side authorization.
- Every new Admin 3.0.0 action must enforce authorization in the database RPC or Edge Function, not only in UI.
- Review all `SECURITY DEFINER` functions for fixed `search_path`, explicit authorization, least-privilege grants, and safe object access.
- The initial RLS migration and later migrations should be considered together; do not infer current effective privileges from one migration alone.
- The complete role/claim source and every policy expression were not exhaustively proven against a live database during this repository-only audit. Verify effective policies in a controlled database inspection before migration.

## 5. Database and permission inventory

### Core schema evidenced in initial migration

`001_initial_schema.sql` creates:

- `profiles`
- `ai_models`
- `api_keys`
- `conversations`
- `messages`
- `credit_transactions`
- `model_health_logs`
- `admin_audit_logs`

`002_rls_policies.sql` enables RLS on these core tables and defines owner/admin/service-oriented policies. `003_rpc_functions.sql` defines credit, model lifecycle, balance lookup and health-failure functions, several using `SECURITY DEFINER`.

### Admin service static dependency extraction

The following are direct references extracted from `admin-service.ts`. They are not claimed to be the entire database schema.

**Tables (18):**

`agent_registry`, `ai_model_attempt_logs`, `ai_model_health`, `ai_model_price_versions`, `ai_model_probe_logs`, `ai_model_probe_state`, `ai_models`, `ai_router_settings`, `subscription_plan_features`, `subscription_plans`, `suly_conversations`, `suly_credit_accounts`, `suly_credit_pricing`, `suly_credit_transactions`, `suly_media_model_price_versions`, `suly_profiles`, `system_settings`.

**RPCs (27):**

`suly_admin_adjust_credits`, `suly_admin_agent_task_overview`, `suly_admin_composio_status`, `suly_admin_create_activation_code`, `suly_admin_delete_provider`, `suly_admin_grant_subscription`, `suly_admin_list_activation_codes`, `suly_admin_list_archived_providers`, `suly_admin_list_feature_resources_v2`, `suly_admin_list_providers`, `suly_admin_list_unified_route_assignments`, `suly_admin_reset_model_health`, `suly_admin_save_image_generation_model`, `suly_admin_save_route_models`, `suly_admin_set_activation_code_active`, `suly_admin_set_ai_model_price`, `suly_admin_set_composio_api_key`, `suly_admin_set_media_model_price`, `suly_admin_set_provider_enabled`, `suly_admin_set_provider_lifecycle_v2`, `suly_admin_set_tavily_api_key`, `suly_admin_set_user_banned`, `suly_admin_tavily_status`, `suly_admin_update_credit_finance_controls`, `suly_admin_update_credit_pricing`, `suly_admin_update_negative_balance_limit`, `suly_admin_update_provider`, `suly_is_admin`, `suly_set_model_settings`.

**Invoked Edge Functions (3):**

`admin-storage`, `model-health-check`, `sync-models`.

Note: static extraction counts unique function names. It is a source inventory, not proof each call succeeds against a deployed environment.

### Additional schema systems identified

- Unified model registry: `suly_model_registry`, `suly_model_capabilities`, `suly_model_registry_audit`, `suly_model_route_assignments`.
- Custom admin page builder: `suly_admin_custom_pages`, `suly_admin_custom_page_versions`.
- HIMS feature flags/resources/activation codes and user activation records.
- Legacy model/provider/catalog/route tables remain in use alongside the unified registry.
- Credit accounts, pricing, transactions, subscription plans/features, and price-version histories coexist as distinct accounting/billing domains.

### Migration numbering risk

The migration directory contains 170 files. Six three-digit version prefixes were observed more than once. This is a migration-history governance blocker: determine the exact duplicate filenames, applied migration ledger, and Supabase CLI behavior before renaming, squashing, reordering or applying anything. No migration was run as part of this audit.

## 6. Duplicate systems map

| Concern | Existing representations | Risk / Admin 3.0.0 direction |
|---|---|---|
| Model catalog | Legacy `ai_models` and media catalog; unified `suly_model_registry` and capabilities | Keep one canonical admin view; preserve compatibility triggers until migration plan is approved |
| Model routing | Legacy router settings/route model assignments and unified route assignments | Avoid two independent editors; identify canonical write path and reconciliation rules |
| Provider management | Provider records, API key/secret storage, provider presets and sync jobs | Centralize lifecycle and secret handling; never expose secrets in list/read APIs |
| Pricing | Text model price versions, media price versions, credit pricing, plan prices | Separate provider cost, customer selling price, credit conversion and subscription price |
| Credits / wallet | Credit accounts, credit transactions, legacy balance/profile fields and adjustment RPCs | Establish immutable ledger as financial source of truth; reconcile derived balances |
| Health / reliability | Health rows, attempt logs, probe state/logs, circuit breaker UI | One operational view over distinct event/state stores |
| Ads / rewards | AdMob settings and reward/credit transaction paths | Verify reward idempotency and server-side receipt/verification; do not trust client callbacks |
| Admin navigation | Route files, shared screens, custom page builder | Distinguish code-defined routes from data-defined custom pages |
| Audit | `admin_audit_logs`, model registry audit and other feature-specific logs | Unified audit search can aggregate, but must not erase domain-specific records |

These are overlapping representations, not proof of defective behavior. Consolidation must be evidence-led and preserve backward compatibility.

## 7. HIMS preservation map

**HIMS is a core system and must not be removed, disabled, or replaced as a side effect of Admin 3.0.0.**

### Current frontend

- Student route: `apps/mobile/app/(protected)/hims.tsx`.
- Student screen: `apps/mobile/src/features/hims/HimsScreen.tsx`.
- Student service: `apps/mobile/src/features/hims/hims-service.ts`.
- Admin route: `apps/mobile/app/(protected)/admin/hims.tsx`.
- Admin screen: `apps/mobile/src/features/admin/HimsAdminScreen.tsx`.
- Date validation: `apps/mobile/src/features/admin/hims-admin-validation.ts`.

Student behavior evidenced in source:

- Checks feature status through `suly_my_feature_status`.
- Checks activation state before loading resources.
- Loads resources through `suly_my_feature_resources`.
- Displays lectures, videos, files and images with filtering.
- Resolves media asset delivery URLs through the media service.
- Directs unactivated users to the chat activation flow.

Admin behavior evidenced in source:

- Lists and creates activation codes.
- Supports code label, usage limit and expiry.
- Uses Expo Crypto UUID generation rather than `Math.random` for generated codes.
- Displays/copies the activation command.
- Uploads media tagged to `featureKey: "hims"`.
- Creates and manages HIMS resources and activation states.
- Uses confirmation helper for sensitive actions.

### HIMS backend and security

- `suly_activation_codes` stores SHA-256 code hashes; the creation RPC returns the raw bearer code once. The list RPC returns a fingerprint and a NULL legacy `code_plain`, not the raw code.
- `suly_my_feature_resources` is a `SECURITY DEFINER` function with a fixed search path, requires authenticated user, active user state, active HIMS feature flag and `hims_activated` on the user's profile. It returns only active HIMS resources.
- `suly_activate_feature` is granted to `service_role` only in the inspected migration, so the activation command path must remain server-controlled.
- HIMS resources rely on the media upload/delivery subsystem for private assets.
- Admin HIMS operations are exposed through `admin-service.ts` and admin RPCs such as activation-code and feature-resource list/upsert operations.

### HIMS dependencies to preserve

1. Auth identity and active-user checks.
2. Feature flag state and profile activation state.
3. Activation code hash, usage count, expiry and active state.
4. Server-side activation command processing and throttling/collision protections.
5. Feature-resource metadata and active/inactive lifecycle.
6. Media asset association, upload authorization and private delivery URLs.
7. Admin audit trail.
8. Existing student/admin routes and regression tests.

### HIMS migration target

Admin 3.0.0 should place HIMS under a first-class Education/HIMS administration area, retaining the current screens and backend contracts initially. Any redesign must preserve student access, activation semantics, media privacy, code one-time disclosure, and existing regression guarantees.

## 8. Models, providers, routing, pricing, credits and subscriptions

| Capability | Existing source | Admin 3.0.0 target |
|---|---|---|
| Providers | `AdminScreens.tsx`, `admin-service.ts`, provider RPCs and provider tables | Provider registry and credential vault controls |
| Text models | `models.tsx`, `models-catalog.tsx`, `models-operations.tsx`, `ai_models` | Unified model catalog with lifecycle and compatibility |
| Media models | `media-catalog.tsx`, `image-generation.tsx`, media catalog tables/RPCs | Unified catalog with service type and capability |
| Capabilities | `model-capabilities.tsx`, `model-capability-review.tsx`, registry/capability evidence | Capability governance and evidence review |
| Routing | `agents.tsx`, `brain.tsx`, route cards, router settings and route assignments | Central routing policy and agent-role mapping |
| Pricing | `pricing.tsx`, model/media price versions, credit pricing | Versioned price book with explicit cost/revenue/credit units |
| Credits | `credit-management.tsx`, credit account/transaction tables and RPCs | Wallet, immutable ledger, adjustment approvals |
| Subscriptions | `pricing.tsx`, plans/features and grant RPC | Plan catalog, entitlement and subscription lifecycle |
| Reliability | `circuit-breaker.tsx`, health/attempt/probe tables and Edge Function | Model reliability operations and traceability |
| Agent tasks | `agents.tsx`, `agent_registry`, queue overview RPC, worker/scheduler | Agent operations, task lifecycle and usage settlement |

## 9. Ads, rewards and analytics

- Admin route `ads.tsx` and service methods `getAdMobSettings` / `updateAdMobSettings` are present.
- Rewarded-ad client UI exists under `apps/mobile/src/features/ads` (including `RewardAdButton.tsx` and platform-specific config files).
- Reward and credit accounting must be reconciled with the credit ledger and server-side verification before Admin 3.0.0 treats reward metrics as financial truth.
- Finance, conversations, model attempt/probe logs, agent task overview, credit transactions and audit logs provide existing operational/usage data sources.
- A dedicated analytics warehouse or a single canonical analytics event schema was not established by the inspected inventory. Treat analytics as a reporting layer over verified source systems, not as an assumed existing subsystem.

## 10. Existing tests and baseline results

### SQL regression suite inventory

31 SQL regression files were listed under `supabase/tests`, covering:

- Admin provider RPC privilege boundaries.
- Agent queue, cancellation races, fencing, checkpointing and exact usage settlement.
- Text/media pricing versions and model price administration.
- HIMS activation collision and student resource isolation.
- Feature activation throttling and feature-flag write privileges.
- Model routing governance, capability registry and access policies.
- Provider secret access and archive/restore.
- Password storage hardening and profile/model-health security.
- Storage/media organization and project isolation.

### CI baseline

Inspected GitHub Actions runs associated with the baseline commit:

- **Run 44335931967:** completed successfully. Jobs included Edge Function bundle verification, theme/project defaults, HIMS activation/resource isolation regressions, and currency-safe media billing checks.
- **Run 44335932029:** completed successfully. Jobs included Agent/scheduler regression tests, Deno typecheck, Expo TypeScript typecheck, full mobile Jest regression suite, static web export, Android bundle export and iOS bundle export.
- **Run 44335932094:** build completed successfully; deploy job was skipped. This is not evidence of a new production deployment.

These results are historical CI metadata for the inspected commit. The audit did not run the suite locally and did not run a new workflow.

### Baseline limitations

- No live Supabase database inspection was performed.
- No production smoke test or authenticated admin session test was performed.
- No fresh dependency installation or local Jest/Deno/Expo test run was performed.
- CI success does not prove all production secrets, environment variables, deployed migrations or external provider integrations are healthy.

## 11. Security and dependency observations

### Positive controls observed

- RLS is enabled on core and later feature tables.
- Admin RPCs commonly check `suly_is_admin()`.
- Admin RPC execute privileges are explicitly revoked/granted in inspected migrations.
- HIMS activation codes are stored as hashes and raw values are returned only on creation.
- HIMS student resource RPC checks authentication, active user, feature flag and per-user activation.
- `admin-storage` authenticates the bearer token and checks admin status before using service role.
- Storage object path validation rejects traversal-like segments (`.`, `..`, leading slash and backslash).
- CI includes targeted security and regression workflows.

### Items requiring focused review

1. Audit all `SECURITY DEFINER` routines for fixed search path, privilege checks, ownership and grant scope.
2. Verify every admin table's RLS policies and effective grants, including policies added/replaced by later migrations.
3. Review secret storage and retrieval for provider API keys, Composio and Tavily. UI must never receive plaintext secrets after write.
4. Verify rewarded-ad reward callbacks cannot mint credits from client-side assertions alone; require server-side verification and idempotency.
5. Review credit adjustments, subscription grants and pricing edits for auditability, authorization and atomicity.
6. Confirm all storage buckets are private where required and all delivery URLs are short-lived/authorized.
7. Review CORS allowlists, rate limits, request-size limits and error disclosure on Edge Functions.
8. Confirm activation-code attempts are throttled across identities/IP/device signals as intended.
9. Run a current dependency vulnerability audit and license review before upgrades. No dependency updates were performed.

### Dependency snapshot

The application lockfile records, among others, Expo 58.0.23, Supabase JS 2.119.0, Jest 30.5.2, TypeScript 6.0.3, glob 14.0.2 and minimatch 11.0.1. The Edge Function `admin-storage` imports Supabase JS 2.49.1 from esm.sh. Version differences should be intentional and reviewed; this audit did not establish whether they are vulnerable or incompatible.

## 12. Capability migration matrix

| Current capability | Current source of truth / implementation | Admin 3.0.0 destination | Migration approach |
|---|---|---|---|
| Admin home | `admin/index.tsx`, dashboard screen/service data | Overview | Reuse metrics; define verified KPI contracts |
| Users and bans | `users.tsx`, profiles and ban RPC/audit | Users & Access | Reuse RPC; add explicit permission matrix |
| Provider credentials | Provider admin service/RPC and secret store | Providers | Reuse server contract; strengthen secret lifecycle |
| Model catalog | Legacy model tables plus unified registry | Model Center | Preserve legacy sync until canonical cutover |
| Capabilities | Capability evidence and unified registry | Capabilities | Reuse evidence; add review workflow |
| Routing and Agent | Router settings, route assignments, agent registry/queue | Agent & Routing | Unify UI; retain queue/worker runtime |
| Pricing | Model/media price versions and credit pricing | Pricing & Billing | Keep distinct financial dimensions |
| Credits | Credit accounts and transaction ledger | Wallet & Credits | Reconcile balance with ledger before UI cutover |
| Subscriptions | Plan/feature tables and grant RPC | Plans & Entitlements | Reuse entitlements and audit |
| Ads/rewards | AdMob settings and rewarded-ad flow | Growth & Rewards | Verify server-side reward settlement |
| Finance | Cost/usage and credit transactions | Finance & Analytics | Build read-only reporting first |
| Audit | Admin audit and domain-specific audit tables | Audit & Security | Aggregate views without deleting source logs |
| Storage | `admin-storage` Edge Function and Supabase Storage | Storage | Reuse authenticated endpoint |
| HIMS | HIMS screens, RPCs, activation and media | Education / HIMS | Preserve contracts and regression suite |
| Custom pages | Custom page tables, version history and RPCs | Customization / Page Builder | Reuse versioning and validation |
| Support/conversations | Conversation and support routes/data | Support | Confirm privacy and scope before exposing tools |
| Integrations | Composio/Tavily status and secret RPCs | Integrations | Reuse server-side secret management |
| Reliability | Health/probe/attempt logs | System Health | Aggregate existing telemetry |
| Image generation | Image model config and generator Edge Function | Media & Generation | Preserve billing and model configuration |

## 13. Recommended implementation sequence

This is a recommendation for a later approved phase; no implementation is started here.

1. Resolve migration numbering duplicates and establish authoritative migration ledger.
2. Freeze a capability/permission matrix for every Admin 3.0.0 module.
3. Define canonical data sources for models, routes, pricing, wallet, subscriptions, rewards and analytics.
4. Establish shared admin shell/navigation and permission-aware route map using existing UI primitives.
5. Consolidate read-only overview and audit views before introducing writes.
6. Migrate provider/model/capability management while preserving legacy compatibility triggers.
7. Migrate routing/Agent operations and retain worker/scheduler contracts.
8. Migrate pricing, wallet, subscriptions and finance with ledger reconciliation and approval controls.
9. Migrate ads/rewards only after server-side verification/idempotency review.
10. Migrate storage, integrations, support and reliability panels by reusing existing RPC/Edge Function contracts.
11. Integrate HIMS as a preserved core module and run all HIMS regression tests.
12. Validate custom page builder and audit coverage.
13. Run complete CI, security review, migration dry run and authenticated smoke tests before any production deployment.

## 14. Blockers and owner decisions

### Blocking technical questions

- Which duplicate migration prefix is already present in the deployed Supabase migration history, and which files have been applied?
- Is `suly_model_registry` the intended canonical model source, or is the transition still in progress?
- Which route-assignment table/RPC is authoritative during the legacy-to-unified transition?
- What is the authoritative wallet balance: account table, profile field, or ledger-derived balance?
- What is the canonical source for reward verification and reward-to-credit settlement?
- Which analytics events and retention rules are approved?
- What is the complete current production RLS/grant state? Repository migrations alone cannot prove deployed state.

### Owner approval required

- Approve Admin 3.0.0 information architecture and navigation grouping.
- Approve canonical model/provider/routing source-of-truth decisions.
- Approve financial ledger and price dimension definitions.
- Approve reward verification policy and analytics scope.
- Approve any schema migration/renaming strategy after migration-history reconciliation.
- Confirm HIMS remains a core, enabled, preserved system.
- Approve production rollout strategy and rollback criteria.

## 15. Files recommended for reuse

- `apps/mobile/src/features/admin/admin-service.ts`
- `apps/mobile/src/features/admin/AdminScreens.tsx`
- `apps/mobile/src/features/admin/HimsAdminScreen.tsx`
- `apps/mobile/src/features/admin/admin-confirm.ts`
- `apps/mobile/src/features/admin/provider-presets.ts`
- `apps/mobile/src/features/admin/GmailModelPickerCard.tsx`
- `apps/mobile/src/features/admin/RouteModelChainsCard.tsx`
- `apps/mobile/src/features/admin/ModelPricingAdminCard.tsx`
- `apps/mobile/src/features/hims/HimsScreen.tsx`
- `apps/mobile/src/features/hims/hims-service.ts`
- `supabase/functions/admin-storage/`
- Existing admin RPCs, RLS policies and SQL regression tests under `supabase/migrations` and `supabase/tests`.

## 16. Audit boundary and completion statement

This report is a repository-source audit, not a live production certification. Any unverified runtime behavior is explicitly left as a verification item. No application code, database schema/data, production settings, branch configuration or existing files were intentionally modified in this phase.

**Phase 0 stops here. Phase 1 has not been started.**
