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
- The queue worker and scheduler still recognize only `brain_task`; generic job-handler registration and a general dependency-aware task graph remain unfinished.

### 4. Admin surfaces and data duplication

- `BrainSystemAdminScreen.tsx` edits the legacy `models`, `model_capabilities`, `brain_tiers`, and `plans` tables. It also reads operational models and links them by `legacy_ai_model_id`.
- `RouteModelChainsCard.tsx` edits `ai_route_model_assignments` for the operational catalog.
- `admin-service.ts` exposes provider/model synchronization and other admin operations.
- The two model catalogs and the two role/tier configuration surfaces are real sources of configuration overlap. They must not be independently edited long-term.

### 5. Additional legacy-shaped Agent registry

- Migration `036_agent_orchestration_ledger.sql` creates `agent_registry` and `task_ledger`.
- The schema stores agent prompts/fallback chains and task-to-agent assignments.
- Schema presence alone does not prove that the current runtime reads these records. Before removal or migration, trace every read/write call site, database policy, and historical data use.

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
- [ ] Generalize durable task jobs and worker handlers beyond `brain_task`.
- [ ] Add a dependency-aware task graph and parallel execution for independent steps.
- [ ] Unify retry/backoff, cancellation, lease recovery, and result synthesis across task types.
- [ ] Add end-to-end tests for duplicate enqueue, lease expiry, worker interruption, cross-user isolation, and usage finalization.
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

- Work only on `feat/agent-worker-brain-queue` until separately approved.
- Do not merge PR #47, deploy Edge Functions, or apply production migrations as part of this baseline.
- Do not delete user data, model/provider credentials, task history, usage ledgers, or existing migrations.
- Never expose service-role credentials to the mobile client.
- Any new routing decision must enforce plan, capability, health, and spend eligibility server-side.
- Every implementation task includes a review of touched files, call sites, dependencies, tests, and obsolete/duplicate code.
