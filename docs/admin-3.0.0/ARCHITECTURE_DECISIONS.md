# SULY Admin 3.0.0 — Canonical Architecture and Source-of-Truth Decisions

- Repository: `eslammohamedk123450-netizen/smsm-ai`
- Branch: `develop` only
- Inspected HEAD: `79755af4a3cda4f2689befa9a0a29036e743f9f4`
- Planning reference: `docs/ADMIN_3.0.0_PLAN.md`
- Audit reference: `docs/admin-3.0.0/AUDIT_REPORT.md`
- Migration diagnostic: `docs/admin-3.0.0/MIGRATION_HISTORY_DIAGNOSTIC.md`
- Status: **architecture blueprint only — no UI, application code, database, secret, or migration changes**

## 1. Purpose and decision standard

This document translates the repository audit into an implementation blueprint. It distinguishes:

1. **Observed current authority** — what the checked-in runtime actually reads or writes today.
2. **Compatibility projection** — a new or alternate representation kept synchronized with the current source.
3. **Proposed target authority** — a future source that may become canonical only after owner approval, data reconciliation, caller migration, and regression proof.

A table name containing `unified`, `registry`, `ledger`, or `canonical` is not proof that production callers use it. Runtime call sites and SQL write paths take precedence over naming.

## 2. Executive decisions

| Domain | Current observed authority | Proposed target / decision |
|---|---|---|
| Chat model catalog | `ai_models` | Keep as runtime authority until a proven cutover; use `suly_model_registry` as the shared identity projection and future admin catalog candidate. |
| Media model catalog | `suly_media_generation_models` | Keep as media runtime authority; link it to the shared registry by stable provider/service/model identity. |
| Capability evidence | Legacy text/media evidence tables are still runtime-facing; unified capability records are an admin-facing projection with compatibility writes | One evidence contract is the target, but no cutover until chat and media consumers read it and parity tests pass. |
| Model routing | `ai_route_model_assignments` | This remains the actual runtime allowlist. `suly_model_route_assignments` is currently a synchronized mirror. Do not switch the router until its reads and admin writes are migrated together. |
| Provider identity | `ai_providers.id` | Retain as the canonical provider-account identity; provider brand/type is not a unique identity because multiple credential accounts may exist for one adapter. |
| Provider secrets | Supabase Vault; `ai_providers.api_key_vault_id` is a reference only | Keep secrets server-only; never expose decrypted keys to Admin UI. |
| Agent execution | Central `ai-router` Agent loop with durable queue and Brain compatibility adapter | Keep one central orchestration policy. `agent_registry` is supplemental role guidance, not an independent orchestrator. |
| Wallet | `suly_credit_accounts` is the spendable/reserved balance state; `suly_credit_transactions` is the financial event journal; `suly_credit_holds` tracks reservations | Preserve all three as a coordinated wallet contract. Do not replace account balance with a naive sum of transactions without reconciliation. |
| AI usage charging | `suly_credit_pricing` and server-side reserve/finalize RPCs | This is the live credit charge policy, not the AI model price-version table. |
| AI model price book | `ai_model_price_versions` | Versioned cost/selling-price reference; not proven to drive current AI credit settlement. |
| Media price book | `suly_media_model_price_versions` | Versioned reference; image runtime currently reads `suly_media_generation_prices`. Reconcile the two before selecting one. |
| Image runtime price | `suly_media_generation_prices` | Current image-generator price source. |
| Subscription entitlement | `suly_user_subscriptions`, `subscription_plans`, and `suly_effective_subscription_tier()` | Treat subscription history + effective-tier function as entitlement authority; `suly_profiles.subscription_tier` is a denormalized compatibility field. |
| Rewarded ads | Reward claims table exists, but client claiming is paused and authenticated execution of the claim RPC is revoked | No active reward credit issuance should be exposed until server-side AdMob SSV/callback verification is implemented and tested. |
| Audit and analytics | Multiple domain event/financial/audit tables | Aggregate them into reporting views; do not replace source ledgers with a new unverified analytics table. |
| Admin roles | One broad `suly_is_admin()` predicate in observed enforcement | The seven proposed role groups are not implemented as granular RBAC. Require owner-approved role definitions and server-side enforcement before enabling them. |
| HIMS | Existing feature activation, resource and media contracts | Preserve HIMS as a first-class core domain. No retirement or replacement. |

## 3. Models and capability architecture

### 3.1 Chat and media model identity

**Observed sources**

- Chat model runtime catalog: `public.ai_models`.
- Media runtime catalog: `public.suly_media_generation_models`.
- Provider-account identity: `public.ai_providers`.
- Unified identity projection: `public.suly_model_registry`.
- Unified capability rows: `public.suly_model_capabilities`.
- Unified model audit: `public.suly_model_registry_audit`.

The registry migration imports chat rows from `ai_models`, media rows from `suly_media_generation_models`, and additional media evidence/price-only identities as candidates. The unique identity is provider + service type + provider model identifier. The registry carries legacy chat/media IDs and source metadata.

**Actual runtime paths**

- `ai-router` reads enabled models from `ai_models`, provider rows from `ai_providers`, health from `ai_model_health`, and text capability evidence from `ai_model_capability_evidence`.
- `image-generator` reads `suly_media_generation_models`, `suly_media_generation_prices`, and provider state. The inspected request path does not query `suly_model_registry` or `suly_model_capabilities`.
- `ModelRegistryCatalogScreen` and `UnifiedModelCapabilitiesAdminCard` read the unified registry/capability RPCs, then join operational state from legacy chat/media tables.
- Legacy model management screens still read/write `ai_models`; media catalog screens still read/write the media catalog.

**Compatibility behavior**

Migration `20261117120000_unified_model_registry_and_capabilities.sql` installs triggers that:

- Sync `ai_models` insert/update events into `suly_model_registry`.
- Sync `suly_media_generation_models` insert/update events into `suly_model_registry`.
- Sync legacy text capability evidence into unified capabilities.
- Sync legacy media capability evidence into unified capabilities.
- Sync `ai_route_model_assignments` changes into `suly_model_route_assignments`.
- Preserve legacy IDs on the registry rows.

The unified capability save RPC writes unified rows and then mirrors evidence into the legacy text/media evidence tables. This is a dual-write compatibility design, not yet a completed runtime cutover.

**Decision**

- Near term: `ai_models` and `suly_media_generation_models` remain the operational catalogs. `suly_model_registry` is the shared identity projection used by the unified admin catalog.
- Target: one registry identity with service-specific adapters and one capability evidence contract, after all runtime consumers are migrated.
- Do not delete or stop syncing legacy tables until every read/write caller, Edge Function, test, and deployed environment is proven migrated.

### 3.2 Capability review screens and actual evidence authority

Current screens include:

- `ModelCapabilityEvidenceAdminCard`: legacy text capability evidence via `suly_admin_list_model_capability_evidence` and `suly_admin_save_model_capability_evidence`.
- `MediaModelCapabilityEvidenceAdminCard`: legacy media evidence via `suly_admin_list_media_model_capability_evidence` and `suly_admin_save_media_model_capability_evidence`.
- `UnifiedModelCapabilitiesAdminCard`: unified registry evidence via `suly_admin_list_unified_model_capabilities`, `suly_admin_save_unified_model_capability`, and `suly_admin_list_model_registry_audit`.
- `ModelRegistryCatalogScreen`: registry catalog and unified capability summary, with operational status joined from old tables.

Runtime evidence behavior is asymmetric:

- Chat router reads legacy `ai_model_capability_evidence`. Missing evidence is permissive for backward compatibility; explicit unsupported or failed evidence can block the relevant capability.
- The inspected image-generator path does not directly enforce unified capability evidence or the legacy media evidence table. It gates on media model active state, provider active state, allowed tier, supported quality, valid price and provider endpoint.
- The registry migration's comment/target intent must not be mistaken for proof that all media capabilities are runtime-enforced.

**Decision:** keep the three evidence surfaces visible during the transition, but designate one reviewed admin workflow only after the owner approves the cutover. The UI must label evidence source and operational enforcement separately. An approved evidence row must not imply runtime enforcement where no consumer exists.

## 4. Providers and secret boundaries

### 4.1 Provider identity and lifecycle

- `ai_providers.id` is the stable provider-account key used by models and media models.
- `provider_type` maps to an adapter in `supabase/functions/ai-router/providers`; `provider-presets.ts` is designed to mirror those adapters.
- `name` identifies a configured account/key label; multiple accounts can use the same provider type.
- `sync-models` creates/updates provider identity, stores the credential in Vault, discovers models, and inserts missing chat models into `ai_models`.
- Provider lifecycle supports enable/disable and archive/restore snapshots. Archive preserves configuration/history; hard delete can remove the Vault secret and provider row and must be treated as a destructive exception.

### 4.2 Secret write/read boundaries

**Write path**

1. Admin enters a provider key in the protected client UI.
2. `sync-models` validates the caller JWT and checks admin authorization using a user-scoped client.
3. It calls `suly_admin_add_provider`, which upserts the provider and creates/updates a Vault secret.
4. Only the Vault UUID is stored in `ai_providers.api_key_vault_id`.
5. Composio and Tavily use separate admin RPCs that store their credentials in Vault.

**Read path**

- `suly_admin_list_providers()` returns provider metadata without decrypted secrets.
- Authenticated table SELECT on `ai_providers` is revoked.
- `suly_service_get_provider_api_key` is called by server-side Edge Functions using service-role context.
- `ai-router`, `model-health-check`, and `image-generator` retrieve the key server-side and use it for outbound provider calls.
- Composio/Tavily admin screens read configured status, not the secret value.

**Decision**

- Canonical identity: `ai_providers`.
- Canonical secret store: Supabase Vault.
- Client may submit a new secret over the authenticated TLS request, but it must not receive an existing decrypted secret.
- Never put provider keys, Vault secret contents, service-role keys, or secret-bearing payloads in UI responses, audit snapshots, analytics, logs, exports, or Git.
- App IDs and Ad Unit IDs are public integration identifiers, not provider API secrets.

## 5. Routing and Agent architecture

### 5.1 Routing sources

- `ai_router_settings`: operational router knobs (race/fallback timeouts, parallelism, probe settings, task splitting and legacy direct model columns).
- `ai_route_model_assignments`: actual route allowlist read by `ai-router`.
- `suly_model_route_assignments`: unified model-ID mirror keyed by registry identity.
- `suly_admin_list_unified_route_assignments()`: reads the unified mirror but returns legacy chat model IDs for the existing admin surface.
- `suly_admin_save_route_models()`: writes `ai_route_model_assignments`; a compatibility trigger mirrors the change to `suly_model_route_assignments`.
- `suly_model_profiles`: active product/profile capabilities (e.g. web search, multi-step Agent, extended context); runtime reads profile capabilities.
- `suly_model_profile_models`: legacy profile-to-model mapping; the current router explicitly documents that central role routes are authoritative and legacy per-profile model maps are ignored.
- Old planner/summarizer/Gmail model override columns remain in `ai_router_settings` and are read by the router, but migration `20261116030000_quarantine_unverified_models.sql` clears the old overrides and the router uses route allowlists for model eligibility.

**Actual route contract:** the configured role assignment is an allowlist, not merely a preference. Candidate models must also pass model/provider enabled state, health, capabilities, role suitability, profile/plan constraints and routing-group checks. A preferred model can only reorder an already eligible candidate.

**Decision:** current authority remains `ai_route_model_assignments`. `suly_model_route_assignments` is the target candidate, not yet the runtime authority. A cutover must update router reads, admin writes, tests, audit and fallback behavior together.

### 5.2 Central Agent, Brain and queue

- `ai-router` is the central Agent API and owns intent classification, planning, tool selection, model eligibility, tool safety and execution/review loop.
- `agent_registry` is read at runtime by `loadAgentProfiles()`. Profiles provide supplemental role prompts and fallback model ordering; they cannot override central policies, tools, user authorization, model eligibility or budgets.
- `agent_registry` is also directly edited by admin service methods under admin RLS.
- `brain-router` is an intake, usage reservation/finalization and result-persistence compatibility adapter for queued Brain tasks. The old synchronous Brain route is disabled (410).
- `agent_task_jobs` is the durable queue. Current scheduler/worker handlers accept `brain_task`; generic job handler registration is not complete.
- Scheduler uses a verified scheduler token; worker requests validate a user JWT or internal service identity.
- Queue claim/heartbeat/finish are database RPC contracts with worker leases and bounded retries.
- Queued-task cancellation is atomic and owner-checked. Running-task cooperative cancellation/partial usage settlement is not yet fully proven.
- Terminal usage settlement reads provider-confirmed step usage and finalizes credit holds through server-side settlement code.
- Legacy Brain catalog tables (`models`, `capabilities`, `model_capabilities`, `brain_tiers`, `plans`) and `BrainSystemAdminScreen` remain. The queued central Agent path does not use the old Brain tier/model catalog for model selection.

**Decision:** one central Agent policy, one bounded worker execution layer, and one usage settlement contract. Do not treat Brain as a second orchestrator. Keep legacy Brain admin only for compatibility until the owner approves its retirement after data/caller proof.

## 6. Pricing, wallet and subscription boundaries

These are separate economic domains and must not be collapsed into one generic “price” field.

### 6.1 AI model price versions

- Table: `ai_model_price_versions`.
- Identity: chat `ai_models.id`.
- Stores versioned provider input/output cost and selling input/output EGP rates, markup and effective time.
- Admin reads current versions and writes through `suly_admin_set_ai_model_price` with expected-version conflict protection.
- Migration comments explicitly say this catalog does not alter credit settlement until credit value is configured.
- No direct read of this table was found in the inspected `ai-router` model-selection/credit settlement path.

**Decision:** retain as a versioned cost/selling price book. Do not call it the live credit charging engine.

### 6.2 Media price versions versus live media prices

Two separate structures exist:

1. `suly_media_model_price_versions`: versioned provider/service/model price reference, read by Admin and updated through `suly_admin_set_media_model_price`.
2. `suly_media_generation_prices`: quality-specific live image-generation price rows, including `price_credits`, estimated provider USD cost, target margin, credit value EGP, FX rate, resolution, enabled state and `price_version`.

The image-generation Admin screen writes the live media model and quality-price catalog. `image-generator` reads `suly_media_generation_prices` to validate the enabled price, reserve Credits, and record price version. The inspected image runtime does not query `suly_media_model_price_versions`.

**Decision:** do not merge these tables by name alone. Owner must decide whether the versioned media price book should become the source that generates/versions the runtime quality-price rows, or remain a reference/finance layer.

### 6.3 Credit pricing and wallet

- `suly_credit_pricing`: global credit charging controls, input/output credit rates per 1K tokens, minimum request credits, negative-balance limit, optional EGP value and USD/EGP conversion.
- `suly_credit_accounts`: per-user current spendable balance and reserved balance.
- `suly_credit_holds`: per-task reservation state.
- `suly_credit_transactions`: transaction/event journal with deltas, post-event balances, source/reason and usage metadata.
- `reserve_credits` and `finalize_credits` are service-role-only and update account/hold state while writing transaction rows.
- `suly_admin_adjust_credits` is admin-gated, requires a reason and idempotency request ID, and writes audit data.
- Daily allowance, welcome grant, rewarded-claim legacy code and other service paths also write account state and transaction rows.
- Client credit presentation reads `suly_credit_accounts.balance` and recent `suly_credit_transactions`.
- Legacy `profiles.credit_balance` and old `credit_transactions` belong to the initial schema. Current Admin service and wallet service use the `suly_*` wallet tables instead. Do not treat the legacy balance column as current wallet authority.

**Decision:** `suly_credit_accounts` is the current operational balance authority; `suly_credit_transactions` is the auditable movement journal; `suly_credit_holds` is reservation state. No report should recompute the live balance from journal rows until every historical grant, adjustment, hold, settlement and repair path has been reconciled.

### 6.4 Subscription plans and profile entitlements

- `subscription_plans` stores plan pricing and credit/request limits.
- `subscription_plan_features` stores descriptive plan features.
- `suly_user_subscriptions` stores active/replaced/expired subscription history and payment references.
- `suly_effective_subscription_tier()` is used by runtime to resolve the effective tier.
- `suly_profiles.subscription_tier` is updated by subscription activation/grant RPCs and acts as a compatibility/cache field.
- `suly_model_profiles` are product model capability profiles, distinct from paid subscription records.
- Legacy Brain `plans` are a separate, older domain and should not be confused with `subscription_plans`.

**Decision:** subscription ledger + effective-tier function are the entitlement authority. Keep profile tier as a derived compatibility field until verified safe to retire.

## 7. Ads and rewarded-credit integrity

- Public AdMob identifiers are stored in `system_settings` and are readable by the authenticated app under a narrowly scoped policy. Admin UI updates the App ID and rewarded/banner unit IDs.
- The reward client component contains `REWARDED_ADS_PAUSED = true`.
- Migration `042_security_hardening.sql` revokes authenticated execution of `claim_rewarded_ad(uuid)`.
- The original reward claim table has a unique `reward_id` primary key and a daily user limit, so it has duplicate-event protection at the database row level.
- However, the original claim RPC accepts a client-supplied UUID; the repository's inspected Edge Function inventory contains no AdMob SSV callback/verification endpoint that proves the provider actually rewarded the user.
- Therefore deduplication alone does not make a client-generated reward ID trustworthy. The UI remains paused and authenticated users cannot invoke the legacy claim RPC.

**Decision:** Ads Operations may manage public IDs/configuration, but no reward amount, campaign, or credit payout may be enabled until the owner approves a server-side SSV/callback design, event verification, replay protection, daily limits and wallet integration. Failed or unverified views must not mint credits.

## 8. Analytics, financial records and audit

Observed source records are domain-specific:

- `suly_ai_request_events`: AI request outcome events recorded by `ai-router`.
- `ai_model_attempt_logs`: provider/model attempts, latency/status and failure details.
- `ai_model_health`, `ai_model_probe_state`, `ai_model_probe_logs`: operational health and scheduled/manual probe state.
- `suly_credit_transactions`, `suly_credit_holds`, `agent_step_usage`: user credit movements, reservations and Agent step usage.
- `suly_company_cost_ledger`: request-level provider cost, user Credits charged, revenue/cost/margin fields and cost confidence/status.
- `suly_media_generation_jobs`: durable media job and billing/recovery state.
- `admin_audit_logs`: administrative changes, before/after values and actor; trigger capture is installed for selected admin-managed tables.
- `suly_model_registry_audit`: unified capability and mirrored route change history.
- `suly_friction_events` and `suly_message_feedback`: privacy-minimized product friction and user feedback; admin RPCs return aggregates, not raw friction rows.

**Decision:** reporting must preserve provenance and distinguish confirmed provider costs from estimates/unknown costs. Do not equate credit value with recognized revenue or unspent Credits with profit. No complete analytics warehouse or repository-wide retention policy was established by the inspected sources; retention periods and deletion/archival rules require owner and privacy review.

## 9. Other existing admin domains

- Storage: `admin-storage` verifies JWT and admin predicate, then uses service-role Storage APIs to list buckets/objects. The current screen is read-only; no delete, public-policy, or public-link controls are present.
- Composio: status and credential setting RPCs; secret stored in Vault. Integration execution is through `composito-integration`.
- Tavily: status and key-setting RPCs; secret stored in Vault; runtime search adapter is shared by Agent tools.
- Support: `suly_support_tickets`, `suly_support_replies`, and support-linked `global_media_assets`; owner/admin RLS and admin service operations handle ticket state/replies.
- Conversations: admin service reads `suly_conversations` and user profile metadata with paging/search. Admin read access is RLS-controlled; message content is sensitive and must be permission-minimized.
- Custom Page Builder: `suly_admin_custom_pages` and immutable version rows; validated component/data-source allowlist, no arbitrary SQL/RPC execution, version restore and audit RPCs.
- Friction: `suly_friction_events` are user-owned insert-only events; admin sees daily aggregated counts and distinct user counts through `suly_admin_friction_summary`. Feedback summaries are separate.
- Image generation: `image-generator` verifies user, ban state, effective subscription, model/provider/quality/price, reserves Credits, reads provider secret server-side, writes asset/job/cost records and settles credits. Admin model/price catalog remains separate from the chat model catalog.
- Model health/circuit breaker: `model-health-check` supports admin manual probes and scheduled secret-authenticated probes; runtime health restriction state is read by `ai-router`.
- Users/access: `suly_profiles` and `suly_credit_accounts` feed the user admin screen; ban changes use `suly_admin_set_user_banned`; subscription grants use a separate RPC. Admin accounts cannot be banned through that RPC.
- HIMS: feature flags, activation code hashes, feature activation records, resources and private media; preserve the existing student and admin flows.

## 10. Permissions decision

The Admin 3.0.0 plan proposes Owner, Super Admin, AI Operations, Finance, Ads Operations, Support and Analyst. The inspected implementation does **not** show these as separately enforced roles.

Observed enforcement is primarily one broad `suly_is_admin()` predicate in RLS policies, admin RPCs and Edge Functions. Some older privileged RPCs additionally reference `suly_admins`. The checked-in migration set inspected here did not provide a verifiable seven-role permission map or a complete role-definition contract. UI navigation visibility is not authorization.

**Decision:** do not assign the proposed roles in the client or simulate them with hidden menu items. Before role-based UI rollout, the owner must approve a server-side RBAC model with explicit role assignment, scope, deny-by-default permissions, protected owner-only operations, audit, and tests for direct RPC/table/Edge Function calls.

## 11. Migration and compatibility constraints

The migration diagnostic identifies six duplicate local version groups and a remote ledger/local inventory reconciliation gap. It confirms remote migration-ledger access but does not prove live schema equivalence.

Consequences:

- No migration rename, delete, reorder, squash, repair or apply is authorized by this blueprint.
- Any future schema change must be forward-only and separately reviewed after a complete local-to-remote reconciliation.
- Keep existing compatibility triggers until all consumers and deployed state are proven migrated.
- Do not remove HIMS, old chat/media catalog tables, wallet history, or legacy Brain structures as incidental cleanup.
- The blueprint itself changes documentation only.

## 12. Required owner decisions before implementation

1. Confirm the intended remote Supabase project and approve a full schema/policy/role inspection before any schema change.
2. Approve the model-registry cutover sequence: shared identity first, then capability reads/writes, then routing, then media enforcement; or retain compatibility projection longer.
3. Approve which capability evidence statuses are required for each runtime surface and whether media generation must hard-block without SULY test evidence.
4. Approve route assignment target table and compatibility window; current runtime remains on `ai_route_model_assignments`.
5. Approve legacy Brain admin retirement or an explicitly bounded compatibility period.
6. Decide the relationship between `suly_media_model_price_versions` and `suly_media_generation_prices`.
7. Approve financial definitions: confirmed vs estimated cost, revenue recognition, Credit valuation, FX source, margin basis and reconciliation process.
8. Approve AdMob SSV integration, reward amounts/limits/campaign policy and whether rewards remain paused until then.
9. Approve analytics retention, privacy and access policy.
10. Approve Owner/Super Admin/AI Operations/Finance/Ads Operations/Support/Analyst role capabilities and any approval workflow for sensitive changes.
11. Confirm HIMS ownership, retention, activation and content-management requirements; preserve current behavior by default.

## 13. Explicitly not done

- No UI redesign or implementation.
- No TypeScript, Edge Function, SQL, migration, configuration or secret changes.
- No database query or mutation.
- No production access or deployment.
- No test/CI execution.
- No branch creation or change; all repository reads were pinned to `develop`.

---

**Architecture status:** evidence-based blueprint created; implementation decisions that need owner approval remain open.
