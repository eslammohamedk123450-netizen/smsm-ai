# SULY AI — Stage 1 Security Audit

**Date:** 2026-11-15  
**Target branch:** `release/v1`  
**Supabase project:** `razvryvazmqvvqkzetuo`  
**Status:** IN PROGRESS — not a release/security sign-off

## Scope

Inventory of public-table RLS, policies and grants; SECURITY DEFINER functions and search paths; admin authorization predicates; conversation sharing; Storage and Vault access; Edge Function authentication; password storage; and Supabase Security Advisor findings.

The initial authorization checks ran in rollback-only transactions. A follow-up password-storage migration was applied: it preserved the legacy `public.users` row and its non-credential fields, replaced only its old credential value with an unusable random bcrypt hash, added a bcrypt-format constraint, and revoked direct table access from `PUBLIC`, `anon`, `authenticated`, and `service_role`. No balances, subscriptions, provider credentials, or user rows were deleted.

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

### 6. Password storage and authentication

- Seven users exist in `auth.users`; all seven have a non-NULL `encrypted_password` field. Password hashes were never selected or displayed during the audit.
- Supabase's documented password storage uses bcrypt with a randomly generated salt. The `encrypted_password` column name is historical; it stores a password hash, not reversible ciphertext.
- The active Expo client uses `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`. The reviewed auth service does not write password values to application tables or logs.
- The only password-like application column found was `public.users.hashed_password`, in a legacy table with one admin row. Its stored value was 13 characters and did not match bcrypt, Argon2, or the common encoded hash formats checked. The audit cannot prove whether that legacy value was plaintext or a custom format, so it was treated as unsafe.
- Migration `20261115172009_password_storage_hardening_legacy_users` was applied successfully. It replaced the legacy credential with a random bcrypt hash (not derived from the old value), preserved the row and its other fields, added a bcrypt-only CHECK constraint, and revoked all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Post-migration verification confirmed one row remains, one bcrypt-format value, the constraint exists, and all four roles lack SELECT access.
- No database routine or deployed Edge Function references `public.users` or `hashed_password`. The reviewed Expo login path uses Supabase Auth.
- Separate session-storage note: the Expo auth adapter stores Supabase session tokens in native AsyncStorage and browser localStorage. These are session credentials, not passwords. Native OS-backed secure storage remains a follow-up hardening item; browser localStorage remains subject to the usual XSS exposure.
- The project owner has now configured Supabase Auth password requirements in the dashboard: minimum 12 characters, uppercase, lowercase, digit, and symbol. The owner also confirmed that the API Exposed Schemas list contains only `graphql_public` and `public`; `net` is not exposed through the Data API. PR #65 aligns the app's email/password registration validation with this policy. These dashboard settings are owner-reported; the available connector cannot independently read them back. HaveIBeenPwned leaked-password protection remains unavailable on the Free plan and has been explicitly accepted by the project owner as a temporary limitation until a Pro upgrade is affordable.

### 7. Remaining hardening findings

#### Leaked-password protection is disabled

Supabase Security Advisor reports `auth_leaked_password_protection`. Supabase's current documentation states that HaveIBeenPwned leaked-password protection is available on Pro Plan and above. The project owner explicitly accepted this as a temporary Free-plan limitation, with intent to enable it after upgrading to Pro. It is not enabled and must not be represented as enabled.

Documentation: https://supabase.com/docs/guides/auth/password-security

The project owner reports that the Supabase dashboard now enforces 12 characters plus uppercase, lowercase, digits, and symbols. PR #65 aligns client-side registration validation with those requirements. Server-side Supabase Auth settings remain authoritative; client validation is only usability feedback.

#### pg_net schema grants are broader than least privilege

The `net` schema, its functions, `http_request_queue`, and `_http_response` have grants to `PUBLIC`, `anon`, `authenticated`, and/or `service_role`. Three application cron functions call `net.http_post` from SECURITY DEFINER functions owned by `postgres`:

- `suly_trigger_model_health_check_daily()`
- `suly_trigger_model_recovery()`
- `suly_dispatch_agent_task_scheduler()`

The extension and schema owner is `supabase_admin`; the connected database role `postgres` is not a superuser and is not a member of `supabase_admin`. A fresh ACL inventory confirmed `USAGE` on schema `net` for `PUBLIC`, `anon`, `authenticated`, and `service_role`; `EXECUTE` on the extension functions for `PUBLIC`; and broad `PUBLIC` privileges on `http_request_queue` and `_http_response`. The project owner has now checked the Supabase dashboard and confirmed that the Exposed Schemas list contains only `graphql_public` and `public`, not `net`; therefore `net` is not exposed through the project's PostgREST Data API. The SQL connection cannot independently read the dashboard's Exposed Schemas setting. A rollback-only REVOKE dry run did not change ACLs. No ownership transfer, extension ownership change, or privilege escalation was attempted. The Data API exposure risk is mitigated by keeping `net` unexposed. The underlying extension ACLs remain broader than least privilege and cannot be changed by the connected `postgres` role because the extension objects are owned by `supabase_admin`; further ACL cleanup requires an authorized Supabase owner/support path and must preserve the three cron callers.

#### Extensions installed in public

Security Advisor reports `vector` and `pg_net` installed in `public`. They were not moved: vector is used for embeddings, and pg_net is used by scheduled Edge Function dispatch. Moving either extension without dependency mapping, staging verification, and rollback could break runtime behavior.

#### Storage client access is intentionally closed

There are no `storage` RLS policies. This is secure by default but means direct client Storage access is not currently authorized. Any future policy must bind objects to the authenticated owner and approved bucket/path, with explicit read/write/delete rules.

## Advisor snapshot

- `rls_enabled_no_policy`: 8 informational findings; client table grants are absent.
- `extension_in_public`: 2 warnings (`vector`, `pg_net`).
- `anon_security_definer_function_executable`: 1 warning; the public conversation-share RPC is intentional and token-gated.
- `authenticated_security_definer_function_executable`: 52 warnings; admin and ownership guards were inspected, and negative authorization tests were run.
- `auth_leaked_password_protection`: 1 warning; not enabled on Free and explicitly accepted as a temporary plan limitation by the project owner.

## Stage 1 decision

**Pending final sign-off.** Core table RLS, ownership isolation, admin guards, fixed search paths, Vault isolation, and application-level authentication checks passed the checks listed above. Legacy password storage has been neutralized and access closed. The project owner has configured the stronger Auth password policy and verified that `net` is not in the exposed API schemas. The Free-plan leaked-password-protection limitation is explicitly accepted temporarily. The remaining technical follow-up is least-privilege cleanup of managed `pg_net` ACLs; this requires an authorized `supabase_admin`/Supabase support path and must not disrupt cron dispatch. Native secure session-token storage is deferred to Stage 6, as agreed. No risky ownership transfer or extension change was made merely to silence Advisor warnings.

Stage 1 can be signed off only after the project owner explicitly accepts the residual managed `pg_net` ACL risk or Supabase provides an authorized safe remediation.
