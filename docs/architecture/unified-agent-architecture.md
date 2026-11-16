# Unified SULY Agent Architecture

Status: approved target architecture; migration in progress  
Branch: `feat/agent-worker-brain-queue`  
Last reviewed: 2026-11-15

## Product decision

SULY will have one central AI Agent orchestrator. It is the only component that decides whether a request should be answered directly, clarified, routed to a tool, or decomposed into a multi-step task.

This does **not** mean one model or one process must do everything. The central Agent may dispatch bounded worker executions and tools, but workers are executors, not independent competing orchestrators. Model providers are interchangeable execution resources selected by one routing policy.

The default path must optimize time-to-first-token: simple chat should use a direct eligible chat model and stream immediately. Planning, parallel workers, and review are conditional paths for requests that need them.

## Verified current implementation

### 1. General AI request path

- Entry point: `supabase/functions/ai-router/index.ts`.
- It loads the operational catalog from `ai_models`, providers from `ai_providers`, and role assignments from `ai_route_model_assignments`.
- It already supports role-based ordering for `chat`, `planner`, `worker`, `reviewer`, and `summarizer`.
- It imports and invokes the provider-neutral `runAgentLoop` from `agent/orchestrator.ts`.
- The request execution mode currently defaults to `agent`; only an explicit `execution_mode: "chat"` selects the non-agent chat path. This default must be reviewed before changing client behavior because legacy requests may rely on Agent tools.
- The Agent loop has bounded steps, validates model decisions, checks registered tools, and requires confirmation for write-effect tools. Queued Brain worker calls now enter this same loop; they are no longer routed through Brain's separate planner/worker/merger model-selection loop.
- `agent/model_routing.ts` only moves a preferred model to the front if it is already in the eligible candidate pool; it does not independently grant eligibility.

### 2. Separate Brain path

- Entry point: `supabase/functions/brain-router/index.ts`.
- For queued tasks, it now acts as an intake, authentication, usage-reservation/finalization, and result-persistence adapter. The worker path calls `ai-router` with the internal Brain identity and `execution_mode: "agent"`; the central Agent owns model selection, planning, tool policy, execution, and review.
- The queued worker path no longer loads or uses `brain_tiers` / `models` for model selection. The legacy synchronous Brain execution path and its tables/admin screen remain for compatibility and must be audited before retirement.
- Brain still owns its task contexts and usage reservation/finalization contract so existing mobile task status and credit behavior remain compatible.

### 3. Queue worker

- Entry point: `supabase/functions/agent-task-worker/index.ts`.
- The worker currently accepts only `brain_task`; unsupported job types are failed.
- It claims one job, renews a lease, calls `brain-router`, and finalizes the queue job. For queued Brain jobs, `brain-router` delegates the actual work to the central `ai-router` Agent.
- The queue worker and scheduler still recognize only `brain_task`; generic job-handler registration and a general dependency-aware task graph remain unfinished.\n- Queued-only cancellation is implemented through an owner-checked atomic RPC. It marks the queue row, Brain context, and pending/running Brain steps as cancelled and releases the unused Brain usage reservation exactly once. Running jobs remain untouched until cooperative abort and partial-usage settlement are proven end-to-end.
- Expired worker leases are now requeued once with bounded exponential backoff (15s, 30s, then capped at 5 minutes); exhausted attempts become terminal. The database claim RPC owns this transition so scheduler ticks cannot repeatedly extend the same retry delay.

### 4. Admin surfaces and data duplication

- `BrainSystemAdminScreen.tsx` edits the legacy `models`, `model_capabilities`, `brain_tiers`, and `plans` tables. It also reads operational models and links them by `legacy_ai_model_id`.
- `RouteModelChainsCard.tsx` edits `ai_route_model_assignments` for the operational catalog.
- `admin-service.ts` exposes provider/model synchronization and other admin operations.
- The two model catalogs and the two role/tier configuration surfaces are real sources of configuration overlap. They must not be independently edited long-term.

### 5. Additional legacy-shaped Agent registry

- Migration `036_agent_orchestration_ledger.sql` creates `agent_registry` and `task_ledger`.
- The schema stores agent prompts/fallback chains and task-to-agent assignments.
- Schema presence alone does not prove that the current runtime reads these records. Before removal or migration, trace every read/write call site, database policy, and historical data use.

### 6. Capability evidence and runtime eligibility

- Operational text-model evidence is stored in `ai_model_capability_evidence`, keyed by the exact `ai_models.id` and capability. Media evidence is stored separately in `suly_media_model_capability_evidence`, keyed by provider, service type, exact gateway model ID, and capability.
- Each record separates provider/upstream documentation claims from provider probe results and SULY integration results. Evidence URLs are required for every non-unknown claim or test outcome, and all writes go through admin-guarded, audited RPCs.
- The central router loads evidence for its enabled candidates. It only blocks a candidate when the exact required capability is explicitly unsupported or a provider/SULY probe failed. Unknown or missing evidence preserves legacy `capabilities_json` routing, preventing an unverified catalog entry from breaking existing chat.
- A provider probe can validate a gateway-specific alias even when upstream documentation uses a different model ID. A passing SULY integration test is the strongest evidence and is authoritative for that exact provider/model/capability tuple.
- Connector availability (Gmail, Drive, GitHub) remains controlled by the connector registry and authorization layer; it is not inferred from native model modality claims.
- Image-generation runtime activation requires both provider and SULY integration evidence to be passed. Price records and advertised capabilities alone never activate a media model or permit user billing.

## Target architecture

```text
Client
  |
  v
Unified Agent API / Orchestrator
  |-- Fast path: direct eligible chat model -> streamed response
  |-- Tool path: policy + registry -> approved tool execution
  |-- Task path: plan -> durable task graph -> worker pool
  |                                  |-> parallel independent steps
  |                                  |-> bounded retries / lease recovery
  |                                  |-> optional result synthesis
  |
  v
Unified Model Router
  |-- capability eligibility
  |-- task/role suitability
  |-- plan entitlement
  |-- provider/model availability and health
  |-- user, plan, daily and monthly spend limits
  |-- configured priority and cost/latency policy
  |-- safe fallback within the same eligibility constraints
  |
  v
Provider adapters -> model APIs
  |
  v
Usage / cost / latency / outcome ledger
```

Workers are execution capacity under the central Agent. They do not make independent plan, entitlement, or model-selection decisions. All model calls pass through the same eligibility and accounting policy.

## Model eligibility and fallback rules

A model can be selected only if all applicable checks pass:

1. Model and provider are enabled and healthy.
2. Required capabilities are declared and match the task.
3. The model is allowed for the requested role/task.
4. The user's plan permits the model/feature.
5. Daily, monthly, per-request, and concurrency budgets permit the call.
6. Credentials and provider configuration are available.

Priority, latency, and actual provider cost rank the eligible candidates; they do not override eligibility. Fallback must re-run the same checks. A configured preferred model that is not eligible must never be forced into the candidate list.

A model may support multiple capabilities, roles, and plans through relations/configuration; do not create duplicate model records for each role or plan.

## Performance policy

- Mobile chat sends `execution_mode: "auto"`. The server preserves explicit `chat` and `agent` modes and resolves `auto` using the deterministic intent classifier.
- Auto requests classified as chat or single-reply tasks use the direct streaming model path. Complex tasks, connected-app operations, live web search, attachments, and internal Brain calls remain on the Agent path. Internal Brain worker calls now execute the same bounded Agent loop and unified model eligibility rules.
- Legacy clients that omit the execution mode remain Agent-compatible.
- Direct chat does not create an Agent workspace or task-ledger rows; request/message/usage records remain in place. Durable workspace tracking is reserved for Agent and split-task execution.
- Simple chat: no planner, worker queue, or merger hop. Select a chat-eligible model and stream its first token as soon as possible.
- Tool request: use the Agent decision loop only when tools are needed; keep tool count and payloads bounded.
- Complex task: create a durable plan and execute independent steps concurrently where dependencies allow.
- Synthesis/review: invoke only when the task needs consolidation or quality checks.
- Record time-to-first-token separately from total completion time.

## Cost and profitability policy

Record each provider attempt with model/provider identity, user/request/task IDs, input/output tokens, provider-reported cost when available, calculated estimate when not, latency, status, and fallback reason.

Never label a calculated estimate as an invoice-confirmed cost. Keep separate:
- provider operating cost,
- user credit/entitlement consumption,
- recognized revenue,
- gross contribution / estimated margin.

Daily and monthly budgets must be enforced server-side, not only displayed in the admin UI. A user-facing credit price is not the same thing as provider cost.

## Incremental migration plan

### Phase 0 — Baseline and dependency map (this change)
- Record verified entry points, data stores, routing paths, and duplicate configuration.
- Keep both paths operational while mapping all call sites and production dependencies.
- No production schema changes, deletes, or deployment.

### Phase 1 — Define a single routing contract
- Specify one canonical model/provider/capability/role/plan/budget contract.
- Add compatibility adapters for existing Brain and general AI records.
- Add tests for eligibility, plan restrictions, limits, priority, and fallback.
- Do not backfill or drop legacy tables until data parity and call-site coverage are proven.

### Phase 2 — Fast-path central Agent
- Make simple chat use the direct streaming path.
- Keep the existing tool safety/approval checks.
- Add latency and route observability.
- Preserve legacy request compatibility while clients are migrated.

### Phase 3 — Unified task orchestration (in progress)
- [x] Route queued Brain execution through the central Agent API; retain Brain only as the compatibility intake/usage/result adapter.
- [x] Stop using the legacy Brain model/tier catalog for queued worker model selection.
- [x] Reuse the central Agent's intent classifier, model eligibility, parallel independent-part execution, and quality review for queued Brain tasks.
- [x] For eligible complex Agent requests, select workers from the `worker` role pool (not the planner pool); only independent explicit list items may run in parallel, up to three workers. Connector, attachment, and live-search requests remain on their dedicated Agent paths.
- [x] Persist central Agent steps into the existing Brain task-progress table and return actual/estimated token usage for Brain accounting.
- [x] Recover duplicate queue submissions by the same task ID and return an already-persisted task result after worker reclamation.
- [ ] Generalize durable task jobs and worker handlers beyond `brain_task`.
- [x] Execute explicit dependency-ordered user lists as a validated DAG: prerequisite steps run first, completed outputs are passed to dependent workers, and a failed prerequisite blocks only its descendants.
- [ ] Add model-generated general DAG planning with branching/merging dependencies; current inferred DAGs are intentionally limited to explicit ordered lists (up to three concurrent workers).
- [x] Add bounded exponential backoff for expired leases and preserve terminal failure after maximum attempts.
- [x] Add owner-checked, atomic cancellation for tasks still queued; the unused Brain token reservation is released exactly once and progress rows are marked cancelled.
- [ ] Add cooperative cancellation for running tasks after provider abort propagation and partial-token accounting are proven; running jobs are intentionally not mutated by the queued-only RPC.
- [ ] Add authenticated end-to-end tests for duplicate enqueue, lease expiry, worker interruption, cross-user isolation, and usage finalization.
- Keep worker execution separate from orchestration policy.

### Phase 4 — Unified admin and economics
- One model detail page for provider, model ID, capabilities, roles, plans, daily/monthly limits, actual/estimated cost, latency, health, and request history.
- One source of truth for routing assignments and plan eligibility.
- Retire duplicate admin screens only after all required operations are available in the unified UI.

### Phase 5 — Safe retirement
- Prove old tables/functions/screens have no live callers.
- Compare legacy and canonical data and verify rollback paths.
- Migrate data additively, monitor, then deprecate old paths.
- Delete legacy code/schema only in a separately reviewed change after production verification and explicit approval.

## Non-negotiable safety rules

- Implement changes on focused feature branches and merge to `release/v1` only after review and passing CI.
- Production Edge Function deployments and additive migrations are permitted when explicitly authorized, reviewed, regression-tested, and verified; destructive data/schema changes remain separately gated.
- Do not delete user data, model/provider credentials, task history, usage ledgers, or existing migrations.
- Never expose service-role credentials to the mobile client.
- Any new routing decision must enforce plan, capability, health, and spend eligibility server-side.
- Every implementation task includes a review of touched files, call sites, dependencies, tests, and obsolete/duplicate code.


### Queue hardening follow-up
- User-triggered and scheduled workers now share one Brain payload validator for owner match, UUID task ID, trimmed non-empty objective, and the 50,000-character limit.
- Retry SQL regression coverage checks the 15s first retry, 30s second retry, no repeated delay extension while queued, and terminal exhaustion after the configured attempts.
- Brain model admin saves now upsert selected capability links before removing deselected links. A failed capability write no longer deletes all previously working links; tier/plan update errors are surfaced.
- Queued-only cancellation is now live and billing-safe. Running cancellation remains deferred until worker/provider abort propagation and partial-token accounting can be reconciled safely.


### Stage 2 production verification (2026-11-15)
- PR #70 is merged; `ai-router` was deployed as active version 44. Explicit ordered user lists with dependency language are represented as sequential DAGs, while independent lists remain parallel (bounded to three workers).
- PR #71 is merged; `cancel_agent_task_job(uuid)` is deployed. Authenticated callers can cancel only their own queued jobs. `anon` and `public` cannot execute the RPC; authenticated callers cannot execute `brain_finalize_usage` directly.
- Production SQL regression harness passed inside a transaction and rolled back. It covered user ownership, duplicate enqueue, lease expiry/backoff, queued cancellation, exactly-once reservation release, protection of running jobs, cross-user isolation, and usage finalization/overage. A post-test query confirmed no regression rows remained.
- `task_ledger` has a runtime write path in `ai-router/index.ts` for Agent workspaces. The legacy `agent_registry` remains under audit; do not assume it is the live tool registry or remove it until all database and admin call sites are mapped.
- Remaining Stage 2 gaps: model-generated branching/merging DAG planning; cooperative running-task cancellation; generic job handlers beyond `brain_task` only when a real producer is introduced; authenticated HTTP/JWT integration and concurrency tests; and a full legacy synchronous Brain routing/catalog retirement audit.

### Dependency-aware execution
- Added a bounded DAG executor to the central Agent worker path. It validates the plan before starting, runs ready independent steps in bounded waves, passes completed prerequisite outputs to dependants, and blocks only descendants of failed steps while allowing unrelated branches to continue.
- The current plan builder supports explicit independent lists and explicit ordered lists with dependency language (converted to a sequential DAG). Arbitrary model-generated branching/merging DAGs and durable cross-invocation DAG resumption remain follow-up work.


### Brain usage accounting hardening
- Brain finalization now records actual token usage even when it exceeds the enqueue-time reservation, stores the excess in `overage_tokens`, and includes the full actual amount in daily usage.
- Finalization remains idempotent: repeated calls return the already-finalized totals without releasing/counting tokens twice.
- The additive Brain usage overage-accounting migration is applied to production. Regression coverage verifies actual usage above reservation and idempotent finalization.


### Admin queue observability
- Added an admin-only SECURITY DEFINER overview RPC guarded by `suly_is_admin()`. It returns queue counts, expired leases, oldest queued timestamp, and recent task metadata.
- The RPC intentionally omits payloads and results. A new Admin Dashboard card displays queue health and recent job status without exposing task contents.
- The additive admin queue-observability migration is applied to production; its admin-only RPC omits payloads and task results.
