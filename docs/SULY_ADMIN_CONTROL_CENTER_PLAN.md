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
- Verify model health unknown/error/healthy states and that intentionally disabled models are not reported as unhealthy.
- Verify subscription grants for active/inactive plans, optional/past expiry, reason validation, replacement of prior active subscriptions, profile tier update, and audit-log creation; use isolated test users only.
- Verify sensitive actions retain their existing confirmation, audit, server-side authorization, and idempotency boundaries.
- Review all Security Advisor findings separately; no production policy/grant/extension/auth setting has been changed by this dashboard work.
- Deploy the new Edge Function only after Track B authorization and regression checks, then verify it against an isolated test account before considering production rollout.

## Completion semantics

Implementation commits on `develop` mean the source changes are present; they do not mean browser/device/E2E/security tests passed or that the hosted Edge Function is deployed. The admin workspace should be called complete only after all existing modules and the additions above have been reviewed, CI is current and successful, and Track B confirms the required role and runtime behavior.
