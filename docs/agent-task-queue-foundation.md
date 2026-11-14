# Agent task queue foundation

This branch introduces an additive durable queue primitive for SULY Agent. It does not change the existing chat or Brain request paths.

## Included

- `agent_task_jobs`: service-role-only durable job records, per-user idempotency keys, priority, retry budget, lease ownership, and terminal result/error fields.
- `claim_agent_task_jobs`: atomic claim with `FOR UPDATE SKIP LOCKED`; expired leases can be reclaimed, while exhausted jobs become failed.
- `heartbeat_agent_task_job`: renews a live lease only for its current worker.
- `finish_agent_task_job`: only the current lease owner can finish a running job.
- `_shared/agent_task_queue.ts`: typed enqueue/claim/heartbeat/finish helpers.

## Safety and deployment boundary

- No existing task/workspace/ledger rows are migrated, deleted, or rewritten.
- The migration is additive and is not deployed to the linked Supabase project by this branch.
- The queue table has RLS enabled, no client policies, and no grants for `anon` or `authenticated`; only `service_role` can access it.
- RPC execution is also restricted to `service_role`.
- Worker IDs and lease durations are bounded; payloads are JSON objects with a 64 KB client-side limit.
- This PR does not yet move `brain-router` or `ai-router` work onto the queue. Do that only after a worker runtime, cancellation semantics, and end-to-end tests are added.

## Next integration steps

1. Apply the migration to a staging Supabase project and verify grants/RLS using both an authenticated user JWT and the service role.
2. Add a supervised worker entry point that claims jobs, heartbeats during execution, and finishes only jobs it still owns.
3. Route Brain tasks through the queue behind a feature flag; preserve the existing synchronous endpoint as fallback during rollout.
4. Add live progress/history/cancel/resume UI and tests for lease expiry, duplicate enqueue, concurrent claims, retry exhaustion, and worker crashes.
5. After staging evidence, deploy the migration and worker; do not enable queued execution before the worker is deployed.

## Operational note

The existing `agent_workspaces`, `agent_workspace_steps`, and `task_ledger` remain the execution timeline and user-facing history sources for now. The new queue is a job-dispatch layer, not a replacement for those records.
