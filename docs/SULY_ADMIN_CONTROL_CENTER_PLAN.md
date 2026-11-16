# SULY Admin Control Center — Build & Verification Record

**Branch:** `develop`  
**Scope:** Complete the existing SULY administration workspace additively. Preserve current routes, features, data, pricing, provider routing, HIMS, and production branch.  
**Production changes:** None. No production deployment, schema migration, provider activation, price edit, credit adjustment, or storage mutation is part of this work.

## Existing administration surface retained

The existing protected admin route remains guarded by the authenticated session and the server-side `suly_is_admin()` check. The existing navigation and feature modules are preserved:

- Overview, conversations, audit log, support, and user-friction insights.
- AI providers, text models, media models, capability evidence, health probes, routing, and Agent configuration.
- Users, subscriptions, wallet/credit operations, pricing plans, finance overview, and negative-balance controls.
- Rewarded-ad configuration.
- HIMS activation codes and learning resources.
- Provider/API-key integrations (including Composio and Tavily), storage, and system/circuit-breaker settings.

No parallel admin application or replacement data model is introduced.

## Additive improvements implemented on develop

1. **Storage inventory and explorer**
   - Replaced the static storage placeholder with a live bucket and object browser.
   - Displays bucket privacy, file-size limit, allowed MIME types, current-path file/folder counts, and visible file metadata.
   - Supports selecting a bucket, navigating folders/breadcrumbs, and filtering the current path.
   - Read-only: no delete, upload, public-bucket toggle, policy change, or public URL generation.
   - Lists at most 100 items per path and explicitly labels visible-path size as a partial view, not total project usage.
2. **Storage authorization boundary**
   - Added `supabase/functions/admin-storage/index.ts` and its function config.
   - The function validates the Bearer session with Auth and calls `suly_is_admin()` before using the service-role client.
   - Only sanitized bucket/object metadata is returned; service-role credentials remain server-side.
   - The function is intentionally read-only and uses the existing exact-origin CORS helper.
   - This endpoint is source-only on `develop`; it has not been deployed to the hosted project.
3. **Navigation**
   - Added the existing User Friction dashboard to the admin navigation; its route existed but was previously undiscoverable from the menu.
   - Expanded global admin search to search the actual navigation catalogue and open matching pages; email/UUID searches route to users.
   - Reviewed all 20 protected admin route entry files against the navigation catalogue; each route resolves to its corresponding feature screen, with no navigation-only dead route found in this source review.
4. **User directory and subscriptions**
   - Replaced the first-200-only user list with server-side 50-row pagination, total-count reporting, server-side active/banned filtering, and server-side name/email/UUID search. Search input is debounced, stale in-flight responses are ignored, page bounds are clamped, and user-provided search text is quoted/escaped before it enters the PostgREST OR filter. Bulk selection is cleared when changing search, pages, or filters so actions cannot accidentally target a stale result set.
   - Added a user-level subscription grant workflow using the existing audited `suly_admin_grant_subscription` RPC.
   - The UI loads active plans only, shows the existing catalog values without editing them, accepts an optional expiry date, requires an administrative reason, and confirms before replacing any prior active subscription.
   - The database function verifies `auth.uid()` and `suly_is_admin()`, validates the active plan and expiry, replaces the previous active row, updates the user's tier, and writes an audit record. No user subscription was changed during implementation.
   - Admin-originated support replies now perform a client-side admin check before insertion; the database RLS policy independently enforces `suly_is_admin()` for `is_admin_reply=true`.
5. **Operational accuracy**
   - The shell's health indicator now requires a health record for each enabled model; missing health evidence is shown as unknown instead of silently healthy.
   - Overview metrics distinguish administratively disabled models from enabled models with errors/restrictions.
   - Renamed the quick action to “فحص اتصال النماذج” to avoid claiming that it performs the full comprehensive test program.
   - Added shortcuts to User Friction and Storage.
   - Dashboard metrics now distinguish unavailable model-health, usage, audit, and maintenance data from legitimate zero/disabled values; maintenance controls are disabled when the current state cannot be confirmed.
6. **HIMS resource lifecycle**
   - Added admin actions to edit resource metadata and to deactivate/reactivate existing HIMS resources without deleting their records or stored media.
   - Updates reuse the existing admin-guarded `suly_admin_upsert_feature_resource_v2` RPC, preserve the original URL/media-asset identity and prior active state, and require confirmation before changing visibility.
   - The database RPC performs each write and records its existing audit event. No activation entitlement, activation code, media object, or student record is changed by these actions.
7. **Cross-platform implementation rule**
   - Admin UI and behavior remain in the shared Expo/React Native application; every admin feature change must be implemented once in shared code and kept compatible with Web, Android, and iOS.
   - Platform-specific UI adaptations are allowed only where required by navigation, input, safe-area, file-picker, clipboard, or native capability differences. Unsupported platform capabilities must be clearly disabled or explained rather than rendered as working controls.
   - CI must continue exporting the Web app and Android/iOS JavaScript bundles. Bundle export is compatibility evidence, not device-level acceptance.

## Remaining implementation gaps — dashboard is not yet complete

- **HIMS activation-code lifecycle:** implemented create/list/disable/reactivate using the existing admin-guarded, audited `suly_admin_set_activation_code_active` RPC. The UI blocks reactivation of expired or exhausted codes. Track B must verify the RPC permission boundary and that disabled codes are rejected during student activation.
- **HIMS resource deletion/retention:** metadata editing and visibility controls are implemented. A separately reviewed deletion/retention policy remains intentionally unimplemented; do not hard-delete private media as a shortcut.
- **Storage explorer runtime acceptance:** `admin-storage` is deployed to the current Supabase development project as version 1 with `verify_jwt=false` because the function performs its own Bearer-session and `suly_is_admin()` checks before creating a service-role client. Source and deployed entrypoint/shared CORS code were compared. Owner-authenticated browser/device E2E and unauthorized-request checks remain in Track B.
- **Provider-dependent services:** media video/audio generation, ad impression/revenue reporting, and any unconfigured provider integrations must remain explicitly unavailable or configuration-only until verified credentials and real backend support exist.

These are implementation/configuration gaps, not Track B device-test deferrals. The dashboard must not be marked implementation-complete while any in-scope source-level gap remains.

## HIMS activation-code collision protection applied

- Applied migration `20261116180955_hims_activation_code_collision_guard` to the current Supabase development project and committed the matching migration file on `develop`.
- The creation RPC now uses `ON CONFLICT (code_hash) DO NOTHING` and raises a duplicate-code error. A hash collision cannot reactivate a disabled code or overwrite its label, use limit, expiry, or feature mapping.
- Verified the live function definition after migration: collision-safe insert present, old `DO UPDATE` path absent, duplicate rejection present.
- No existing activation-code rows were changed by the migration. Full duplicate/replay/race tests remain in Track B.

## Admin Storage deployment

- Deployed `admin-storage` to the current Supabase development project as Edge Function version 1.
- The deployed entrypoint and shared CORS dependency were retrieved and compared with the `develop` source.
- The function is intentionally configured with platform JWT verification disabled because it performs its own Bearer-token validation, verifies the caller via Auth, and checks `suly_is_admin()` before using the server-only service-role client.
- The function is read-only: it lists bucket metadata and objects, returns sanitized metadata, and does not upload, delete, change policies, or expose public URLs.
- Real browser/device invocation, invalid-token denial, non-admin denial, and bucket/object inventory acceptance remain Track B; deployment alone is not an E2E pass.

## HIMS activation-code lifecycle update

- Added admin disable/reactivate controls to the HIMS code list.
- Status changes call the existing `suly_admin_set_activation_code_active` RPC, which verifies `auth.uid()` and `suly_is_admin()`, updates only `is_active`, and writes an `admin_audit_logs` event.
- The client prevents reactivation when the code has expired or reached its use limit. Code plaintext is never reloaded or displayed; only the fingerprint and usage metadata are shown.
- Added unit coverage for the admin guard and RPC arguments. No new database migration was required for this feature.

## Security fixes applied to the current Supabase development project

- The live `suly_admin_add_provider(uuid,text,text,text,text,text)` RPC was verified to be called only by the `sync-models` Edge Function, which validates the caller JWT and `suly_is_admin()` before using its server-role client.
- Applied and recorded migration `20261116180427_restrict_admin_provider_registration_rpc`: revoke function execution from `PUBLIC`, `anon`, and `authenticated`; grant it only to `service_role`.
- Verified against PostgreSQL privileges after application: `anon=false`, `authenticated=false`, `service_role=true`.
- Added a rollback-only SQL privilege regression test at `supabase/tests/admin_provider_rpc_privilege_regression.sql`.
- This was a database permission-only change; it did not alter provider rows, credentials, routing, or pricing. The source migration is committed on `develop`; production branch and production database were not changed.

## Security review notes — not silently changed

A read-only Supabase Security Advisor snapshot on 2026-11-16 reported:
- 12 RLS-enabled tables with no policies. Some may be intentionally service-role-only; each table's intended access model must be reviewed before adding any policy.
- Two extensions installed in `public`.
- One anonymous-executable SECURITY DEFINER function and multiple authenticated-executable SECURITY DEFINER functions.
- Leaked-password protection disabled.

These are review findings, not proof that each function is exploitable. Do not blanket-revoke grants or add broad RLS policies: inspect each function body, its `auth.uid()`/admin checks, grants, callers, and intended exposure first. Any remediation that changes production security behavior requires its own reviewed migration and isolated regression checks.

## Track B — required comprehensive verification

- Admin/non-admin/expired-session checks for every route and for `admin-storage` (401/403 behavior).
- Confirm service-role credentials never appear in client bundles, logs, or function responses.
- Verify only an authorized admin can enumerate buckets and object metadata; reject invalid bucket IDs, traversal paths, unsupported actions, and non-POST requests.
- Verify private bucket remains private and the page never creates public URLs or mutates storage.
- Verify nested folders, empty folders, files, search, first-100-item limit, large/unknown metadata, and Storage API errors.
- Verify global search for Arabic/English page labels, email, UUID, and empty results.
- Verify all admin routes are discoverable on desktop and mobile, RTL/LTR layout, keyboard behavior, and narrow widths.
- Verify every admin action on Web, Android, and iOS where the capability exists; specifically test HIMS resource deactivate/reactivate, student visibility after the change, and safe behavior when a platform lacks a required native capability.
- Verify model health unknown/error/healthy states and that intentionally disabled models are not reported as unhealthy.
- Verify subscription grants for active/inactive plans, optional/past expiry, reason validation, replacement of prior active subscriptions, profile tier update, and audit-log creation; use isolated test users only.
- Verify HIMS resource metadata edits preserve the same resource ID, URL/media asset, and active state; verify deactivation/reactivation changes only visibility and creates the expected audit event.
- Verify sensitive actions retain their existing confirmation, audit, server-side authorization, and idempotency boundaries.
- Review all Security Advisor findings separately; no production policy/grant/extension/auth setting has been changed by this dashboard work.
- Deploy the new Edge Function only after Track B authorization and regression checks, then verify it against an isolated test account before considering production rollout.

## Completion semantics

Implementation completion and runtime acceptance are tracked separately. The admin workspace may be marked **implementation complete on `develop`** after every existing module and additive source change has been reviewed, current CI succeeds, and no known source-level blocker remains. This does not mean browser/device/E2E/security tests passed or that the hosted Edge Function is deployed. Those outcomes remain explicitly **pending Track B** and must not be represented as passed. Production deployment remains a separate owner-authorized action.
