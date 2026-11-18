# SULY Admin 3.0.0 — Capability Mapping

- Repository: `eslammohamedk123450-netizen/smsm-ai`
- Branch: `develop` only
- Inspected HEAD: `79755af4a3cda4f2689befa9a0a29036e743f9f4`
- Companion decision record: `docs/admin-3.0.0/ARCHITECTURE_DECISIONS.md`
- Status: **read-only capability map; no implementation or database changes**

## 1. How to read this map

- **Current read source** is the table/RPC/Edge Function the checked-in screen or runtime actually reads.
- **Current write source** is the table/RPC/Edge Function that currently persists the action.
- **Backend authorization** describes observed RLS, SQL function guards/grants, or Edge Function checks. A client-side `requireAdmin()` call is not treated as the security boundary.
- **Proposed canonical source** is a target recommendation, not a claim that the target is already active.
- **Compatibility requirement** records what must remain until all callers are migrated.
- **Tests required** includes existing regression files and additional coverage needed for a complete Admin 3.0.0 acceptance test.
- **Owner decision** is explicit wherever the repository does not settle product, financial, security or migration policy.

## 2. Models and capabilities

### 2.1 Model identity and catalog

| Model type | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Chat/text models | `ai_models`, provider relation, operational controls | `ai-router` reads enabled `ai_models`; Admin catalog reads `ai_models` and provider/health data | Admin model screens and `adminService.updateModel()` write `ai_models`; `sync-models` inserts/upserts discovered models | RLS and table grants; admin service precheck; protected admin RPCs for sensitive changes; provider/model security policies | `ai_providers`, route assignments, health, price versions, capability evidence, profile entitlements | `suly_model_registry` as common identity with legacy chat ID retained until runtime migration |
| Image/video/audio model catalog | `suly_media_generation_models` | Media Admin screens and `image-generator` read the media table | Admin media catalog save RPC/direct approved path; media model admin screen | RLS/admin policies and server-side service-role runtime | `ai_providers`, `suly_media_generation_prices`, media evidence, media jobs, private Storage | `suly_model_registry` as common identity; retain service-specific configuration in a media execution table |
| Unified identity | `suly_model_registry` with `legacy_chat_model_id` and `legacy_media_model_id` | `suly_admin_list_unified_model_capabilities()`, `ModelRegistryCatalogScreen`, `UnifiedModelCapabilitiesAdminCard` | Registry compatibility triggers from chat/media catalogs; no direct generic registry CRUD surface observed | RLS; authenticated table privileges revoked; admin RPCs with `suly_is_admin()` | Both legacy catalogs, providers, evidence, route mirrors | Candidate canonical identity, not yet the runtime catalog |

**Actual runtime distinction**

- `ai-router` loads chat candidates from `ai_models`.
- `image-generator` loads image candidates from `suly_media_generation_models`.
- The registry migration imports both and keeps legacy IDs.
- No evidence was found that chat or image runtime resolves model execution directly from `suly_model_registry`.

### 2.2 Capability evidence and review

| Surface | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Legacy text evidence | `ai_model_capability_evidence`; `ModelCapabilityEvidenceAdminCard` and legacy review route | `suly_admin_list_model_capability_evidence`; `ai-router` reads rows for enabled chat models | `suly_admin_save_model_capability_evidence`; provider probe can update evidence | Admin RPC checks and explicit execute grants; router reads server-side | `ai_models`, health probes, vendor/provider/SULY test evidence | Migrate evidence to `suly_model_capabilities` after runtime reader migration |
| Legacy media evidence | `suly_media_model_capability_evidence`; `MediaModelCapabilityEvidenceAdminCard` | Media review RPC; unified registry migration imports it | Legacy media evidence save RPC; unified capability save mirrors to this table | Admin RPC checks and grants | Media catalog, provider/service/model identity, evidence links | `suly_model_capabilities` after media runtime enforcement is implemented |
| Unified evidence | `suly_model_capabilities` | Unified capability list RPC and registry admin screens | `suly_admin_save_unified_model_capability`; it mirrors evidence to legacy tables | `suly_is_admin()`, RLS, table grants revoked to client, admin RPC execute grants | Registry identity, provider evidence, SULY tests, registry audit | Target shared evidence contract |
| Capability audit | `suly_model_registry_audit` | `suly_admin_list_model_registry_audit()` | Unified capability save and route compatibility trigger | Admin-only read RPC; writes occur in privileged functions/triggers | Registry and capability state | Retain as domain audit; link into unified audit search |

**Runtime enforcement gap:** the chat router reads legacy text evidence. The inspected image-generator path does not read unified or legacy media capability evidence; it checks active model/provider, tier, supported quality, configured price and endpoint safety. Therefore a “passed” media evidence badge is not proof that runtime is enforcing that evidence.

**Dependencies and compatibility requirements**

- Preserve `suly_sync_chat_model_registry`, `suly_sync_media_model_registry`, `suly_sync_chat_capability_registry`, and `suly_sync_media_capability_registry` until all old and new readers/writers are enumerated.
- Keep unknown/missing evidence behavior explicit; do not silently convert unknown into approved.
- A capability must be tied to exact provider + service + model identity, not a generic provider name.
- Connector permissions (Gmail/Drive/GitHub) must remain separate from native model modality claims.

**Tests required**

- Existing: `unified_model_registry_regression.sql`, `unified_model_capability_list_return_type_regression.sql`, `model_consumption_admin_policy_regression.sql`, `profile_and_model_health_security_regression.sql`.
- Add: runtime contract tests proving each capability gate is consumed by chat, Agent, media and connector execution; legacy/unified dual-write parity; trigger update/delete behavior; rejected/unknown/failed evidence behavior; audit actor/before/after integrity.

**Owner decision:** approve the final evidence status model and define which capabilities require provider test, SULY integration test, or both before activation.

## 3. Providers and secrets

| Capability | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Provider identity/catalog | `ai_providers`; `provider-presets.ts`; Providers Admin screen | `suly_admin_list_providers()`, `suly_admin_list_archived_providers()`; router reads provider metadata | `sync-models` + `suly_admin_add_provider`; provider update/lifecycle RPCs | Edge Function validates user JWT and admin predicate; provider table client SELECT revoked; lifecycle RPCs check admin | Provider adapter, Vault, models, health, snapshots | `ai_providers` |
| Provider discovery/sync | `sync-models` | Provider discovery API; existing `ai_models` rows | Inserts missing `ai_models` rows; updates provider test/discovery status | Valid user JWT + admin check; service-role server client | Provider preset adapter, endpoint validation, Vault | Keep as the only chat provider onboarding workflow until media onboarding is separately governed |
| Provider lifecycle | Enable/disable, archive/restore, hard delete | Active and archived provider RPCs; lifecycle snapshots | `suly_admin_set_provider_lifecycle_v2`, enable/restore/delete RPCs | SECURITY DEFINER admin checks and explicit grants | Models, route assignments, snapshots, secret deletion | Soft archive/restore as normal lifecycle; hard delete only as approved exceptional action |
| Provider API key | Vault secret referenced by `ai_providers.api_key_vault_id` | Server-only `suly_service_get_provider_api_key`; Admin sees configured/status metadata | `suly_admin_add_provider` and `suly_admin_update_provider` via `sync-models` or RPC | Server-side admin check; Vault operations inside privileged RPC; authenticated SELECT on provider table revoked | Vault extension/schema, adapter endpoint, provider lifecycle | Supabase Vault |
| Composio credential | Separate Composio settings/Vault record | `suly_admin_composio_status()` | `suly_admin_set_composio_api_key()` | Admin RPC with server-side check; runtime integration Edge Function uses server secret | Composio integration/session tools | Vault; separate from AI provider key rows |
| Tavily credential | Separate Tavily settings/Vault record | `suly_admin_tavily_status()` | `suly_admin_set_tavily_api_key()` | Admin RPC; runtime tool uses server-side secret | Tavily shared adapter and Agent tool registry | Vault; separate integration secret |

**Secret boundary:** a newly entered secret necessarily passes from the authorized administrator's client to an authenticated server endpoint/RPC, but existing decrypted secrets are not returned to the client. Admin screens clear the input after save and display only configured status. The server-role secret retrieval RPC is for Edge Functions, not the browser/app.

**Tests required**

- Existing: `admin_provider_rpc_privilege_regression.sql`, `provider_secret_access_regression.sql`, `provider_archive_restore_regression.sql`.
- Add: prove list/detail/status APIs never return secret values or Vault contents; direct authenticated table reads are denied; invalid/expired JWTs fail; provider lifecycle cannot orphan/reveal credentials; secret redaction in logs and audit payloads.

**Owner decision:** confirm whether provider account names and credential lifecycle are managed by AI Operations or a narrower Provider Admin permission. Do not expose a generic secret-reveal action.

## 4. Routing and Agents

### 4.1 Routing contract

| Capability | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Router policy settings | `ai_router_settings` | `ai-router` reads race/fallback/probe/task-split settings; Admin overview reads same row | Admin service updates allowed setting columns; legacy direct model override columns also exist | RLS and admin policy; settings updates should be validated and audited | Health, provider/model availability, route assignments | Keep `ai_router_settings` for operational policy only; move model identity/route membership out |
| Chat/Agent role routes | `ai_route_model_assignments` | `ai-router` reads this table directly; admin list RPC reads unified mirror then returns legacy IDs | `suly_admin_save_route_models()` deletes/reinserts rows in `ai_route_model_assignments` | RPC is admin-gated and execute is granted to authenticated; direct writes are revoked | `ai_models`, route roles, model eligibility | `suly_model_route_assignments` only after router read cutover and ID contract change |
| Unified route mirror | `suly_model_route_assignments` | Admin list RPC joins registry and maps back to legacy chat model IDs | Trigger mirrors `ai_route_model_assignments` insert/update/delete | RLS admin policy; direct authenticated table privileges revoked | Registry chat identity and legacy route table | Target route relation; currently not independent authority |
| Product model profiles | `suly_model_profiles`, `suly_model_profile_models` | Runtime reads profile capabilities; legacy model map is explicitly ignored by router | Admin profile screen writes profile metadata/capabilities; old model mapping remains displayed as reference | RLS/admin controls; verify effective write grants before redesign | Subscription tier/effective tier and router | Keep entitlement/capability profile distinct from model route allowlist |
| Legacy Brain routing | `models`, `model_capabilities`, `brain_tiers`, `plans` | Brain admin screen reads them; queued central worker does not use them for model selection | Brain admin screen directly writes legacy Brain catalog/tier/plan rows | RLS admin policies | Legacy Brain tables and compatibility paths | Retain read-only/compatibility only until all legacy callers and records are retired |

**Observed router rule:** the central route allowlist filters candidates; it is not just a display priority. Model eligibility also checks enabled model/provider, health restriction, required capability, task role and profile constraints. Subscription profiles control product entitlements and budgets; they do not independently authorize an otherwise ineligible model.

### 4.2 Agent and queue

| Capability | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Central Agent | `ai-router/agent/orchestrator.ts`, loop, executor, tool registry | Server-side Agent code; model/provider/route/health/evidence tables | Server Edge Function; assistant messages and request events are written server-side | User JWT validation; service-role internal worker identity; tool-level permission/confirmation gates | Models, route allowlists, connectors, usage, memory | Central Agent remains the only orchestration authority |
| Agent role profiles | `agent_registry`, `AgentRoleProfilesAdminCard` | Runtime `loadAgentProfiles()` reads active rows | Admin service inserts/updates/deletes rows | RLS admin read/write; admin client precheck | Agent role policy, eligible model pool | Supplemental prompts/fallback ranking only; not a permission source |
| Durable task queue | `agent_task_jobs`, scheduler and worker | Brain intake, scheduler claim RPC, worker claim/lease RPC | Server Edge Functions and service-role queue operations | Scheduler token verification; user JWT or internal service identity; owner-checked RPCs | Brain context/steps, task idempotency, worker leases | `agent_task_jobs` for durable queue until generic job handlers are implemented |
| Brain compatibility | `brain-router`, `brain_task_contexts`, `brain_task_steps`, `brain_usage_daily/events` | User task status/result reads and server adapter | Brain intake reserves/finalizes usage and persists results; central Agent does execution | User JWT ownership checks; service-role internal worker checks | Central Agent, queue, wallet holds and settlement | Keep as compatibility adapter until mobile status/results no longer depend on it |
| Cancellation and settlement | Atomic queued cancellation, worker leases, step usage and terminal settlement | Task state RPCs and usage tables | Owner-checked queued cancellation RPC; scheduler/worker settlement service | Service-role and owner-checked RPCs | Holds, step usage, queue status and retries | One idempotent task/usage settlement contract |
| Tool execution | Registered tools and connector execution | Server tool registry and linked connector records | Edge Function tool execution; write-effect tools require approval | User/session connector authorization plus tool policy | Composio, Tavily, GitHub and other connectors | Tool registry and per-tool authorization; never infer access from model capability |

**Current limitations:** scheduler/worker support is still specific to `brain_task`; generic handler registration is incomplete. Queued cancellation is implemented, while cooperative running-task cancellation and partial usage settlement remain unproven end-to-end.

**Tests required**

- Existing: `agent_task_queue_regression.sql`, `agent_task_cancellation_lease_race_regression.sql`, `agent_task_exact_usage_settlement_regression.sql`, `agent_step_usage_ledger_regression.sql`, `agent_terminal_usage_sweep_regression.sql`, `agent_worker_fencing_and_tool_checkpoint_regression.sql`, `brain_usage_partial_cancellation_regression.sql`, `route_model_admin_access_regression.sql`.
- Add: real authenticated user task end-to-end; generic job type rejection/registration; running cancellation and provider abort; duplicate enqueue/settlement; worker crash/reclaim; role prompt cannot override policy; no unauthorized connector action.

**Owner decision:** approve the retirement boundary for Brain legacy admin configuration and whether generic task handlers are in scope for Admin 3.0.0 or a later Agent phase.

## 5. Pricing, wallet and subscriptions

| Domain | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| Chat model price versions | `ai_model_price_versions` | Admin model pricing card/service reads current version per `ai_models.id` | `suly_admin_set_ai_model_price` with expected version | Admin RPC, optimistic version conflict and audit | Chat model identity, provider cost, FX, selling price | Versioned model price book; not live Credit settlement until proven |
| Media model price versions | `suly_media_model_price_versions` | Admin price-version service/card | `suly_admin_set_media_model_price` | Admin RPC with expected version/audit | Provider/service/model identity and currency | Versioned media cost/selling reference |
| Live image quality prices | `suly_media_generation_prices` | Media Admin screen and `image-generator` | Media model admin save flow / guarded RPC | Admin RLS/RPC; Edge Function uses service role | Media model, quality, estimated cost, Credit value, FX, target margin | Current image-generation charge/price source until approved replacement |
| Credit charging policy | `suly_credit_pricing` | `ai-router`, Admin credit controls | `suly_admin_update_credit_pricing`, `suly_admin_update_credit_finance_controls`, negative-balance RPC | Admin-gated RPC; service-only reserve/finalize | Token usage, provider usage, wallet account | One global AI Credit charging policy, distinct from provider price books |
| Wallet balance and holds | `suly_credit_accounts`, `suly_credit_holds` | Client credit service, Admin users and server reservation/settlement | Server-only `reserve_credits`/`finalize_credits`; admin adjustment RPC; daily/welcome grant functions | RLS owner/admin read; service-role mutation; admin-only adjustment | Transactions, task IDs, user IDs, limits | Preserve operational balance + hold state |
| Credit event journal | `suly_credit_transactions` | Wallet service, Admin credit and finance views | Every approved grant/adjustment/reservation/settlement path | Owner/admin read; server/service/admin RPC write | Accounts, holds, idempotency, usage | Financial movement journal; reconcile before treating as independently recomputable balance |
| Company cost | `suly_company_cost_ledger` | Finance overview card; request/media server writes | `ai-router`, media generator, service cost RPC | Admin read policy; service-role write | Provider-reported/estimated cost, FX, Credit valuation, revenue | Request-level provider cost/revenue evidence; preserve cost status |
| Subscription plan catalog | `subscription_plans`, `subscription_plan_features` | Admin pricing/user screens and effective-tier logic | Admin service direct plan/feature updates; subscription grant RPC | Admin RLS; subscription RPCs with admin/service role | Prices, credits, limits, feature entitlements | Product plan catalog |
| Subscription history | `suly_user_subscriptions` | `suly_effective_subscription_tier()`, user entitlement checks | Service activation RPC and admin grant RPC | RLS owner/admin read; service-only payment activation; admin-only manual grant | Plan IDs, payment references, expiry, profile cache | Subscription entitlement history |
| Legacy profile balance | `profiles.credit_balance` | No current wallet/admin service read identified | Legacy initial schema/RPC paths | Old RLS and profile guard migration | Old `credit_transactions` | Do not use as wallet authority; retire only after full caller/history check |
| Legacy Brain plan catalog | `plans`, `brain_tiers` | Legacy Brain admin screen | Legacy Brain admin screen | Admin RLS | Legacy Brain status and plan config | Compatibility only; not subscription billing authority |

**Required reporting separation**

- Provider operating cost (confirmed, estimated, unknown).
- User Credits reserved, consumed, released or adjusted.
- Credit valuation and FX source.
- Subscription price/revenue and active entitlement.
- Media price per generation quality.
- Gross contribution only when required inputs are known.
- Unspent Credits must not be represented as recognized profit.

**Tests required**

- Existing: `ai_model_price_versions_regression.sql`, `suly_media_model_price_versions_regression.sql`, `model_price_admin_access_regression.sql`, `text_model_source_price_reconciliation.sql`, `media_model_admin_atomic_save_regression.sql`, `agent_task_exact_usage_settlement_regression.sql`, `agent_step_usage_ledger_regression.sql`.
- Add: account balance/transaction/hold reconciliation; duplicate admin adjustment; daily grant idempotency; overage/negative-balance limits; media price version versus live price parity; subscription expiry/replacement and effective-tier consistency; unknown provider cost must not become zero-cost profit.

**Owner decision:** approve the accounting policy, Credit valuation, FX source, revenue recognition, provider invoice reconciliation and the relationship between versioned media prices and live generation prices.

## 6. Ads and rewards

| Capability | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source |
|---|---|---|---|---|---|---|
| AdMob IDs | `system_settings` keys for App ID and rewarded/banner unit IDs | Client ads config and Admin settings screen | Admin service upserts public identifiers | RLS permits limited public identifier reads; admin policy for changes | Platform-specific app/ad-unit configuration | Platform-aware AdMob configuration records; keep IDs separate from secrets |
| Rewarded ad playback | `RewardAdButton` using Google Mobile Ads SDK | Client component loads ad unit config | Client SDK reports earned reward; component is hard-paused | No trusted provider callback path identified | Ad SDK, app IDs, ad unit IDs | Provider callback/SSV-verified event |
| Reward claim | `suly_rewarded_ad_claims`, `claim_rewarded_ad(uuid)` | No current active client reward flow | Legacy RPC originally accepted client reward UUID; authenticated execute revoked by security hardening | Authenticated execute revoked; table is service-role only | Wallet account and transaction ledger | Server-verified reward event with idempotency key |
| Reward accounting | Legacy claim RPC would add Credits and insert transaction | Wallet account/transaction | Legacy claim RPC only; currently unavailable to client | RPC grant revoked for authenticated | Canonical wallet tables | Same `suly_credit_accounts`/`suly_credit_transactions` wallet contract |

**Current status:** reward client is explicitly paused. The claim table primary key prevents duplicate UUID rows, but it does not prove the ad provider actually rewarded the user. No AdMob SSV callback/verification Edge Function was found in the inspected function inventory.

**Tests required:** valid SSV signature; invalid/missing signature; duplicate provider event; replayed callback; event/user/ad-unit binding; daily cap/cooldown; no reward on skipped/failed ad; wallet transaction idempotency; test-vs-production ad unit isolation.

**Owner decision:** keep reward payouts disabled until the SSV architecture, reward amount, user limits, campaign rules, consent and provider analytics/revenue handling are approved.

## 7. Analytics and audit

| Source | Current purpose/read path | Current write path | Authorization and limitations | Proposed reporting use |
|---|---|---|---|---|
| `suly_ai_request_events` | AI request outcomes; Admin dashboard/operations | `ai-router` records request event | Service-side writes; user/admin read policy depends on table policies | Request volume, success/error and route summary |
| `ai_model_attempt_logs` | Model attempts, errors and latency; model operations/dashboard | `ai-router` provider attempt path | Service-side operational records; Admin reads with query filters | Model reliability and fallback metrics |
| `ai_model_health` | Current model restriction/health state | Probe/health RPCs | Admin/service controls | Current circuit-breaker state |
| `ai_model_probe_state`, `ai_model_probe_logs` | Scheduled/manual probe cadence and results | `model-health-check` and probe RPC | Manual run requires user JWT + admin predicate; scheduled run uses Vault-backed secret | Probe trend, latency and recovery |
| `suly_credit_transactions`, `suly_credit_holds` | Credit movement and reservation | Server and admin RPCs | Owner/admin read, privileged writes | Wallet, usage and settlement reports |
| `suly_company_cost_ledger` | Provider cost, Credit charge, revenue/cost/margin snapshot | Server-side request/media cost recording | Admin read; service-role writes | Cost/revenue report with confirmed/estimated/unknown status |
| `suly_media_generation_jobs` | Durable generation job, provider cost and charged Credits | Image generator and recovery function | Owner/admin read; service-role writes | Media job success, recovery and billing |
| `admin_audit_logs` | Admin action, target, before/after values | Admin RPCs and selected-table audit trigger | Admin read; privileged writes | Admin activity and change history |
| `suly_model_registry_audit` | Model capability and route mirror events | Unified capability RPC and route compatibility trigger | Admin-only read RPC | Model governance audit |
| `suly_friction_events` | Product friction events | Authenticated user insert under owner check | Admin receives aggregated summary only | Privacy-minimized friction trends |
| `suly_message_feedback` | Message reactions/ratings | Authenticated owner insert/update | Admin summary RPC omits message content | Feedback quality summary |

**Gaps:** no single canonical analytics event schema or analytics warehouse was established. No repository-wide retention/archival policy was proven. Financial reports must not add unrelated event counts and money amounts into one unqualified KPI.

**Tests required:** aggregation correctness, timezone boundaries, no cross-user detail leakage, audit actor/before/after coverage, retention/deletion behavior, event idempotency, and financial totals reconciled to source ledgers.

**Owner decision:** approve analytics retention, privacy minimization, financial metric definitions and who may access user-level operational details.

## 8. Other existing admin capabilities

| Capability | Existing implementation | Current read source | Current write source | Backend authorization | Dependencies | Proposed canonical source / migration | Tests required | Owner decision |
|---|---|---|---|---|---|---|---|---|
| Storage | `StorageSettingsScreen`, `admin-storage` | Edge Function lists buckets and objects | No delete/public-policy mutation exposed by current screen | Function validates Bearer JWT, calls `suly_is_admin()`, then uses service role; no client service key | Supabase Storage, bucket policy, media assets | Keep server-side read-only storage inventory first; add mutations only as separately approved scoped operations | JWT/admin denial, path traversal, bucket isolation, private object behavior | Whether Storage Admin needs upload/delete/lifecycle tools |
| Composio | `ComposioAdminScreen`, `composito-integration` | Status RPC | Vault credential setter RPC | Admin RPC and server-side integration execution | Vault, user OAuth/session, tool registry | Keep separate connector credential domain; unify navigation only | Secret not returned, invalid key, unauthorized integration action | Which roles can configure integration credentials |
| Tavily | `TavilyAdminScreen`, shared Tavily adapter | Status RPC | Vault credential setter RPC | Admin RPC; Agent tool execution server-side | Vault, Agent search tool | Keep separate integration credential domain | Secret access, tool authorization, query limits | AI Operations vs integration owner |
| Support | `SupportAdminScreen`, support service | `suly_support_tickets`, replies, support-linked assets | Ticket status/priority update; reply insert | RLS owner/admin, admin predicate for update/admin reply | Auth, user attachments, private media | Keep ticket and reply tables; aggregate support view only | Cross-user ticket denial, admin reply check, attachment ownership, status transition | Support role visibility and ability to view financial/user details |
| Conversations | `AdminConversationsScreen`, admin service | `suly_conversations` and `suly_profiles` with paging/search | No broad conversation mutation identified in current admin service | Admin RLS read; user ownership policies remain | Messages, profile data, privacy controls | Read-only operational view with sensitive content minimization | Cross-user access, pagination/search, redaction, audit on any future action | Whether support can see full message content |
| Custom Page Builder | `AdminPageBuilderScreen`, `AdminCustomPageScreen` | Custom-page list/version/source RPCs | Save/restore RPCs | Admin-guarded SECURITY DEFINER RPCs; config validator allowlists components/sources and rejects SQL/query/secret fields | Custom page tables, version history, approved data source RPCs | Keep data-driven pages and immutable versions; no arbitrary query execution | Schema validation, XSS/content handling, no arbitrary SQL/RPC, restore audit | Who can publish versus draft pages |
| Friction diagnostics | `FrictionDashboardScreen`, support service | `suly_admin_friction_summary`, `suly_admin_feedback_summary` | User-owned friction/feedback events | User insert owner policy; admin RPC returns privacy-minimized aggregates | Product event instrumentation | Aggregate-only reporting; no raw event feed by default | Aggregation/privacy, owner isolation, event schema validation | Retention and minimum aggregation thresholds |
| Image generation | `MediaGenerationModelsAdminScreen`, `image-generator` | Media models/prices, provider metadata, user tier and wallet | Admin media model/price save; server creates jobs/assets/cost records | User JWT + ban/tier checks; service role for provider key/storage; Credit reservation/finalization RPCs | Vault, provider, media prices, jobs, global assets, Storage | Keep dedicated media execution configuration linked to shared model identity | Price validation, tier access, provider endpoint allowlist, idempotency, settlement/recovery, asset privacy | Supported protocols, model activation evidence and price governance |
| Model health/circuit breaker | `ModelControlCenterScreen`, `model-health-check` | Health, probe state/logs, attempts and router settings | Admin reset/manual test; scheduled probe writes | Manual JWT + `suly_is_admin()`; scheduled Vault secret; server-side service role | Providers, models, Vault, probe RPCs | Keep health state separate from model catalog identity | Unauthorized manual test, secret schedule auth, probe idempotency, auto-restriction recovery | Alert thresholds and who may reset restrictions |
| Users and access | `AdminUsersCommandScreen`, admin service | `suly_profiles`, `suly_credit_accounts`, subscriptions and transactions | Ban/unban RPC, credit adjustment RPC, subscription grant RPC | Broad admin predicate; ban RPC protects admin accounts; financial RPCs require reason/idempotency | Auth, wallet, subscription history, audit | Keep user identity in profiles; role/access must be a separate RBAC system | IDOR, admin-account protection, bulk action partial failure, credit adjustment idempotency | Granular access, owner-only account changes, privacy scope |
| HIMS | `HimsAdminScreen`, student HIMS app and feature backend | Admin code/resource RPCs; student `suly_my_feature_status` and `suly_my_feature_resources` | Activation-code create/enable and resource upsert RPCs; media upload tagged HIMS | Admin predicate for admin RPCs; activation function service-role-only; user feature checks server-side | Feature flags, profile activation fields, code hashes, usage limits, media asset storage | Preserve as a first-class system and keep current student/admin contracts | HIMS activation collision, resource isolation, media privacy, code hash-only, expiry/use limits | HIMS product owner approves content lifecycle and code policy; no silent retirement |

## 9. Permission matrix — proposed roles versus actual enforcement

The current repository does not implement the seven proposed role groups as distinct server-side permissions. The following matrix shows the *desired scope proposal* and the *actual enforcement state* separately.

| Role requested by plan | Intended scope | Existing server-side role enforcement found | Current effective access if the account passes `suly_is_admin()` |
|---|---|---|---|
| Owner | Full access, critical approvals, RBAC and system ownership | No distinct Owner role/approval predicate found | Same broad admin predicate as other admins; no verified Owner-only separation |
| Super Admin | System administration within owner policy | No distinct Super Admin role found | Same broad admin predicate |
| AI Operations | Providers, models, capability evidence, routing, Agent and health | No AI Operations role found | Same broad admin predicate; domain-specific RPC checks may still apply |
| Finance | Prices, wallet, adjustments, cost/revenue reports and reconciliation | No Finance role found | Same broad admin predicate; finance RPCs still use their own admin checks/reasons |
| Ads Operations | AdMob identifiers, ad units, reward campaigns and reward analytics | No Ads Operations role found | Same broad admin predicate; reward payout currently paused |
| Support | Support tickets/replies and minimal user lookup | No Support role found | Same broad admin predicate for admin support actions |
| Analyst | Read-only analytics and reports | No Analyst role found | No read-only analyst restriction; an admin can access broader admin functions |

### Actual enforcement notes

- The protected admin layout calls `suly_is_admin()` before rendering the Admin shell.
- The central admin service also calls `requireAdmin()`.
- RLS and admin RPCs independently use `suly_is_admin()`.
- `admin-storage` verifies the JWT and the admin predicate before using service-role Storage.
- Some older provider credential functions explicitly query `suly_admins`.
- A complete, verified source definition for `suly_is_admin()` and a role hierarchy was not established from the inspected checked-in migration sources. The audit also cautions that the effective live role source/policies were not exhaustively proven.

**No client-only role implementation is acceptable.** Before adding roles, define a server-side permission relation or equivalent authoritative claims with explicit grants, protected owner bootstrap/recovery, no self-escalation, least privilege, audit, and denial tests for direct table/RPC/Edge Function calls.

### Required permission regression coverage

- Every role × every domain action, including read, create, update, delete, export, secret configuration and financial mutation.
- Direct RPC calls bypassing the UI.
- Direct PostgREST table writes bypassing the UI.
- Edge Function calls with valid user JWT but insufficient role.
- Revoked/downgraded admin access and token/session freshness.
- Owner protection, no self-promotion, no last-owner lockout.
- Audit record actor and target for all privileged changes.

## 10. Shared cross-domain dependencies

| Shared component | Consumers | Governance rule |
|---|---|---|
| Supabase Auth identity | All admin and user domains | Resolve identity server-side; never trust client-supplied user IDs without ownership checks |
| `suly_is_admin()` | Admin layout, service prechecks, RLS, RPCs and Edge Functions | Replace broad access with granular server RBAC only after owner-approved policy and complete direct-call tests |
| `ai_providers` + Vault | Chat, Agent, media generation, health probes, Composio/Tavily (separate secret records) | Provider metadata may be visible; decrypted credentials remain server-only |
| `ai_models` | Chat/Agent routing, model health, text price references | Do not retire until router, admin, tests and history no longer depend on integer model IDs |
| `suly_model_registry` | Unified admin catalog and capability review | Treat as identity projection until runtime consumers move |
| Wallet tables and RPCs | Chat, Agent, image generation, daily allowance, rewards (currently paused) | Every mutation must be idempotent and produce a corresponding journal record |
| `global_media_assets` + Storage | Chat, HIMS, support, generated media | Keep private object delivery and owner/feature checks |
| `admin_audit_logs` | Admin mutations across domains | Never store secrets or full sensitive payloads in before/after snapshots |
| Migration history | All database-backed domains | No schema work until duplicate-version and remote/local reconciliation is approved |

## 11. Admin navigation mapping

| Target Admin 3.0.0 section | Existing routes/screens to consolidate |
|---|---|
| Overview | `index.tsx`, `AdminDashboardScreen`, finance summary cards |
| AI Models | `models`, `models-catalog`, `models-operations`, `model-capabilities`, `model-capability-review`, registry catalog and unified capability card |
| Providers | `api-keys`, provider presets, provider archive/restore, Composio and Tavily credential settings |
| AI Routing | `agents`, route chains, router settings, profile eligibility |
| Agent Management | Agent role profiles, queue overview, Brain compatibility operations |
| Studio Management | Media catalog, image-generation models/prices, media capability evidence |
| Credits & Wallet | Credit management, credit command, user balance/transactions |
| Pricing & Profit | AI model price versions, media price versions/live generation prices, Credit controls, company cost ledger |
| Plans & Subscriptions | Subscription plans/features/history, model profiles and entitlements |
| Ads & Rewards | AdMob identifiers and paused rewarded-ad flow |
| Analytics & Reports | Request events, attempts, health/probes, finance, audit, friction and feedback aggregates |
| Users & Access | Users, ban/unban, subscription grant, future server RBAC |
| HIMS | Existing HIMS admin and student feature; preserve contracts |
| System & Audit | Storage, custom page builder, audit log, maintenance/feature settings |

## 12. Migration/compatibility prerequisites

1. Resolve the six migration version collisions and reconcile the 170 local files against the 180-row remote ledger. The previous diagnostic explicitly does not certify live schema equivalence.
2. Capture an approved schema/policy/role baseline before any schema-affecting phase.
3. Define canonical source contracts for model identity, capabilities, routing, price books, wallet and subscriptions.
4. Add compatibility reads/writes only where a named caller requires them; avoid creating new unbounded dual-write paths.
5. Migrate one caller family at a time, prove parity, then retire the old path in a separate approved migration.
6. Preserve HIMS, support privacy, private media access, and all financial history.

## 13. Required owner decisions

- Confirm the intended Supabase project and authorize effective schema/RLS/role inspection.
- Approve model registry, capability and route cutover order.
- Decide whether media runtime must enforce provider and SULY capability tests before model activation.
- Decide how versioned media prices feed live generation price rows.
- Approve Credit valuation, FX and financial reporting rules.
- Approve AdMob SSV, reward amounts, limits and campaign policy.
- Approve granular RBAC permissions and owner-only approvals.
- Approve retention and privacy scope for analytics, audit, support and conversation data.
- Confirm HIMS content/code ownership and lifecycle.

## 14. Verification status and non-actions

This document is based on repository source inspection only. It does not certify the effective live database schema, current production grants, current user-role assignments, or runtime behavior in a deployed environment.

Not performed:

- No UI changes.
- No application, SQL, migration, config or secret changes.
- No database reads or writes.
- No migration repair/push/up/down/reset/squash.
- No production deployment.
- No tests or CI workflows executed.
- No role assignments or policy changes.

---

**Capability mapping status:** documented. The next implementation phase must use this map as a blueprint and must not treat proposed target sources as already deployed.
