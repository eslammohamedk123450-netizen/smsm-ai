# SULY AI — Stage 1 Security Audit

**Date:** 2026-11-15  
**Target branch:** `release/v1`  
**Supabase project:** `razvryvazmqvvqkzetuo`  
**Status:** IN PROGRESS — not a release/security sign-off

## Scope

Read-only inventory of public-table RLS, policies and grants; SECURITY DEFINER functions and search paths; admin authorization predicates; conversation sharing; Storage and Vault access; exposed Edge Function authentication; and Supabase Security Advisor findings.

No production data, balances, subscriptions, provider credentials, or user records were changed. The SQL authorization tests ran inside transactions and were rolled back. No migration was applied in this audit.

## Findings

### 1. Public database tables and RLS

- 79 public tables were found.
- RLS is enabled on all 79; none were found with RLS disabled.
- Eight tables have no RLS policies:
  - `brain_attempt_logs`
  - `brain_usage_daily`
  - `brain_usage_events`
  - `cloudinary_integration_settings`
  - `composio_integration_settings`
  - `suly_image_generation_settings`
  - `suly_rewarded_ad_claims`
  - `tavily_integration_settings`
- The eight policy-less tables have no SELECT, INSERT, UPDATE, or DELETE table privileges for `anon` or `authenticated`. This is fail-closed and appears intentional for service-only data. No broad client policy was added.
- The two exposed public views found, `suly_admin_providers` and `ai_providers_catalog`, use `security_invoker=true`; `anon` has no SELECT privilege.
- The `public` schema does not grant CREATE to `anon` or `authenticated`.

### 2. SECURITY DEFINER functions

- 99 SECURITY DEFINER functions exist in `public`.
- All 99 have an explicit fixed `search_path`.
- 52 are executable by `authenticated`; this is not by itself proof of a vulnerability. The `suly_admin_*` functions inspected contain database-backed admin checks, and no `suly_admin_*` function was found missing an obvious admin guard.
- `suly_is_admin()` checks membership in `public.suly_admins`, joins the corresponding profile, and rejects banned accounts. It does not trust client-editable user metadata.
- One SECURITY DEFINER function is executable by `anon`: `suly_get_public_conversation(uuid)`. This is the intentional opt-in public-share endpoint. Its token is a UUID; disabling sharing sets the token to NULL; the response contains only title and up to 300 user/assistant messages. Two conversations currently have active share tokens. Their content was not read or changed.
- No exposed SECURITY DEFINER functions were found outside the `public` schema.

### 3. Authorization regression checks

Executed in rollback-only transactions:

- A synthetic non-admin identity returned `false` from `suly_is_admin()`.
- A synthetic nonexistent identity returned `false` from `suly_is_active_user()`.
- A synthetic user saw zero rows for another user's conversation, messages, and credit account.
- Direct admin mutation RPC attempts (model enablement, provider enablement, user ban, and finance limit update) were rejected by the functions' authorization checks.
- Cross-owner conversation share-status and share-enable attempts were rejected.
- Claiming daily credits for another user and reading another user's subscription tier were rejected.
- An invalid public-share token returned NULL.
- Storage returned zero visible objects to the synthetic authenticated identity.

### 4. Storage and Vault

- One Storage bucket exists and it is private; one object exists.
- `storage.objects` has RLS enabled and no client policies. Although the API roles have base table privileges, the lack of policies makes client access default-deny. This means direct client upload/download is not enabled by current Storage policies; do not add broad policies without designing owner/path restrictions.
- `anon` and `authenticated` have no Vault schema usage and no access to Vault secret tables. Vault secret write functions are limited to `service_role`.

### 5. Edge Function authentication

The following deployed functions have `verify_jwt=false`; source inspection found application-level authentication rather than an unauthenticated public execution path:

- `ai-router`: validates user Bearer tokens with Supabase Auth `getUser`; its internal Brain path requires exact service-role-key header equality and a valid UUID user context.
- `brain-router`: validates user Bearer tokens with `getUser`; internal worker requests require exact service-role-key header equality and the internal-worker flag.
- `model-health-check`: requires a Vault-backed scheduler secret for scheduled runs or a valid user JWT plus `suly_is_admin()` for manual runs.
- `agent-task-scheduler`: requires a scheduler token of at least 32 characters and verifies it through `verify_agent_task_scheduler_token`.

Other deployed functions inspected in the inventory require JWT verification. This was a source/configuration audit, not an external HTTP penetration test.

### 6. Remaining hardening findings

#### Leaked-password protection is disabled

Supabase Security Advisor reports `auth_leaked_password_protection`. Supabase's current documentation states that HaveIBeenPwned leaked-password protection is available on Pro Plan and above. The available project tools do not expose an Auth-settings write operation, and no plan upgrade was made. This remains open; do not claim it is enabled.

Documentation: https://supabase.com/docs/guides/auth/password-security

#### pg_net schema grants are broader than least privilege

The `net` schema, its functions, `http_request_queue`, and `_http_response` have grants to `PUBLIC`, `anon`, `authenticated`, and/or `service_role`. Three application cron functions call `net.http_post` from SECURITY DEFINER functions owned by `postgres`:

- `suly_trigger_model_health_check_daily()`
- `suly_trigger_model_recovery()`
- `suly_dispatch_agent_task_scheduler()`

The extension/schema owner is `supabase_admin`; the connected database role `postgres` is not a superuser and is not a member of `supabase_admin`. A rollback-only REVOKE dry run did not change the ACLs. No ownership transfer or privilege escalation was attempted. The live PostgREST exposed-schema configuration was not independently confirmed during this audit, so this item remains open until the schema exposure and least-privilege grants are verified using an authorized owner/management path.

#### Extensions installed in public

Security Advisor reports `vector` and `pg_net` installed in `public`. They were not moved: vector is used for embeddings, and pg_net is used by scheduled Edge Function dispatch. Moving either extension without dependency mapping, staging verification, and rollback could break runtime behavior.

#### Storage client access is intentionally closed

There are no `storage` RLS policies. This is secure by default but means direct client Storage access is not currently authorized. Any future policy must bind objects to the authenticated owner and approved bucket/path, with explicit read/write/delete rules.

## Advisor snapshot

- `rls_enabled_no_policy`: 8 informational findings; client table grants are absent.
- `extension_in_public`: 2 warnings (`vector`, `pg_net`).
- `anon_security_definer_function_executable`: 1 warning; the public conversation-share RPC is intentional and token-gated.
- `authenticated_security_definer_function_executable`: 52 warnings; admin and ownership guards were inspected, and negative authorization tests were run.
- `auth_leaked_password_protection`: 1 warning; still open.

## Stage 1 decision

**Not complete.** Core table RLS, ownership isolation, admin guards, fixed search paths, Vault isolation, and application-level authentication checks passed the checks listed above. Remaining blockers are leaked-password protection (plan-gated Auth setting) and the pg_net schema's overbroad grants/exposure verification. No risky production change was made merely to silence Advisor warnings.

Do not begin Stage 2 until the remaining Stage 1 items are resolved or explicitly documented as accepted risks by the project owner.
