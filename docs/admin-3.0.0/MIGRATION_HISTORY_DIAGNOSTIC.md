# SULY Admin 3.0.0 — Migration History Diagnostic

- Repository: `eslammohamedk123450-netizen/smsm-ai`
- Branch inspected: `develop` only
- Branch HEAD: `52c109e2190f7ee7545448044083e1735fe5171c`
- Supabase project inspected through the connected account: `razvryvazmqvvqkzetuo` (SULY AI AGNIT, eu-west-1)
- Diagnostic date: 2026-11-18
- Scope: read-only repository inspection plus read-only remote migration-ledger listing
- Result: **migration governance blocker; no migration or database changes made**

## 1. Executive result

The local directory contains **170 SQL migration files**. Six complete numeric version tokens are duplicated:

1. `013` — 2 files
2. `049` — 2 files
3. `050` — 2 files
4. `20261115190000` — 2 files
5. `20261115210000` — 2 files
6. `20261115220000` — 2 files

The first three are legacy three-digit migration identifiers. The other three are full 14-digit timestamp identifiers. Supabase migration versions are the complete numeric prefix before the first underscore; these are real version collisions, not merely similar descriptions.

The connected Supabase project's read-only migration listing returned **180 remote history rows**, with no duplicate remote version values. The six local conflict pairs are represented by distinct remote history entries under distinct remote version values/names. Therefore, none of the twelve local files is a safe deletion candidate based on its filename.

Important limitation: the remote listing is the migration ledger only. It does not prove that every current local file's contents equal the SQL that was historically applied, nor does it verify the live schema object-by-object. The repository/remote name mapping is not one-to-one: there are historical remote entries without a current exact local filename and current local files without an unambiguous matching remote ledger row. Do not infer equivalence from similar names.

**Decision:** freeze migration-file renames/deletions/reordering and all new schema deployment until a reviewed reconciliation maps every local migration to its remote version and verifies schema state. Proceed with Admin work that does not change the database only if it remains within the approved non-schema scope.

## 2. Sources and evidence

Read from `develop`:

- `docs/ADMIN_3.0.0_PLAN.md`
- `docs/admin-3.0.0/AUDIT_REPORT.md`
- Complete Git tree for `supabase/migrations` (170 blobs; tree response was not truncated)
- `supabase/config.toml`
- `.github/workflows/verify-agent-queue.yml`
- `scripts/local-migration-harness.sql`
- `scripts/local-migration-verification.sql`
- `docs/GLOBAL_INFRASTRUCTURE.md`
- SQL regression tests listed in section 7.

The audit report's six-duplicate finding is confirmed, and the exact groups are expanded below.

Remote evidence:

- Connected project list identified project `razvryvazmqvvqkzetuo`, named `SULY AI AGNIT`, status `ACTIVE_HEALTHY`.
- The Supabase read-only `list_migrations` operation returned 180 rows.
- The remote history contains no duplicate `version` values.
- No SQL was executed against the project; no credentials or connection secrets were requested or exposed.

The repository's current `supabase/config.toml` still contains the placeholder `project.id = "your-project-ref"`; this is not evidence of a configured local link. The workflow's Supabase URL points to the same project ref identified by the connected project listing.

## 3. Naming convention and collision classification

For each filename, the migration version token is the entire initial digit sequence before the first underscore:

- `013_global_infrastructure.sql` → version `013`
- `20261115190000_safe_queued_agent_task_cancellation.sql` → version `20261115190000`

Do not truncate a timestamp token to three digits, and do not treat a matching feature name as proof of matching migration contents.

### 3.1 Exact duplicate version groups

| Version token | Conflicting files |
|---|---|
| `013` | `013_global_infrastructure.sql`; `013_upsert_ai_provider_credentials.sql` |
| `049` | `049_composio_vault_credential.sql`; `049_single_use_connector_approval.sql` |
| `050` | `050_cloudinary_vault_config.sql`; `050_tavily_vault_credential.sql` |
| `20261115190000` | `20261115190000_safe_queued_agent_task_cancellation.sql`; `20261115190000_suly_model_profiles_and_subscription_tiers.sql` |
| `20261115210000` | `20261115210000_agent_step_usage_ledger.sql`; `20261115210000_media_generation_provider_registry.sql` |
| `20261115220000` | `20261115220000_media_generation_job_records.sql`; `20261115220000_suly_projects_and_conversation_grouping.sql` |

### 3.2 Prefix collisions, separately

The three-digit legacy groups `013`, `049`, and `050` each collide as complete migration version tokens. The three timestamp groups are separate complete-token duplicates.

There is **no additional collision** caused merely by the first three characters of a timestamp: `202...` is not a valid shortened migration token and must not be used for grouping. No pair with different complete numeric tokens was classified as an exact duplicate.

### 3.3 Contents summary, dependencies and risk for every group

#### Group A — version `013`

**File 1:** `013_global_infrastructure.sql`

- Adds global semantic cache, user task memory, media asset registry and data-driven feature activation structures.
- Creates vector/pgcrypto extensions, tables, indexes, functions and RLS controls.
- Replaces/creates deny-client policies and SECURITY DEFINER RPCs; includes service-role ACLs.
- Contains operational UPDATE/DELETE statements inside function bodies; those bodies are definitions, not proof that those operations ran during migration.
- Dependencies: Supabase auth schema/users, existing profile/admin infrastructure, vector support and extension schema. It is the broad foundational migration for shared feature infrastructure.
- Risk: **HIGH** — extension changes, broad schema creation, RLS/policy and privileged-function definitions.

**File 2:** `013_upsert_ai_provider_credentials.sql`

- Replaces `public.suly_admin_add_provider`; provider records are upserted by unique name and Vault credentials are updated/reused.
- Depends on `public.ai_providers`, Supabase Vault functions/schema and existing admin authorization.
- Risk: **HIGH** — replaces a privileged credential-management RPC and changes provider/Vault write behavior. No table drop was identified in this file.

**Remote ledger evidence:**

- `013_global_infrastructure` → remote version `20261107084437`.
- `upsert_ai_provider_credentials` → remote version `20261107000013`.

**Recommendation:** retain both files unchanged. They are separate migrations with separate remote history identities and different responsibilities. Never discard one because both begin with `013`. Future work must use unique 14-digit timestamp versions and must not rewrite either historical file.

#### Group B — version `049`

**File 1:** `049_composio_vault_credential.sql`

- Creates Composio integration settings metadata and admin/service RPCs for setting, reading status and retrieving the Vault-stored API key.
- Depends on Supabase Vault, `suly_is_admin()`, auth identity and existing Composio integration consumers.
- Risk: **HIGH** — privileged credential access, SECURITY DEFINER functions and explicit privilege revocation/grants.

**File 2:** `049_single_use_connector_approval.sql`

- Adds `connector_approval_consumed` to `suly_ai_requests`.
- Defines a service-role-only function that atomically consumes a connector approval before an external side effect.
- Depends on the `suly_ai_requests` table and connector approval/Agent request lifecycle.
- Risk: **HIGH** — alters request state and idempotency/security behavior used to prevent replayed external actions.

**Remote ledger evidence:**

- `composio_vault_credential` → `20261110205752`.
- `single_use_connector_approval_20261113` → `20261113212638`.

**Recommendation:** retain both unchanged. They are independent schema capabilities and both have distinct remote ledger entries. Do not combine, rename or drop either file as part of Admin 3.0.0.

#### Group C — version `050`

**File 1:** `050_cloudinary_vault_config.sql`

- Creates Cloudinary integration settings metadata and admin/service RPCs for setting/status/retrieving the Vault-stored Cloudinary URL.
- Depends on Supabase Vault, `suly_is_admin()`, auth identity and Cloudinary media delivery.
- Risk: **HIGH** — privileged credential storage/retrieval and SECURITY DEFINER/ACL changes.

**File 2:** `050_tavily_vault_credential.sql`

- Creates Tavily integration settings metadata and admin/service RPCs for setting/status/retrieving the Vault-stored API key.
- Depends on Supabase Vault, `suly_is_admin()`, auth identity and Tavily integration consumers.
- Risk: **HIGH** — privileged credential storage/retrieval and SECURITY DEFINER/ACL changes.

**Remote ledger evidence:**

- `050_cloudinary_vault_config` → `20261111141411`.
- `tavily_vault_credential` → `20261113180547`.

**Recommendation:** retain both unchanged. They are separate provider integrations and both appear in remote history under different versions. Do not treat either as a duplicate implementation of the other.

#### Group D — version `20261115190000`

**File 1:** `20261115190000_safe_queued_agent_task_cancellation.sql`

- Revises allowed status constraints for Agent/Brain task and usage records.
- Replaces usage-finalization and queued-task cancellation functions.
- Implements cancellation semantics for queued work and billing/usage reservation release.
- Depends on the Agent task queue/job tables and Brain usage tables/functions created by earlier queue/Brain migrations.
- Risk: **CRITICAL** — status constraint replacement, billing/usage logic and privileged RPC behavior. Must be tested with worker lease/retry/finalization flows.

**File 2:** `20261115190000_suly_model_profiles_and_subscription_tiers.sql`

- Alters subscription/profile/model tier columns and constraints; backfills existing plan/profile/model values.
- Creates model profile and profile-model mapping tables, seeds records and configures RLS policies.
- Depends on `subscription_plans`, `suly_profiles`, `ai_models`, admin predicate and existing model/plan data.
- Risk: **CRITICAL** — data rewrites/backfills, constraint changes and policy replacement.

**Remote ledger evidence:**

- `safe_queued_agent_task_cancellation` → `20261115185111`.
- `20261115190000_suly_model_profiles_and_subscription_tiers` → `20261115144052`.

**Recommendation:** retain both. Their contents, dependencies and remote versions are distinct. The shared local version is invalid for a clean future migration stream, but the historical files must not be renamed or rewritten in-place. Reconcile their deployed identities and only use forward-only migrations for future corrections.

#### Group E — version `20261115210000`

**File 1:** `20261115210000_agent_step_usage_ledger.sql`

- Adds cancellation metadata to `agent_task_jobs`, creates `agent_step_usage`, and defines service-role usage recording/finalization RPCs.
- Depends on Agent task jobs, task/user identities and credit finalization functions.
- The file comment explicitly describes staged feature-branch work and warns against production application until worker/router integration and regression tests land.
- Risk: **CRITICAL** — billing ledger, idempotency, cancellation accounting and settlement functions.

**File 2:** `20261115210000_media_generation_provider_registry.sql`

- Creates media-generation model and price registries; adds a generation-model reference to the company-cost ledger.
- Configures RLS and admin policies; creates a public-safe model-list RPC.
- Depends on `ai_providers`, `suly_company_cost_ledger`, `global_media_assets`, `suly_profiles`, `suly_is_admin()` and existing credit/model infrastructure.
- Risk: **CRITICAL** — billing/pricing records, foreign keys, RLS/policy replacement and public model visibility.

**Remote ledger evidence:**

- `agent_step_usage_ledger_20261115` → `20261115195827`.
- `20261115210000_media_generation_provider_registry` → `20261115144106`.

**Recommendation:** retain both unchanged. Before any production decision, owner must explicitly resolve the staged-production warning in the Agent ledger file and confirm that deployed worker/router code and tests match the recorded migration. The remote history row alone does not waive that warning.

#### Group F — version `20261115220000`

**File 1:** `20261115220000_media_generation_job_records.sql`

- Creates durable image/video generation job records and indexes.
- Adds RLS and admin read policy; defines user-facing job status and service recovery RPCs.
- Depends on media model registry, global media assets and credit finalization functions.
- Risk: **HIGH/CRITICAL** — durable job state, credit recovery/settlement and RLS policy changes.

**File 2:** `20261115220000_suly_projects_and_conversation_grouping.sql`

- Creates user-owned projects; adds `project_id` to conversations.
- Drops/recreates a composite ownership foreign key and installs project RLS policies.
- Replaces the project timestamp trigger/function.
- Depends on `suly_conversations`, auth users, and existing user identity data.
- Risk: **CRITICAL** — foreign-key replacement, tenant isolation, RLS policy replacement and trigger replacement.

**Remote ledger evidence:**

- `20261115220000_media_generation_job_records` → `20261115144115`.
- `suly_projects_and_conversation_grouping` → `20261115220202`.

**Recommendation:** retain both unchanged. They are independent features with different remote history entries. Do not reorder or merge them based on the duplicated local token.

## 4. Remote history comparison

### 4.1 Verified facts

- Remote project: `razvryvazmqvvqkzetuo`, status `ACTIVE_HEALTHY`.
- Remote migration ledger rows: **180**.
- Local migration files: **170**.
- Duplicate remote version tokens: **0**.
- The six conflicting local groups each have two distinct remote ledger records identified in section 3.
- The local tree has 105 files whose version prefix is 14 digits; 38 of those version strings are exact matches in the remote version column.
- Filename/name matching can associate many additional records, but it is not a safe proof of byte-for-byte or semantic identity. Some names are ambiguous or have changed across local and remote history.

### 4.2 Remote/local reconciliation status

| Item | Result |
|---|---|
| Remote migration ledger reachable read-only | YES |
| Remote version duplicates | None observed |
| All local files proven to map one-to-one to remote versions | NO |
| Live schema compared object-by-object with migration contents | NOT PERFORMED |
| Applied SQL contents/checksums independently verified | NOT AVAILABLE from the listing operation |
| Remote applied status for each of the twelve conflict files | Distinct matching ledger entries are present, as detailed above |
| Safe to rename/delete/reorder conflict files | NO |

The ledger contains 180 records versus 170 current local files. At least 41 remote records did not have a confident one-to-one match under the current filename/name matching method; 30 local files likewise lacked a confident remote filename/name match. These counts are reconciliation indicators, not proof that those migrations are missing or unapplied. Several old migration files have been renamed/re-versioned in repository history, and some remote names preserve older identifiers.

### 4.3 Remote status conclusion

Remote history is **KNOWN at the ledger level**, not UNKNOWN: a connected read-only Supabase project was available and the migration listing succeeded. The live schema state and exact SQL equivalence remain **UNVERIFIED**. Do not label a file unapplied merely because its current local version prefix is absent from the remote version list; do not label it safely applied solely because a similar remote name exists.

## 5. Repository metadata, configuration, CI and scripts

### 5.1 Supabase configuration

`supabase/config.toml` contains local ports and Edge Function JWT settings. Its project id is a placeholder (`your-project-ref`). It does not provide a trustworthy snapshot of remote migration history or an explicit local migration baseline.

### 5.2 CI workflow

`.github/workflows/verify-agent-queue.yml` includes `supabase/migrations/**`, `supabase/tests/**` and `supabase/config.toml` in relevant path filters. Its CI scope includes application typecheck, Jest, Expo exports, Deno tests and typechecks. A path filter is not evidence that every SQL regression file is actually executed by the workflow. No CI migration-apply command was used in this diagnostic.

### 5.3 Scripts and docs

- `scripts/local-migration-harness.sql` explicitly describes a local-only harness for migration 013.
- `scripts/local-migration-verification.sql` explicitly verifies migration 013 using local fixtures and PASS/FAIL assertions.
- `docs/GLOBAL_INFRASTRUCTURE.md` documents the global infrastructure introduced by migration 013 and includes local test commands.
- These are useful local verification artifacts, **not** remote history snapshots.

### 5.4 Migration history snapshots

No committed `schema_migrations` export, remote migration ledger snapshot, schema dump, or complete migration-history manifest was identified in the inspected repository tree. The local harness and verification SQL are not migration-history snapshots.

## 6. Dangerous-operation scan and risk classification

The six groups were inspected at SQL statement/function-definition level.

| Operation class | Finding in conflict files | Risk |
|---|---|---|
| DROP | Policy/constraint/trigger drops are present in multiple files; no conflicting migration file is recommended for deletion | HIGH |
| ALTER TABLE | Present in connector approval, model profiles, Agent ledger, media registry and projects | HIGH |
| ALTER TYPE | No direct `ALTER TYPE` statement identified in the twelve conflict files | No finding |
| Data rewrites | Existing plan/profile/model values are backfilled in model profiles; function bodies also contain runtime UPDATE/DELETE operations | CRITICAL |
| Policy replacement | Present in global infrastructure, model profiles, media registry, media jobs and projects | CRITICAL |
| Trigger replacement | Present in projects migration | HIGH |
| Extension changes | `vector` and `pgcrypto` creation in global infrastructure | HIGH |
| Non-transactional DDL | No `CREATE INDEX CONCURRENTLY` or other explicit non-transactional DDL identified in these twelve files | No finding |
| Privileged RPC replacement | Multiple SECURITY DEFINER/service-role/admin RPC definitions and ACL changes | CRITICAL |
| Billing/credit state | Agent step ledger, cancellation, media job recovery and pricing/ledger changes | CRITICAL |

A `DROP POLICY` or `DROP TRIGGER` followed by recreation is still a security-sensitive replacement. It must be assessed against the effective deployed policy/trigger state, not treated as harmless because it is guarded by `IF EXISTS`.

## 7. Tests and migration references

### 7.1 SQL regression tests present

The inspected `supabase/tests` directory contains 31 SQL regression files, including:

- `agent_step_usage_ledger_regression.sql` — directly exercises `record_agent_step_usage` and `finalize_agent_task_step_usage` introduced by the Agent step usage ledger.
- `agent_task_cancellation_lease_race_regression.sql` — exercises cancellation request durability, lease reclaim/fencing and worker finalization; this spans the Agent task/cancellation migrations, not just one file.
- `suly_projects_isolation_regression.sql` — tests project owner isolation and composite conversation/project ownership.
- `media_model_admin_atomic_save_regression.sql` — tests guarded atomic media model administration and associated registry structures.
- `unified_model_registry_regression.sql` — explicitly says it runs after `20261117120000_unified_model_registry_and_capabilities.sql`; this is a later migration, not one of the six conflict groups.
- `admin_provider_rpc_privilege_regression.sql`, `provider_secret_access_regression.sql` and other provider/security regressions cover adjacent provider privilege surfaces.

### 7.2 Test linkage limitations

The test directory proves that regression SQL exists; it does not prove that tests passed in this diagnostic. The workflow path filters watch the migration and test directories, but a changed path alone does not establish execution. No test was executed here.

The local migration harness and verification SQL explicitly target `013_global_infrastructure.sql`. No dedicated regression file was identified for the Composio, Cloudinary, or Tavily conflict pair itself.

## 8. Dependency analysis across the six groups

The two files inside each duplicate group are not interchangeable and generally have different upstream dependencies:

| Group | First file dependency area | Second file dependency area | Shared objects / ordering concern |
|---|---|---|---|
| 013 | Auth/profile/admin + vector/extensions + global feature infrastructure | Existing provider registry + Vault + admin RPC | Both rely on pre-existing core/auth/admin setup; no safe discard |
| 049 | Vault + Composio settings/admin/service functions | `suly_ai_requests` + connector approval lifecycle | Different tables/functions; second requires Agent/Brain request schema |
| 050 | Vault + Cloudinary settings | Vault + Tavily settings | Separate provider settings and consumers |
| 20261115190000 | Agent task/Brain usage tables and finalization | Plans, profiles, AI models | Different subsystems; each depends on earlier schema |
| 20261115210000 | Agent jobs + credit finalization | Providers + company-cost ledger + global media assets | Media registry must precede media job records |
| 20261115220000 | Media registry/assets + credit finalization | Conversations + auth identity | Media job file depends on media registry; projects file depends on conversation schema |

Important ordering dependencies visible across the larger migration set:

1. Global infrastructure and provider/Vault foundations must exist before dependent feature functions are invoked.
2. Agent task queue foundation precedes cancellation, worker fencing, step usage and settlement migrations.
3. The media provider registry precedes durable media generation job records.
4. Conversation schema precedes project grouping and its composite foreign key.
5. Existing plan/profile/model tables precede the subscription-tier profile backfill.
6. The effective dependency order must be established from actual SQL references and verified remote state; filename sorting alone is insufficient when duplicate version tokens exist.

## 9. Safe remediation options

### Immediate mandatory controls

1. Preserve all 170 migration files byte-for-byte.
2. Do not run migration repair, db push, migration up/down, reset or squash.
3. Do not apply any new schema migration until the complete local-to-remote ledger reconciliation is reviewed.
4. Capture the remote migration ledger and a schema-only snapshot through a separately approved, read-only process before any future migration governance change.
5. Establish a canonical manifest containing local path, Git blob SHA, local version token, remote version, remote name, checksum/content identity, dependencies, and verification status.

### Conflict-specific recommendations

| Group | Safe recommendation now | Consequence / later action |
|---|---|---|
| 013 | Keep both files exactly as-is; map them to remote versions `20261107084437` and `20261107000013` | Future migrations use unique timestamp versions; any correction is forward-only after schema comparison |
| 049 | Keep both files exactly as-is; map to `20261110205752` and `20261113212638` | Preserve both Vault integration and connector approval behavior; validate request replay tests |
| 050 | Keep both files exactly as-is; map to `20261111141411` and `20261113180547` | Preserve Cloudinary and Tavily independently; verify Vault-backed RPC permissions |
| 20261115190000 | Keep both files; map cancellation to `20261115185111` and model profiles to `20261115144052` | Do not reorder; separately verify task cancellation/settlement and tier backfill outcomes |
| 20261115210000 | Keep both files; map media registry to `20261115144106` and Agent step usage to `20261115195827` | Resolve the staged-production warning on Agent step usage before any production deployment decision |
| 20261115220000 | Keep both files; map media jobs to `20261115144115` and projects to `20261115220202` | Preserve dependency ordering: media registry before media jobs; conversation schema before project FK |

### Prohibited remediation shortcuts

- Deleting one member of a pair.
- Renaming either file in-place to make the local version strings unique.
- Editing old SQL to make it appear equivalent to the remote version.
- Squashing historical migrations.
- Reordering files to force a preferred sequence.
- Running repair to make the ledger appear consistent.
- Assuming that a migration is safe to skip because a later file appears to contain similar SQL.

### Future governance standard

For new migrations only:

- Use a unique 14-digit timestamp version generated by the approved Supabase CLI workflow.
- Check the proposed version against both local filenames and the verified remote ledger before committing.
- Keep each migration single-purpose and forward-only.
- Require dependency notes, risk notes and rollback/forward-recovery notes in the PR.
- Require SQL regression coverage for changed data, RLS, grants, triggers and privileged RPCs.
- Require an explicit local/remote migration manifest check in CI.
- Never alter the identity or contents of an already applied migration; correct deployed state with a new forward migration.

## 10. Required owner decisions

1. Confirm that project `razvryvazmqvvqkzetuo` is the intended remote project for this repository. The repository workflow URL and connected project name/ref agree, but owner confirmation is required before future write operations.
2. Approve a formal reconciliation exercise for the 180 remote ledger entries against all 170 local files, including historical renames and content identity.
3. Decide whether the Agent step usage migration's staged-production warning has been satisfied by deployed worker/router code and regression evidence.
4. Approve the future migration naming policy and CI gate; this diagnostic does not alter existing filenames.
5. Approve a controlled schema-only snapshot/effective-policy inspection before any database-affecting Admin 3.0.0 phase.

## 11. Commands and actions explicitly NOT executed

No command or action was run that changes the repository schema, migration history or database.

Specifically not executed:

- `supabase migration repair`
- `supabase db push`
- `supabase migration up`
- `supabase migration down`
- `supabase db reset`
- `supabase migration squash`
- Any `apply_migration` call
- Any SQL DDL/DML query against Supabase
- Any production connection or write
- Any migration file rename, delete, reorder or rewrite
- Any schema/table/policy/trigger/extension modification
- Any test command or CI workflow execution

Read-only operations performed: GitHub branch/tree/file reads on `develop`; Supabase project listing and remote migration ledger listing.

## 12. Full local migration inventory

All 170 files found under `supabase/migrations` at `develop`. Blob SHA prefixes are included to make this inventory auditable against the inspected Git tree.

- `001_initial_schema.sql` — blob `a4c1be7b871f`
- `002_rls_policies.sql` — blob `9b3f63ec9e4c`
- `003_rpc_functions.sql` — blob `76c690c6ebe7`
- `004_model_routing_and_tiers.sql` — blob `4abf16207511`
- `005_parallel_model_limit.sql` — blob `84418c023afd`
- `006_auto_routed_conversations.sql` — blob `fc88729e07ce`
- `007_model_health_monitoring.sql` — blob `83be24761973`
- `008_agent_memory_similarity_search.sql` — blob `f5d771c91c0e`
- `009_suly_credit_escrow.sql` — blob `392d426b1b63`
- `010_admin_ban_audit.sql` — blob `7de570ceb0df`
- `011_closed_text_beta_hardening.sql` — blob `33779ec90f76`
- `012_restrict_provider_catalog_privileges.sql` — blob `0d8cc0d80235`
- `013_global_infrastructure.sql` — blob `a7c34ec804b6`
- `013_upsert_ai_provider_credentials.sql` — blob `36b0abeff7f5`
- `014_subscription_plans_and_system_settings.sql` — blob `e3e073c79647`
- `015_rewarded_ads.sql` — blob `8f5c0951bd39`
- `016_admin_provider_listing_rpc.sql` — blob `2ae072920e8a`
- `017_admin_hims_resources_rpc.sql` — blob `9183206c8139`
- `018_admin_provider_lifecycle.sql` — blob `880ab6142cc3`
- `019_provider_visibility_control.sql` — blob `57420111e4fd`
- `021_activation_code_management.sql` — blob `c87b6c06a321`
- `022_restore_chat_routing_defaults.sql` — blob `1d566bc45dfc`
- `023_user_content_support_feedback_friction.sql` — blob `3dbfdad712c5`
- `024_cloudinary_private_resources_and_retire_r2.sql` — blob `61565eef3830`
- `025_conversation_public_sharing.sql` — blob `a8fab0823ad9`
- `026_conversation_share_status.sql` — blob `de1aab0e640a`
- `027_model_health_probes.sql` — blob `a8093cd35cd9`
- `028_google_auth_profile_sync.sql` — blob `4af931338f9f`
- `029_ai_resilience_and_model_log.sql` — blob `a2db50b436a6`
- `030_resilient_provider_deletion.sql` — blob `d2c33ab38cc5`
- `031_plan_features_and_task_usage.sql` — blob `549f10f679fb`
- `032_task_ratings.sql` — blob `0c8696853004`
- `033_enable_ultra_subscription_tier.sql` — blob `accebcd4164c`
- `034_subscription_plan_labels_and_feature_text.sql` — blob `35c94020145d`
- `035_conversation_pins_and_archive.sql` — blob `43442450b7c1`
- `036_agent_orchestration_ledger.sql` — blob `025c12598b5c`
- `037_credit_gated_text_chat_no_daily_limit.sql` — blob `d51fe1335e93`
- `038_model_test_and_agent_workspace.sql` — blob `3e96f9d0f2bb`
- `039_quick_replies_cache.sql` — blob `2d5a5042bc02`
- `040_shared_task_memory.sql` — blob `370d63e3619e`
- `041_flexible_probes_and_fixed_agents.sql` — blob `9e3e1cace85a`
- `042_security_hardening.sql` — blob `7fadc3057bae`
- `043_admin_change_audit.sql` — blob `6850e3c7ffe1`
- `044_audit_sensitive_value_redaction.sql` — blob `021d687d14da`
- `045_brain_system.sql` — blob `2529b7a27922`
- `046_brain_tier_seed_completion.sql` — blob `579233d3cf4d`
- `047_cloudflare_image_generation.sql` — blob `8cbe3a5b151a`
- `048_ai_request_idempotency_and_brain_safety.sql` — blob `0c7b4c9c0161`
- `049_composio_vault_credential.sql` — blob `52b91bee1553`
- `049_single_use_connector_approval.sql` — blob `216f5f376a54`
- `050_cloudinary_vault_config.sql` — blob `e6a789ca6bf7`
- `050_tavily_vault_credential.sql` — blob `d73cf61bba94`
- `051_supabase_private_media_storage.sql` — blob `222413bad1d2`
- `052_gmail_task_model.sql` — blob `e6b83e518c39`
- `053_brain_connector_capabilities.sql` — blob `3dbe1443b6e3`
- `054_message_editing.sql` — blob `8dbea58755d9`
- `055_message_edit_update_policy.sql` — blob `f10a8e47026e`
- `056_message_edit_policy_hardening.sql` — blob `b45ada28aad4`
- `057_agent_modes_and_granular_capabilities.sql` — blob `d5f86b58b454`
- `058_add_model_settings_rpc.sql` — blob `96e654f08177`
- `059_secure_agent_model_settings_rpc.sql` — blob `838bdac1a6cb`
- `060_durable_task_lifecycle.sql` — blob `7f1cd580321f`
- `061_agent_tool_registry_and_roles.sql` — blob `00c311a89ed4`
- `062_reviewer_and_tool_execution_hardening.sql` — blob `04e4d851ec38`
- `063_route_model_assignments.sql` — blob `3aa1fed996e8`
- `20261114222418_agent_task_queue_foundation_20261115.sql` — blob `94bd1664b400`
- `20261114222959_agent_task_user_scoped_worker_and_status.sql` — blob `61575d5b0b3f`
- `20261114223332_agent_task_job_status_invoker_rls.sql` — blob `441d6d680464`
- `20261114223419_agent_task_single_active_job_per_user.sql` — blob `4baf54dadeb8`
- `20261115011500_agent_task_global_claim_and_lease_guard.sql` — blob `fee99b0caeaf`
- `20261115030000_agent_task_scheduler_token_guard.sql` — blob `3490d7a777a2`
- `20261115120000_signup_welcome_credits.sql` — blob `4b75e9920ed4`
- `20261115140000_agent_task_scheduler_cron_dispatch.sql` — blob `fa88b16baac0`
- `20261115150000_agent_task_retry_backoff.sql` — blob `2380dfede884`
- `20261115170000_brain_usage_overage_accounting.sql` — blob `cf42f9bcc098`
- `20261115172009_password_storage_hardening_legacy_users.sql` — blob `83b1d3dd7778`
- `20261115180000_admin_agent_task_queue_overview.sql` — blob `d3c0528094bf`
- `20261115190000_safe_queued_agent_task_cancellation.sql` — blob `43cfde1bf249`
- `20261115190000_suly_model_profiles_and_subscription_tiers.sql` — blob `edaf1c27f106`
- `20261115200000_credit_overage_and_company_cost_ledger.sql` — blob `bd20fab7bf2b`
- `20261115203000_agent_task_exact_usage_settlement.sql` — blob `f9c05f1df88b`
- `20261115203500_allow_trusted_agent_usage_settlement.sql` — blob `96679fbf1935`
- `20261115204000_agent_worker_fencing_and_tool_checkpoints.sql` — blob `3a88dc35f21a`
- `20261115210000_agent_step_usage_ledger.sql` — blob `d66009d68d46`
- `20261115210000_media_generation_provider_registry.sql` — blob `611353bee228`
- `20261115212908_harden_profile_identity_upsert.sql` — blob `b2466dc3e2ce`
- `20261115220000_media_generation_job_records.sql` — blob `405b799544e2`
- `20261115220000_suly_projects_and_conversation_grouping.sql` — blob `e6d6995ab6ae`
- `20261115223000_cooperative_agent_task_cancellation.sql` — blob `e3db9fca8786`
- `20261115224500_agent_terminal_usage_settlement.sql` — blob `7b0bfe7e2dd3`
- `20261115230000_subscription_entitlement_ledger.sql` — blob `f74e7db78b18`
- `20261115231500_correct_agent_step_usage_hold_status.sql` — blob `304bdd8030cb`
- `20261115233000_allow_agent_usage_reconciliation.sql` — blob `cb9a28c8f2f8`
- `20261115234500_allow_terminal_usage_reconciliation.sql` — blob `c8c6ab51b812`
- `20261115235000_agent_terminal_settlement_sweep_atomic.sql` — blob `b8f4a584d173`
- `20261115235500_idempotent_terminal_usage_recording.sql` — blob `55bb1b2375bd`
- `20261115240000_effective_subscription_entitlements.sql` — blob `fc8d7093bc79`
- `20261115250000_database_security_hardening.sql` — blob `39f10ab9bc42`
- `20261115260000_live_credit_hold_expiry_guard.sql` — blob `87d7c2e47ff9`
- `20261115270000_credit_hold_running_request_guard.sql` — blob `1905f00a8052`
- `20261115275000_legacy_model_health_rpc_compat.sql` — blob `7be837c68b22`
- `20261115276000_rls_policy_dedup_and_admin_guard.sql` — blob `3ccb574e3df1`
- `20261115280000_suly_tier_model_profiles.sql` — blob `ded71b066979`
- `20261115290000_chat_provider_cost_ledger.sql` — blob `900b778aa221`
- `20261115300000_credit_finance_conversion_settings.sql` — blob `a43439a5e4e7`
- `20261115320000_message_feedback_rating_ownership_hardening.sql` — blob `0662b0e06876`
- `20261115330000_media_price_finance_guardrails.sql` — blob `b495ea74a197`
- `20261115340000_disable_retired_groq_model.sql` — blob `0b0660eaf157`
- `20261115350000_daily_credit_allowance.sql` — blob `f0d1ed5c7e90`
- `20261115360000_seed_verified_image_model_preset.sql` — blob `969c530c48b7`
- `20261115370000_mark_gpt_image_2_deprecated.sql` — blob `91064bb0d5df`
- `20261115380000_seed_nano_banana_image_presets.sql` — blob `d2c8ec7da772`
- `20261116010000_model_routing_governance.sql` — blob `7f15bf4178ed`
- `20261116013000_strict_model_route_allowlists.sql` — blob `22b7864921b0`
- `20261116020000_atomic_model_route_admin.sql` — blob `1dafc9704c32`
- `20261116030000_quarantine_unverified_models.sql` — blob `2526359ef30c`
- `20261116040000_tier_profile_safe_fallbacks.sql` — blob `9f8bb6a2088a`
- `20261116050000_reduce_model_preflight_overhead.sql` — blob `532730f2e7c2`
- `20261116060000_freeze_media_models_with_provider.sql` — blob `e5d7c15a2134`
- `20261116061515_replace_model_consumption_admin_jwt_policy.sql` — blob `cf18f5dbdcb3`
- `20261116062322_ai_model_price_versions.sql` — blob `520058b90261`
- `20261116062821_suly_media_model_price_versions.sql` — blob `d74630c9346e`
- `20261116063944_rls_auth_initplan_optimization.sql` — blob `5c6df2c6b577`
- `20261116070000_allow_explicit_chat_model_role.sql` — blob `7f8584e846fe`
- `20261116072133_reconcile_text_model_source_prices.sql` — blob `37fda806c806`
- `20261116080000_require_primary_model_per_route.sql` — blob `6c53537ee5d3`
- `20261116090000_lock_direct_route_assignment_writes.sql` — blob `cff82b818f79`
- `20261116100000_hims_activation_code_hash_only.sql` — blob `405b95d0eca3`
- `20261116100513_restrict_provider_secret_table_read.sql` — blob `52de0c8f296c`
- `20261116101305_feature_activation_attempt_throttle.sql` — blob `1f7ad8c6ae47`
- `20261116102324_revoke_feature_flag_client_writes.sql` — blob `9fde544d200e`
- `20261116104027_harden_profile_writes_and_model_health_reset.sql` — blob `0c67bbbc4c3d`
- `20261116110000_restrict_feature_resource_table_access.sql` — blob `b835e1f8f542`
- `20261116112239_suly_media_library_organization.sql` — blob `454cf2da911c`
- `20261116120000_hims_student_resources_rpc.sql` — blob `861e634ad289`
- `20261116130000_atomic_media_model_admin_save.sql` — blob `cc12f8c73178`
- `20261116133916_ai_model_capability_evidence.sql` — blob `56498a0ee144`
- `20261116134036_expand_model_capability_evidence_keys.sql` — blob `9cc8db1321b0`
- `20261116134137_seed_official_model_capability_claims.sql` — blob `4fcc33b34784`
- `20261116134156_seed_gemini_38_flash_capabilities.sql` — blob `9ed873faf2ad`
- `20261116134241_require_capability_evidence_urls.sql` — blob `b6c848102545`
- `20261116134407_media_model_capability_evidence.sql` — blob `4ace80d48eb9`
- `20261116134422_fix_media_capability_evidence_list.sql` — blob `5636b906276e`
- `20261116134837_complete_gemini_38_flash_capability_evidence.sql` — blob `424dc73463c6`
- `20261116135003_seed_media_service_claims_from_provider_catalog.sql` — blob `c235f96d1ee7`
- `20261116135032_seed_text_catalog_claims_from_provider_file.sql` — blob `75284b2e78a3`
- `20261116135155_seed_verified_gemini_model_capabilities.sql` — blob `2dfdd83c8685`
- `20261116135230_seed_openai_gpt6_tool_capabilities.sql` — blob `ebfaae25f7e9`
- `20261116135251_seed_anthropic_model_vision_and_tools.sql` — blob `5c87d2eacdc5`
- `20261116135327_seed_openai_legacy_and_flagship_capabilities.sql` — blob `2e603fb0426f`
- `20261116135357_seed_openai_mini_and_previous_capabilities.sql` — blob `2ef62f7f3ece`
- `20261116140419_require_media_model_suly_evidence_before_activation.sql` — blob `0e8b60e7ccbf`
- `20261116180427_restrict_admin_provider_registration_rpc.sql` — blob `55252318b591`
- `20261116180955_hims_activation_code_collision_guard.sql` — blob `cd0810d98bc3`
- `20261117001500_hims_activation_user_feature_lock.sql` — blob `1bb7999d8850`
- `20261117010000_expand_central_agent_model_routes.sql` — blob `0c979137849d`
- `20261117014429_provider_archive_restore.sql` — blob `d39ba5ab9a37`
- `20261117014500_media_general_upload_rpc_access.sql` — blob `5f1e14bf86b7`
- `20261117014554_provider_aware_custom_page_summaries.sql` — blob `e9d31cdb27b1`
- `20261117014628_provider_lifecycle_snapshot_deny_client_access.sql` — blob `1c58e724e423`
- `20261117020000_suly_admin_custom_page_builder.sql` — blob `262c98313e56`
- `20261117020100_provider_aware_custom_page_summaries_after_builder.sql` — blob `c532c20c5fea`
- `20261117020200_custom_admin_page_deny_client_rls.sql` — blob `ec75a797ba77`
- `20261117120000_unified_model_registry_and_capabilities.sql` — blob `9d84cccae75b`
- `20261117140000_free_and_ultra_team_model_profiles.sql` — blob `986771658da4`
- `20261117150000_configurable_welcome_trial_budget.sql` — blob `032624125d14`
- `20261117171500_fix_unified_model_capability_provider_name_type.sql` — blob `8ba71e6406b4`
- `20261117180000_suly_max_profile_available_from_pro.sql` — blob `3e96cc21b5c3`
- `20261117210000_verified_multi_provider_chat_routes.sql` — blob `4e0196ae9d6e`
- `20261118190000_user_learned_skills.sql` — blob `a49f13ab6103`

---

**Final status:** Diagnostic evidence collected; migration changes blocked pending owner-approved reconciliation. No database objects, remote migration history, or existing migration files were changed.
