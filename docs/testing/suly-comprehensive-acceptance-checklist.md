# SULY Comprehensive Acceptance Test Checklist

Status: Draft test plan — execute only after development code freeze  
Target branch: `feat/agent-worker-brain-queue`  
Test environment: dedicated test accounts and non-production test data  
Rule: Do not use real payments, destructive connector actions, or production user data during acceptance testing.

Record each case as **PASS**, **FAIL**, or **BLOCKED**. For every failure, capture the screen, timestamp, test account, request/task ID, and relevant Edge Function log correlation ID. Do not repeatedly create accounts or trigger email delivery while debugging rate limits.

## 1. Installation and app lifecycle

- [ ] Install the final APK on a clean Android device.
- [ ] Verify the APK installs, launches, and has a valid signature.
- [ ] Verify app name, icon, splash screen, and version/build metadata.
- [ ] Close and relaunch the app; confirm no startup crash or blank screen.
- [ ] Put the app in the background during a request, return, and verify a safe state.
- [ ] Force-stop and relaunch; confirm the signed-in session restores correctly.
- [ ] Install the final APK over the previous test build; confirm user session and local state behave as designed.
- [ ] Verify navigation, back button, keyboard, scrolling, and small-screen layout.

## 2. Authentication and session recovery

- [ ] Create a test account with a valid email.
- [ ] Confirm duplicate email registration gives a clear message.
- [ ] Confirm email verification opens the app through the correct deep link.
- [ ] Confirm a verified account lands on the authenticated screen, not a gray/blank callback screen.
- [ ] Sign in with email/password.
- [ ] Sign out and sign in again.
- [ ] Submit an incorrect password and verify a safe, understandable error.
- [ ] Test expired/invalid verification links.
- [ ] Test Google sign-in and callback/session restoration, if the OAuth provider is configured.
- [ ] Interrupt the network during sign-in; verify loading ends and retry is possible.
- [ ] Verify temporary profile-read failure does not erase a valid restored session.

## 3. Fast chat path

- [ ] Send a short greeting; verify direct chat mode and visible streaming.
- [ ] Ask a simple factual question; verify no unnecessary task-planning UI or delay.
- [ ] Verify first response text appears promptly and streaming completes.
- [ ] Send several consecutive messages; verify order and history are correct.
- [ ] Reopen a conversation; verify messages persist and display in order.
- [ ] Rename, pin, archive, restore, and delete a test conversation.
- [ ] Retry a failed request with the same request/message identity; verify no duplicate charge or duplicate assistant message.
- [ ] Cancel a streaming response; verify the UI stops and billing/request state is finalized safely.
- [ ] Disconnect the network mid-stream; verify a clear recoverable error.
- [ ] Send a long but valid message and verify length limits are handled safely.
- [ ] Verify explicit chat mode remains direct chat.
- [ ] Verify legacy requests without an execution mode remain backward compatible.

## 4. Central Agent and intent routing

- [ ] Send a simple request in auto mode; verify direct chat routing.
- [ ] Send a multi-step request; verify Agent routing.
- [ ] Ask for live/current information; verify the web-search tool is used only when appropriate.
- [ ] Ask a question that does not require live information; verify no accidental web-search routing.
- [ ] Attach a supported image/file; verify Agent/attachment path and safe response.
- [ ] Verify one central Agent makes the execution decision; workers do not independently choose plans or models.
- [ ] Verify Agent step count is bounded and the task ends in a clear terminal state.
- [ ] Verify malformed model decisions are rejected safely.
- [ ] Verify repeated identical tool calls are stopped.
- [ ] Verify tool output is treated as untrusted data, not as instructions.

## 5. Tools, connectors, and approval safety

- [ ] Verify connector status/read-only checks work for a connected test account.
- [ ] Verify a read request uses the correct connected service and returns relevant evidence.
- [ ] Verify a multi-service read is limited to supported read-only operations.
- [ ] Request a write action; verify it pauses and asks for explicit approval.
- [ ] Reject/cancel the approval; verify no external write occurs.
- [ ] Approve a harmless test write; verify exactly one action occurs.
- [ ] Replay the same approval/request; verify the write is not duplicated.
- [ ] Verify an expired or mismatched approval cannot authorize a write.
- [ ] Verify unregistered/disabled tools are rejected.
- [ ] Verify provider/connector errors never produce a false success message.

## 6. Queued Brain tasks through the central Agent

- [ ] Submit a short Brain task; verify it is accepted and receives a task/job ID.
- [ ] Verify the queue worker wakes and claims only the current user's job.
- [ ] Verify queued Brain execution reaches the central `ai-router` Agent path.
- [ ] Verify the legacy Brain tier/model catalog is not used for queued worker model selection.
- [ ] Verify task status moves from queued to running to completed.
- [ ] Verify the final result is persisted and visible after reopening the task screen.
- [ ] Verify task steps/status metadata are consistent with the returned Agent result.
- [ ] Submit the same task ID twice; verify idempotency and no duplicate charge.
- [ ] Simulate worker interruption; verify lease expiry and bounded recovery.
- [ ] Verify an expired worker cannot complete a job after another worker reclaims it.
- [ ] Verify retry exhaustion ends in a visible failed state.
- [ ] Verify user A cannot claim, read, or finish user B's task.
- [ ] Verify task cancellation and stale status recovery behave correctly.
- [ ] Verify credits are reserved once and finalized once on success.
- [ ] Verify failed terminal tasks release/finalize reserved usage correctly.
- [ ] Compare reserved usage, actual token usage, user credits, and provider cost records.

## 7. Model routing, limits, and economics

- [ ] Verify disabled models are never selected.
- [ ] Verify disabled/unhealthy providers are never selected.
- [ ] Verify required capability and role filters are enforced.
- [ ] Verify plan restrictions are enforced before selection.
- [ ] Verify a preferred model cannot override eligibility restrictions.
- [ ] Verify fallback re-runs the same eligibility checks.
- [ ] Verify per-request, daily, and monthly limits block excess usage.
- [ ] Verify provider-reported cost is distinguished from estimated cost.
- [ ] Verify user credits are not confused with provider operating cost.
- [ ] Verify usage records include request/task identity, model/provider, tokens, latency, and outcome.

## 8. Data isolation and security

- [ ] Verify authenticated users can read only their own conversations and task status.
- [ ] Verify cross-user task/job IDs do not disclose payloads or results.
- [ ] Verify queue payloads and lease fields are not exposed to normal clients.
- [ ] Verify service-role credentials are absent from the APK and client bundle.
- [ ] Verify only the publishable/anon key is present client-side and RLS protects data.
- [ ] Verify malformed IDs, oversized payloads, and invalid JSON are rejected.
- [ ] Verify internal worker endpoints reject missing/invalid internal authentication.
- [ ] Verify write tools require the correct request-bound user approval.
- [ ] Verify prompt injection inside retrieved documents/tool results cannot trigger unauthorized actions.

## 9. Credits, profile, and account experience

- [ ] Verify wallet balance loads and refreshes correctly.
- [ ] Verify usage/transaction history matches server records.
- [ ] Verify insufficient credits produces a clear message without starting paid work.
- [ ] Verify account/profile information loads and updates.
- [ ] Verify banned/maintenance states are handled safely.
- [ ] Verify welcome credits only appear after the relevant migration is approved and applied; do not assume they are active beforehand.

## 10. Admin and operations

- [ ] Verify admin access is restricted to authorized accounts.
- [ ] Verify provider/model configuration changes are reflected by the router.
- [ ] Verify model role/capability/plan assignments are consistent.
- [ ] Verify health and usage metrics distinguish success, failure, latency, and cost.
- [ ] Verify queue jobs can be diagnosed without exposing secrets or private payloads.
- [ ] Verify logs contain correlation IDs and useful safe error codes.
- [ ] Verify no admin screen claims that legacy Brain configuration controls queued Agent routing.

## 11. Release gate

- [ ] All automated Deno tests pass.
- [ ] Expo TypeScript typecheck passes.
- [ ] Mobile regression tests pass.
- [ ] AI router deployment bundle is current and verified.
- [ ] No unresolved critical/high security issue is introduced by this change.
- [ ] All required migrations are reviewed and their target environment is explicitly confirmed.
- [ ] Edge Function deployment order and rollback plan are documented.
- [ ] Final APK is built once from the frozen commit and its build SHA is recorded.
- [ ] All device acceptance tests above are recorded as PASS/FAIL/BLOCKED.
- [ ] PR #47 is reviewed; merge to `release/v1` requires separate explicit approval.
- [ ] Production Edge Function deployment and production migrations require separate explicit approval.

## Test result summary

| Area | Result | Notes / issue IDs |
|---|---|---|
| Installation and lifecycle | Pending | |
| Authentication | Pending | |
| Fast chat | Pending | |
| Central Agent routing | Pending | |
| Tools and approvals | Pending | |
| Queued Brain tasks | Pending | |
| Model routing and economics | Pending | |
| Security and data isolation | Pending | |
| Credits and profile | Pending | |
| Admin and operations | Pending | |
| Release gate | Pending | |
