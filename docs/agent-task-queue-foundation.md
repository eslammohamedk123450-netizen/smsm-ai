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


## Background Brain execution

The second migration adds a user-scoped claim parameter and `get_agent_task_job_status`. The mobile app submits Brain tasks with `mode: "enqueue"`, then wakes `agent-task-worker` using its normal signed-in session. The worker validates that session and can claim only jobs belonging to that user. It then continues through the trusted internal Brain route and updates the queue result.

The worker uses Supabase Edge Runtime `waitUntil` for post-response execution and renews its lease while running. This is a first production-shaped worker, but not a substitute for a separately hosted long-running worker service: Edge Runtime execution limits can still interrupt very long tasks. Lease expiry and idempotent completed-task recovery protect against duplicate completion. Long-duration tasks, cancellation, and multi-worker throughput remain follow-up hardening.


## Tool registry hardening

The Agent runtime now reads the `enabled` flags from `agent_tool_registry` on each request. The database can disable or enable only adapters that are already implemented in the code allowlist. Provider, effect type, write-approval requirement, and input schema remain code-controlled, so a database row cannot turn a write tool into a read tool or invent an executable adapter. Tool inputs are now checked recursively for JSON types, required fields, array bounds, string bounds, enums, patterns, and additional-property rules. Adding a new integration still requires an audited adapter implementation and a matching registry seed.


The task-status read path uses a narrow column grant plus an owner-only RLS policy and a SECURITY INVOKER RPC. Clients can read status/result for their own task, but cannot read queue payloads, worker lease data, or other users' jobs.


## Authentication handoff
The authenticated worker validates the caller's JWT before claiming work, then forwards that same short-lived user JWT to Brain Router. Brain Router uses the service-role secret only as a private internal-call proof, while its nested ai-router model calls still receive the verified user JWT required by ai-router authentication. The service-role key is never returned to or stored by the mobile client.
