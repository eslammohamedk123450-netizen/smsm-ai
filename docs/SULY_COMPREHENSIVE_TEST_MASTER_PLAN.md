# SULY — Independent Comprehensive Test & Acceptance Plan

**Document type:** Master verification / test plan (Track B)  
**Owner:** SULY product owner  
**Execution branch:** `develop` for test fixes only; never alter `release/v1` directly  
**Status:** PLANNED — formal campaign starts after all 17 development phases are integrated  
**Last updated:** 2026-11-16

## 1. Purpose and separation from development

This is the independent, comprehensive verification plan for SULY. It contains 17 test groups and is separate from the 17-phase build plan in `docs/SULY_DEVELOPMENT_MASTER_PLAN.md`.

Routine unit tests, typechecks, Deno tests, SQL regressions, and CI checks must continue during development to prevent regressions. Those checks do **not** mean this final campaign has started or passed. Formal Track B begins only after Track A Phase 17 integration is complete and the owner is notified that the build is ready for comprehensive verification.

Every test result must be reproducible and evidence-based. Use isolated test data and test accounts. Never request or store the owner's personal password, production bearer token, service-role key, or other secret in chat, test fixtures, logs, or GitHub.

## 2. Test result vocabulary

- **PASS:** Exact test executed successfully with evidence.
- **FAIL:** Test executed and behavior failed; record reproduction and severity.
- **BLOCKED:** Cannot execute due to unavailable account, content, provider, device, environment, or owner decision.
- **NOT RUN:** Test is planned but not executed.
- **NOT APPLICABLE:** Explain why and retain the rationale.
- **REGRESSION:** Previously passing behavior now fails.

A test group passes only when all required cases pass or the owner explicitly accepts documented limitations. A source-code review is not an end-to-end test. A successful static export is not proof that the web UI works in a browser. A JS bundle export is not proof of a native installation or real-device behavior.

## 3. Safety and test-environment rules

- Use isolated fixtures and dedicated test users; clean up only data created by the test.
- Prefer rollback-only SQL transactions for database authorization tests.
- Never use real customer/student accounts without explicit safe test arrangements.
- Never expose or request passwords/secrets in chat. If user-supplied test access is required, provide a safe flow using temporary test accounts and owner-operated authentication.
- No production writes, financial adjustments, HIMS entitlement changes, provider/model activation, secret rotation, or deployment as part of testing without explicit approval.
- Test both allowed and denied paths; include cross-user/tenant isolation.
- Record environment, commit SHA, migration state, test command, run ID, logs/artifacts, expected result, actual result, and cleanup.
- Test Web, Android, and iOS separately where behavior differs; mark unavailable physical-device tests BLOCKED rather than assuming success.
- Test Arabic RTL and English LTR, light/dark themes, keyboard/safe areas, accessibility, and responsive sizes.

## 4. The 17 comprehensive test groups

### Test Group 1 — Repository, build, and deployment baseline
- Clean install and lockfile consistency; TypeScript/lint/unit checks where configured.
- Expo Web static export; Android and iOS bundle exports.
- Deno tests/typechecks and Edge Function bundle verification.
- Workflow triggers, artifact contents, deployment target, environment variable handling, and branch protection.
- Verify Pages preview and deployed site in a real browser; confirm routes load and no blank/black screen.
- Verify no production deploy or protected branch mutation occurs from development workflows.

### Test Group 2 — Authentication, sessions, and account boundaries
- Sign-up/sign-in/sign-out, callback/deep links, expired/refresh token, session restoration, password reset where supported.
- Anonymous/unauthenticated access to protected screens and server endpoints.
- Session revocation, multiple devices, and account switching.
- Verify one user's data is never visible or mutable by another user.

### Test Group 3 — HIMS admin code lifecycle and authorization
- Non-admin cannot create, list, disable, or manage codes.
- Admin can create code under approved rules; plaintext is returned only through intended creation flow.
- Stored data contains secure hashes, not bearer plaintext.
- Test malformed, duplicate, collision, disabled, expired, exhausted, replayed, and rate-limited code cases.
- Specifically test duplicate-hash behavior: a prior code must never be silently reactivated or have usage/disabled state reset by a collision/upsert path.
- Verify audit trail and rollback behavior.

### Test Group 4 — HIMS student activation and entitlement enforcement
- Student submits code in ordinary chat; server validates authenticated identity and grants only permitted entitlement.
- Invalid, expired, disabled, reused, forged-client-state, and cross-account attempts are denied safely.
- Race two activation attempts and verify exactly one permitted outcome and no duplicate entitlement.
- Change local storage/request body/profile flags and verify no privilege escalation.
- Revoke/disable behavior follows established business rules and remains auditable.
- Real student session is BLOCKED until safe owner-approved test accounts are available; never use personal credentials.

### Test Group 5 — HIMS content discovery, delivery, and ordinary-chat behavior
- Authorized student requests an available lecture; server verifies exact active resource mapping and returns safe delivery.
- Unauthorized student, inactive resource, wrong media mapping, missing content, expired link, and cross-student request are denied.
- General study questions answer naturally without unnecessary HIMS announcement.
- Greetings, small talk, unrelated requests do not trigger education lookup.
- Follow-ups such as “send it” resolve only with valid recent resource context.
- Test real lecture delivery only after owner provides/approves actual content source.

### Test Group 6 — Chat, streaming, history, and attachments
- Normal text chat, SSE chunk order, completion, timeout, reconnect, retry, duplicate submission, and error handling.
- Conversation creation, history, rename, pin/archive/delete semantics where supported.
- Attachment upload, validation, preview, ownership, and retrieval.
- Arabic/English messages, long messages, Unicode, RTL, and network interruptions.
- Verify no false claim that a model/tool ran when server routing did not confirm it.
- Verify the inline last-response model label appears only after a server-confirmed model event, is localized, and is cleared when a new response begins; verify no selected-profile label is presented as actual routing provenance.
- Verify retry clears the prior response's actual-model label and displays only the model identifier confirmed by the retry stream.

### Test Group 7 — Central Agent planning and durable task runtime
- Simple chat stays fast and does not spawn a task unnecessarily.
- Complex request creates bounded plan and dependency graph; verify valid ordering and no cycles.
- Worker limits, lease acquisition/renewal/fencing, checkpoints, timeout, retry, and crash recovery.
- Duplicate delivery/idempotency; no duplicate tool execution or charge.
- Provider outage/freeze and fallback rules remain bounded and truthful.
- Verify central Agent remains the single decision-maker; worker roles do not become independent assistants.

### Test Group 8 — Task cancellation, partial completion, and billing
- Cancel before queueing, while queued, before worker starts, during running work, and after partial completion.
- Only actually performed work is settled; unperformed reserved work is released.
- Concurrent cancellation/retry/completion races settle exactly once.
- Repeated callbacks and duplicate requests do not create duplicate ledger entries.
- Verify task status, user-facing explanation, and ledger agree.
- Verify queued cancellation is reported as cancelled-before-start, while a running cancellation is reported as a safe stop only after the worker confirms terminal cancellation; no premature success message.

### Test Group 9 — Model catalog, selector, permissions, and routing
- All four profiles (Lite/Pro/Max/Ultra) are displayed with accurate available/restricted labels.
- Subscription plan and selected model remain distinct.
- Unauthorized model request is denied server-side even if client is modified.
- Model version/capability/provider/cost metadata matches verified catalog.
- Disabled/frozen/unverified providers receive no new calls.
- Verify selected vs actual routed model is represented truthfully.
- If the catalog RPC fails or returns malformed data, no local fallback profile is selectable or represented as server-verified; Auto remains safe and the unavailable state is explicit.
- Switch between authenticated accounts while the catalog request is pending or failing; verify catalog verification resets and no prior-session profile state remains selectable.
- Verify Ultra remains unavailable unless its server catalog, permission, provider, and routing metadata are all verified.

### Test Group 10 — Studio, media generation, and media security
- Image/video/audio transcription workflows, validation, size/duration limits, quotas, and cost guardrails.
- Provider success, timeout, outage, disabled state, malformed response, and partial failure.
- Authenticated upload and private delivery; signed URL expiry and ownership.
- Agent-triggered media job from chat returns result to the same conversation and appropriate Studio/Library reference.
- Verify no cross-user media access and no charge for work not performed.
- Missing, zero, or unverified image-generation price must block both UI submission and server-side generation; no zero-cost assumption is allowed.
- Video/audio/transcription entries remain unavailable until their provider, execution path, verified pricing, and output delivery are configured.

### Test Group 11 — Library, files, and storage lifecycle
- List/search/filter/preview/download where supported.
- Owner-only metadata and object access; cross-user object IDs must fail.
- Signed URL scope/expiry, storage quota, unsupported files, malware/content validation if configured.
- Delete/archive/retention behavior and audit records.
- Verify generated outputs remain associated with the correct user/conversation/task.
- Audio MIME types are discoverable through the audio filter and labeled as audio without changing or corrupting the existing raw/document storage-kind contract.

### Test Group 12 — Projects and conversation grouping
- Create/list/update/archive/restore/delete projects.
- Link/unlink conversations with tenant consistency.
- Cross-user SELECT/INSERT/UPDATE/DELETE and cross-tenant foreign-key attempts fail.
- Project deletion preserves conversations according to defined nulling behavior.
- Confirm no duplicate Projects implementation or route conflict remains after PR reconciliation.
- Verify the `develop` implementation rather than merging stale PR #83 wholesale; compare route/navigation, project service, migration, isolation SQL, and CI workflow. Confirm the open branch's older workflow does not remove current Android/iOS export or newer regression coverage.
- Re-run the rollback-only two-user SQL isolation regression on an isolated test database; separately verify owner update, cross-user delete denial, project deletion `ON DELETE SET NULL (project_id)`, archived-project filtering, and project-aware new conversation creation.
- Confirm project navigation is reachable from the current chat navigation menu and does not replace the five primary navigation destinations.

### Test Group 13 — Subscription, credits, wallet, and financial integrity
- Monthly allowance grant and renewal semantics match approved policy and actual implementation.
- Purchased-credit never-expire policy is reconciled safely without altering historical balances.
- Test holds, settle, release, refund/adjustment where supported, idempotency, and immutable ledger.
- Concurrent spend, insufficient balance, duplicate webhook, failed provider, cancellation, partial usage, and retry.
- Verify source-level balance breakdown; no misleading combined percentage across pools with different expiry.
- Prices, FX, credit conversion, and quantities must be tested only against explicitly approved configuration; do not invent values or mutate real balances.

### Test Group 14 — Reward ads and promotional credits
- Only verified ad-network server callback can award a reward.
- Spoofed client completion, replayed callback, duplicate event, invalid signature, rate abuse, and concurrent claims fail safely.
- Caps, frequency, expiry, and award quantity match approved policy.
- Ledger attribution and balance update are atomic and idempotent.
- If no real ad-network integration is configured, mark monetized reward verification BLOCKED; do not treat a UI claim as revenue.

### Test Group 15 — Admin, roles, governance, and audit
- Enumerate admin/staff/student/user permissions for every admin screen and privileged RPC.
- Non-admin direct route/API/RPC access is denied.
- Provider/model/pricing/credit/reward/HIMS changes require correct role and are audited.
- Verify safe disable/quarantine, immutable audit trail, pagination/export privacy, and sensitive data masking.
- Check that admin UI hiding is not the only authorization control.

### Test Group 16 — Cross-platform UX, accessibility, localization, and performance
- Browser test across supported viewport widths and current target browsers; no black/blank screen or broken navigation.
- Android/iOS install/launch, back behavior, keyboard, safe areas, permissions, notifications, deep links, and background/foreground transitions.
- Light/dark/system theme, contrast, text scaling, touch target, screen reader labels/focus order.
- Arabic RTL and English LTR on every primary flow; verify mixed-direction text and numbers.
- Network loss/recovery, slow responses, memory/performance, long lists, and repeated task operation.
- Real device checks require actual devices; static bundles alone are insufficient.

### Test Group 17 — Full regression, release readiness, and recovery
- Run all prior groups against the integrated release candidate and record exact commit/migration versions.
- Run security regression, tenant isolation, financial reconciliation, task concurrency, HIMS, and route/deep-link suites.
- Verify backup/restore and migration rollback/recovery plan where supported.
- Review known issues, severity, monitoring/alerts, support runbook, release notes, and rollback owner.
- Verify production configuration and secrets without printing secret values.
- Produce a signed-off test report: PASS/FAIL/BLOCKED/NOT RUN per case, evidence links, residual risks, and explicit owner acceptance.
- Production deployment is a separate owner-authorized action; test completion does not grant deployment permission.

## 5. Entry criteria

Track B may begin only when:
1. All 17 Track A phases are integrated on the intended release candidate. Phase-level implementation is not held open merely because its comprehensive tests are pending; the deferred test inventory is carried forward into this campaign.
2. Development roadmap and build plan show evidence for all required acceptance criteria.
3. Migrations and environment configuration are reconciled; no unreviewed destructive change remains.
4. Test environments, safe test users, required content, and provider stubs/credentials are available without sharing secrets in chat.
5. The owner is informed that the build is ready for the comprehensive test campaign.

## 6. Exit criteria

Track B is complete only when:
- Every applicable case in all 17 groups is PASS, or explicitly BLOCKED/accepted by the owner with a documented reason and mitigation.
- No unresolved critical/high security or data-integrity defect remains without explicit owner acceptance and compensating controls.
- HIMS, chat/Agent, task cancellation/partial billing, credits, admin authorization, and cross-user isolation have evidence-backed results.
- Web, Android, and iOS have separate results; unavailable device/browser testing is not represented as passed.
- The final report includes exact commit SHA, workflow run IDs, test commands, artifacts/logs, migration versions, limitations, and recovery instructions.
- The owner explicitly decides whether to authorize production release.

## 7. Execution report template

For each test case record:
- Test ID and group;
- environment/platform and test account role;
- commit SHA and migration version;
- preconditions and isolated fixture IDs (never credentials);
- exact steps/command;
- expected and actual result;
- PASS / FAIL / BLOCKED / NOT RUN;
- evidence URL/log/artifact;
- defect severity and linked issue;
- cleanup confirmation and follow-up owner.

**Current campaign status:** NOT STARTED. Routine regression checks performed during development remain part of Track A and must not be represented as completion of this independent campaign.


## 8. Readiness snapshot — 2026-11-16

- Track B remains **NOT STARTED** by design; it must wait until Track A Phase 17 integration is complete.
- Routine focused regression tests continue under Track A.
- The first-four implementation verification inventory assigned to Track B includes: HIMS migration application in an isolated environment, duplicate-code collision/replay and rollback; real student activation and protected lecture delivery; ordinary-chat boundaries; current-commit CI; full design accessibility; and actual browser/device journeys.
- Phase 5/6 Track B cases include five-area route/deep-link navigation, mobile keyboard/safe-area and responsive web behavior, menu navigation, first authenticated app entry and all successful auth methods landing in Chat, empty-chat welcome and prompt chips, visible localized streaming/task status and stop action, model selector available/restricted states (including Ultra remaining unavailable until server catalog/routing is configured), actual server-reported model attribution, and chat/task lifecycle behavior.
- These deferred tests are not implementation blockers. Any defect they expose must be fixed on Track A/develop and then retested in Track B.
- No test is marked PASS unless it has a verified run/result. The new HIMS collision SQL regression is committed but not executed. The expanded theme Jest test and core chat/Home/HIMS semantic palette changes are committed but await a current-commit CI run.
