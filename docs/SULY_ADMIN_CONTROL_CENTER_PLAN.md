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
   - The endpoint is deployed to the current Supabase development project as version 3. The deployed entrypoint and shared CORS/auth helpers were compared with `develop`; browser/device authorization acceptance remains in Track B.
3. **Navigation**
   - Added the existing User Friction dashboard to the admin navigation; its route existed but was previously undiscoverable from the menu.
   - Expanded global admin search to search the actual navigation catalogue and open matching pages; email/UUID searches route to users.
   - Reviewed all 20 protected admin route entry files against the navigation catalogue; each route resolves to its corresponding feature screen, with no navigation-only dead route found in this source review.
4. **User directory and subscriptions**
   - Replaced the first-200-only user list with server-side 50-row pagination, total-count reporting, server-side active/banned filtering, and server-side name/email/UUID search. Search input is debounced, stale in-flight responses are ignored, page bounds are clamped, and user-provided search text is quoted/escaped before it enters the PostgREST OR filter. Bulk selection is cleared when changing search, pages, or filters so actions cannot accidentally target a stale result set.
   - Replaced the admin conversation directory's first-500 client-side filter with a server-side 50-row paginated directory, exact total count, title/email/name/UUID search, debounced input, stale-request protection, and explicit unavailable/error states. The screen reads metadata only and does not expose conversation message content.
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
   - Storage overview metrics also display unknown until bucket/object inventory succeeds; failed requests no longer appear as an empty project.
   - Credit overview metrics and transaction exports now remain unavailable when the ledger query fails instead of presenting a false zero or exporting an empty CSV.
   - The finance ledger count now shows unknown on query failure and clears stale rows, so a failed refresh cannot look like an empty or current ledger.
   - Audit-log result totals now show unknown on query failure and clear stale counts instead of displaying a false zero/current total.
   - AdMob settings inputs and save are disabled until existing settings load successfully, preventing a failed read from overwriting stored identifiers with blank defaults.
   - Composio and Tavily key replacement now requires a successful current-status check; a retry control is available, and failed status reads no longer appear as confirmed “not configured.”
   - User directory totals and pagination now show unavailable after a failed load, and stale user rows/selections are cleared instead of being mistaken for current results.
   - Conversation metadata now uses server-side 50-row pagination with exact totals, debounced title/email/UUID search, and stale-request protection; conversation content remains hidden from this admin view.
   - Friction and feedback summaries now distinguish a failed summary request from a real zero-event/zero-rating period.
   - Support inbox errors are shown inline on Web and native; a failed inbox query is no longer displayed as a genuine empty inbox.
6. **HIMS resource lifecycle**
   - Added admin actions to edit resource metadata and to deactivate/reactivate existing HIMS resources without deleting their records or stored media.
   - Updates reuse the existing admin-guarded `suly_admin_upsert_feature_resource_v2` RPC, preserve the original URL/media-asset identity and prior active state, and require confirmation before changing visibility.
   - The database RPC performs each write and records its existing audit event. No activation entitlement, activation code, media object, or student record is changed by these actions.
7. **Cross-platform implementation rule**
   - Admin UI and behavior remain in the shared Expo/React Native application; every admin feature change must be implemented once in shared code and kept compatible with Web, Android, and iOS.
   - Platform-specific UI adaptations are allowed only where required by navigation, input, safe-area, file-picker, clipboard, or native capability differences. Unsupported platform capabilities must be clearly disabled or explained rather than rendered as working controls.
   - CI must continue exporting the Web app and Android/iOS JavaScript bundles. Bundle export is compatibility evidence, not device-level acceptance.

## Remaining scope and acceptance boundaries

The following items are deliberately separated from admin-workspace implementation; they are not silently represented as working features:

- **HIMS resource deletion/retention:** editing metadata and changing visibility are supported. Permanent deletion is intentionally excluded until a reviewed retention policy exists; do not hard-delete private media as a shortcut.
- **Storage explorer acceptance:** the read-only `admin-storage` function is deployed to the development project as version 3. Real browser/device invocation, invalid-token denial, non-admin denial, and bucket/object inventory acceptance remain Track B.
- **Provider-dependent services:** video/audio generation and AdMob impression/revenue reporting remain explicitly unavailable until verified provider credentials and real backend reporting/generation support exist. The admin screens may manage configuration only; they must not claim generation or revenue reporting is live.
- **Other unconfigured integrations:** remain clearly marked unconfigured and must not be activated by inventing credentials, provider routing, or prices.

These are intentionally bounded product capabilities or Track B acceptance items, not missing admin navigation or a reason to build a second admin application. The dashboard implementation may be closed only after the shared source review and current Web/Android/iOS CI exports succeed. Browser/device/E2E/security acceptance remains separate and must not be described as passed.
## HIMS activation-code collision protection applied

- Applied migration `20261116180955_hims_activation_code_collision_guard` to the current Supabase development project and committed the matching migration file on `develop`.
- The creation RPC now uses `ON CONFLICT (code_hash) DO NOTHING` and raises a duplicate-code error. A hash collision cannot reactivate a disabled code or overwrite its label, use limit, expiry, or feature mapping.
- Verified the live function definition after migration: collision-safe insert present, old `DO UPDATE` path absent, duplicate rejection present.
- No existing activation-code rows were changed by the migration. Full duplicate/replay/race tests remain in Track B.
- Ran a rollback-only SQL regression on the current development database: created a temporary code, disabled it, retried the same hash with changed metadata/limits/expiry, verified the duplicate was rejected and the original row stayed disabled and unchanged, then rolled back. A follow-up query confirmed zero leftover test rows. Reusable test: `supabase/tests/hims_activation_code_collision_guard.sql`.

## Admin Storage deployment

- Deployed `admin-storage` to the current Supabase development project as Edge Function version 3.
- The deployed entrypoint and shared CORS dependency were retrieved and compared with the `develop` source. Version 2 explicitly passed the Bearer JWT to `auth.getUser(userJwt)`. Version 3 isolates Bearer-token parsing in `admin-storage/auth.ts`, adds Deno regression tests for valid/malformed headers, and passes the extracted JWT explicitly to `auth.getUser(userJwt)`.
- The function is intentionally configured with platform JWT verification disabled because it performs its own Bearer-token validation, verifies the caller via Auth, and checks `suly_is_admin()` before using the server-only service-role client.
- The function is read-only: it lists bucket metadata and objects, returns sanitized metadata, and does not upload, delete, change policies, or expose public URLs.
- Real browser/device invocation, invalid-token denial, non-admin denial, and bucket/object inventory acceptance remain Track B; deployment alone is not an E2E pass.

## HIMS activation-code lifecycle update

- Added admin disable/reactivate controls to the HIMS code list and optional code-expiry entry (validated as a real future calendar date before calling the existing RPC). The date parser is isolated in a shared helper with unit coverage for blank, valid, malformed, impossible, and expired dates.
- Status changes call the existing `suly_admin_set_activation_code_active` RPC, which verifies `auth.uid()` and `suly_is_admin()`, updates only `is_active`, and writes an `admin_audit_logs` event.
- The client prevents reactivation when the code has expired or reached its use limit. Code plaintext is never reloaded or displayed; only the fingerprint and usage metadata are shown.
- Added unit coverage for the admin guard and RPC arguments. No new database migration was required for this feature.

## Security fixes applied to the current Supabase development project

- The live `suly_admin_add_provider(uuid,text,text,text,text,text)` RPC was verified to be called only by the `sync-models` Edge Function, which validates the caller JWT and `suly_is_admin()` before using its server-role client.
- Applied and recorded migration `20261116180427_restrict_admin_provider_registration_rpc`: revoke function execution from `PUBLIC`, `anon`, and `authenticated`; grant it only to `service_role`.
- Verified against PostgreSQL privileges after application: `anon=false`, `authenticated=false`, `service_role=true`.
- Added a rollback-only SQL privilege regression test at `supabase/tests/admin_provider_rpc_privilege_regression.sql`.
- This was a database permission-only change; it did not alter provider rows, credentials, routing, or pricing. The source migration is committed on `develop`; production branch and production database were not changed.
- Reviewed the current Security Advisor's 12 RLS-enabled/no-policy tables: direct `anon` and `authenticated` SELECT/INSERT privileges are absent on all 12. These are internal/server-managed tables, not client-readable collections.
- Reviewed all live `suly_admin_*` SECURITY DEFINER definitions: admin operations enforce `suly_is_admin()`, identity-bound provider update validates `auth.uid() = p_user_id`, and provider enable delegates to the guarded lifecycle RPC. Provider creation is now service-role-only and its Edge Function performs the caller admin check first.
- Remaining platform-level warning: leaked-password protection is disabled in Supabase Auth settings; this requires a separate Auth configuration change and remains open rather than being silently altered.

## Security review notes — not silently changed

A read-only Supabase Security Advisor snapshot on 2026-11-16 reported:
- 12 RLS-enabled tables with no policies. Some may be intentionally service-role-only; each table's intended access model must be reviewed before adding any policy.
- Two extensions installed in `public`.
- One anonymous-executable SECURITY DEFINER function and multiple authenticated-executable SECURITY DEFINER functions.
- Leaked-password protection disabled.

These are review findings, not proof that each function is exploitable. Do not blanket-revoke grants or add broad RLS policies: inspect each function body, its `auth.uid()`/admin checks, grants, callers, and intended exposure first. Any remediation that changes production security behavior requires its own reviewed migration and isolated regression checks.

- Support inbox now uses exact-count server-side pagination (50 tickets per page) instead of loading only the first 200 records. Ticket-detail loading also ignores stale responses when the administrator switches between tickets or closes the detail view while requests are still running.

## Development preview and production separation

- GitHub Pages is a single published site for this repository; deploying a separate branch directly would replace the existing site. The Pages workflow therefore assembles one artifact with two isolated paths.
- The stable production site is built only from `release/v1` and remains at the existing root path: `/smsm-ai/`.
- The development preview is built from `develop` and published under `/smsm-ai/preview/`. Development pushes refresh the preview while the production root is rebuilt from the unchanged release branch.
- Both builds use the same Expo application source structure and public Supabase configuration; they differ only by the Expo web base path and source branch.
- Promoting a tested development change to `release/v1` remains an explicit reviewed action. No automatic merge or production source update is performed.
- The combined Pages workflow is implemented on `develop`; the first preview deployment remains pending its current GitHub Actions build/deploy run. Do not announce a live preview URL until the Pages deployment succeeds and the preview path responds.

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
