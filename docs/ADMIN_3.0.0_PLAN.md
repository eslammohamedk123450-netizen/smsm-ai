# SULY Admin 3.0.0 — Unified Administration Plan

> **Document status:** Planning specification  
> **Target branch:** `develop`  
> **Version:** Admin 3.0.0  
> **Implementation status at document creation:** Not started — 0% verified  
> **Important:** This document records the intended replacement and consolidation plan. It does not claim that the UI, backend, database, or integrations have been implemented.

## 1. Executive goal

Deliver one coherent SULY administration system for AI operations, model/provider management, routing, credits, pricing, subscriptions, Studio, analytics, HIMS, and **Ads & Rewards**. The result must replace overlapping administration surfaces rather than create a second parallel system.

The admin experience must be organized, icon-led, responsive, easy to navigate, and visually consistent with SULY Midnight Gold Luxury:
- Background: `#080B14`
- Surface: `#151A27`
- Secondary surface: `#252B3A`
- Gold: `#D4AF37`, `#B88A2B`
- Text: `#F5F0E2`
- Typography: Inter / Tajawal

## 2. Non-negotiable engineering and delivery rules

1. **No new branches.** Work only on the existing `develop` branch. Do not create feature, temporary, backup, or alternative branches.
2. **Do not modify production while implementing this plan.** Preserve `release/v1` and its deployment configuration.
3. **One system, not old plus new.** The target is a single canonical admin experience and a single source of truth for each domain.
4. **Replace, do not duplicate.** Inventory existing pages, routes, tables, functions, settings, and permissions before changing them. Map each existing capability to its final location. Reuse or migrate valid data and behavior. Retire obsolete duplicates only after parity and migration checks pass.
5. **No parallel legacy/new implementations.** Do not leave two active model registries, two pricing engines, two credit ledgers, duplicate ad managers, or competing admin routes.
6. **No blind deletion.** Back up/migrate required data, verify references and dependencies, test the replacement, then remove obsolete code and schema safely.
7. **Verify every addition.** For each feature, verify its navigation entry, route, permissions, UI, backend behavior, persistence, error handling, and tests. A visual placeholder is not a completed feature.
8. **Track truthful completion.** Every work item must be marked exactly one of:
   - `[x] COMPLETED — 100%`: implemented and verified by the defined tests.
   - `[~] PARTIAL`: some work exists; remaining work and blockers are stated.
   - `[ ] NOT COMPLETED`: not implemented or not verified.
   Do not mark a task complete based only on code being written or a page rendering.
9. **Icons throughout.** Navigation, providers, model capabilities, keys/secrets, settings, actions, status indicators, and shortcuts should use clear consistent icons with accessible labels/tooltips. Do not make icons ambiguous or remove text labels where they are needed for clarity.
10. **Security first.** Provider credentials and AdMob identifiers/configuration must be managed server-side where secret; never expose private API keys or service secrets in client bundles, logs, or Git history.
11. **Preserve HIMS.** HIMS remains a core system and must be integrated into the unified navigation and permission model, not deleted, disabled, or silently replaced.
12. **No false progress reports.** Report commits, tests, deployment, and completion only when confirmed by actual repository/tool results.

## 3. Unified navigation and information architecture

Use one collapsible sidebar. Each item has an icon, a concise label, active state, and tooltip when collapsed.

| Icon concept | Navigation label | Main responsibility |
|---|---|---|
| Layout dashboard | Overview | Global operational and financial summary |
| Brain / network | AI Models | Unified model registry and model detail pages |
| Building / plug | Providers | Provider accounts, connections, capabilities, credential status |
| Git branch / route | AI Routing | Policies, quality tiers, fallbacks, region and capability routing |
| Bot | Agent Management | Agent policies, planning/execution/review stages, tools and limits |
| Images / film | Studio Management | Image, video, audio, transcription and voice capabilities |
| Wallet | Credits & Wallet | SULY Credits, reservations, charges, refunds and ledger |
| Tags / calculator | Pricing & Profit | Cost schedules, selling rates, margin and price history |
| Gem / users | Plans & Subscriptions | Free, Pro, Max, Ultra and Team entitlements |
| Megaphone / gift | Ads & Rewards | Ad provider IDs, ad units, rewarded ads and reward rules |
| Chart | Analytics & Reports | Usage, performance, revenue, costs and reconciliation |
| Users / shield | Users & Access | Roles, permissions, sessions and audit |
| Hospital / layers | HIMS | Existing HIMS capabilities, preserved and integrated |
| Settings | System & Audit | Feature flags, health, configuration and change history |

The Overview page combines KPI cards with operational activity. Model management supports both compact table and card views. Sidebar collapse must preserve icon meaning and accessible tooltips.

## 4. AI Model Registry and complete model details

### 4.1 Model catalogue

A single registry for OpenAI, Anthropic Claude, Google Gemini, and additional providers through provider adapters. A model record includes:
- Internal SULY model ID and display name.
- Provider and exact provider model ID.
- Model version/snapshot and lifecycle status.
- Capabilities: text, vision, reasoning, tools, structured output, image/audio/video capabilities as applicable.
- Context window, maximum output, supported input/output modalities.
- Region availability, data-processing constraints and provider restrictions.
- Tool/function calling support and structured response support.
- Health, latency, error rate, rate limits and concurrency.
- Enabled SULY surfaces: Chat, Agent stages, Studio where supported.
- Quality eligibility: Standard, Medium, Max.
- Routing priority and fallback eligibility.

### 4.2 Model detail page

One standard detail page for every model, with capability-specific sections shown only when relevant:
1. **Overview:** identity, provider, version, status, health, usage summary and service distribution.
2. **Configuration:** model IDs, limits, capabilities, timeout, concurrency, enable/disable and maintenance controls.
3. **Pricing:** input/output/cached/reasoning token rates where applicable; image, audio, video, per-request or per-job rates where applicable; selling price; currency; effective dates; pricing version.
4. **Routing:** eligible services, Agent stages, task types, quality levels, regions, fallback priority and budget constraints.
5. **Usage:** input/output/cached/reasoning usage, request counts, task categories, quality, user plan, region and time range.
6. **Financials:** provider cost, recognized revenue from consumed usage, gross profit, gross margin, discounts, refunds and reconciliation status. Unspent prepaid credits are shown separately as outstanding liability, not profit.
7. **Transactions:** trace ID, request/task/conversation ID, user reference, service, Agent stage, model/version, token or media usage, cost, credit reservation/settlement/refund, latency, retries and error.
8. **Health:** connectivity, latency percentiles, availability, error rates, quota/rate limits and alerts.
9. **Versions & Audit:** configuration and pricing revisions, actor, timestamp, before/after values and approvals.

### 4.3 Pricing and financial rules

- Distinguish **markup** from **gross margin**:
  - Markup = (selling price − cost) / cost.
  - Gross margin = (selling price − cost) / selling price.
- Preserve the provider cost, exchange rate and pricing version used at the time of every transaction.
- Reconcile API-reported usage with provider invoices when invoice data is available.
- Do not assume all AI usage is token-based. Media providers may bill per image, second, minute, generation, or job.
- Report provider cost, consumed-credit revenue, refunds/discounts, unspent prepaid credit liability and operational expenses separately.

## 5. Ads & Rewards — new unified admin section

### 5.1 Purpose

Add one top-level navigation item named **Ads & Rewards (الإعلانات والمكافآت)**. It is the single place where an authorized admin configures ad providers, application IDs, ad unit IDs, placements, reward rules, availability, limits, and ad performance.

### 5.2 Ads & Rewards dashboard

Show:
- Provider connection/configuration status.
- Android and iOS app configuration status.
- Active ad units by format.
- Rewarded-ad availability and successful reward completions.
- Impressions, completed views, fill rate, eCPM and estimated revenue when supplied by the provider.
- Failed loads, playback failures, reward-verification failures and disabled placements.
- Recent configuration changes and alerts.

### 5.3 Provider and application identifiers

Provider adapters should allow AdMob first and leave room for another supported provider without duplicating the ad-management system.

For AdMob, provide separate fields and records for:
- Provider account/label and connection status.
- Android App ID.
- iOS App ID.
- Android Ad Unit IDs.
- iOS Ad Unit IDs.
- Environment: test or production.
- Platform and ad format association.
- Identifier status: draft, verified, active, disabled, archived.
- Created/updated timestamps and admin audit history.

Never confuse an **App ID** with an **Ad Unit ID**. Show the correct icon, platform label and copy action for each identifier. Do not display private service credentials as ordinary IDs.

### 5.4 Ad formats and placements

Support configuration for formats only when the selected provider and app integration actually support them:
- Rewarded ads — primary format for earning SULY Credits or another explicitly configured reward.
- Interstitial ads.
- Banner ads.
- Native ads.
- App-open ads.

For each ad unit, configure:
- Name and internal ID.
- Provider and platform.
- Ad format and provider Ad Unit ID.
- Placement/screen where it may appear.
- Enabled/disabled state.
- Test/production mode.
- Frequency cap and cooldown where supported.
- Availability rules and fallback behavior.
- Last verification and health state.

### 5.5 Reward rules

For rewarded ads, allow admins to configure:
- Reward type: SULY Credits or another supported reward type.
- Reward amount.
- Eligible user plans and regions.
- Daily earning limit and per-session limit.
- Cooldown between completed rewards.
- Minimum completion/verification conditions.
- Campaign start/end dates and active state.
- Whether the reward is temporarily paused.
- User-facing reward explanation and terms.

**Critical integrity rule:** never grant a reward merely because the client says an ad was watched. Verify the provider callback/server-side verification (SSV) where supported, enforce idempotency, and write the reward to the same canonical wallet/credit ledger used by the rest of SULY. A repeated callback must not grant the reward twice.

### 5.6 User flow and failure handling

1. User requests a rewarded ad.
2. Backend checks eligibility, campaign state, regional rules, daily limits and cooldown.
3. App requests/loads the configured ad unit.
4. Provider reports completion.
5. Backend verifies the completion callback/SSV where available.
6. Reward is recorded once in the canonical SULY ledger.
7. User sees confirmed reward and updated balance.

If an ad fails to load, is skipped, or cannot be verified, do not issue the reward. Show a clear retry/temporarily unavailable state without charging the user.

### 5.7 Privacy, consent and regional controls

- Integrate the consent flow required by the chosen provider and applicable regions.
- Configure age/privacy restrictions and non-personalized ad behavior where required.
- Do not infer that a user is eligible solely from IP location.
- Keep region availability, consent state and ad targeting controls explicit and auditable.
- Avoid logging sensitive advertising identifiers unnecessarily.

### 5.8 Ads analytics and transaction records

Filter by date, provider, platform, ad format, placement, campaign, region and app version. Track:
- Requests, loads, impressions and completed views.
- Fill rate and show rate.
- Reward verification success/failure.
- Rewards granted, rejected and deduplicated.
- Estimated ad revenue and provider-reported revenue where available.
- eCPM and performance trends.
- Load latency and error codes.

Each reward transaction should link to a unique reward event ID, provider event/verification reference where available, user, ad unit, placement, campaign, reward amount, ledger entry, timestamp and final status. Ad revenue is reported separately from AI usage revenue and must not be double-counted.

## 6. Routing, quality and service boundaries

- Chat, Agent and Studio remain distinct product surfaces using the same model registry, provider adapters, routing policy and usage ledger.
- Standard, Medium and Max are user-facing quality preferences, not provider model names.
- A subscription determines entitlements, quotas and priority; it does not guarantee a specific model or quality result.
- Route by task intent, required capability, quality, region/data rules, provider health, latency, available budget and user entitlement.
- Never select a cheaper model that lacks the required capability.
- Agent stages may include intent detection, planning, execution and review, but do not force every request through every stage.
- Ordinary coding questions or explanations must not be routed to Studio unless the actual request requires a Studio capability.

## 7. Credits, wallet and subscriptions

- Use one canonical SULY Credits ledger.
- Use reservation → settlement based on verified actual usage → refund/release of unused reservation.
- Prevent duplicate charges and duplicate rewards with idempotency keys.
- Failed provider calls and retries must not cause unintended duplicate charges.
- Keep purchased, promotional, rewarded and refunded credits distinguishable in ledger metadata.
- Support configurable top-ups and packages; final prices and entitlements remain subject to product approval.
- Plan names: Free, Pro, Max, Ultra and Team.

## 8. Roles and permissions

Suggested permission groups:
- Owner: full access and critical approvals.
- Super Admin: system administration within owner policy.
- AI Operations: providers, models, routing and reliability.
- Finance: pricing, costs, revenue, refunds and reconciliation.
- Ads Operations: ad IDs, placements, reward campaigns and ad analytics.
- Support: user and transaction lookup with restricted sensitive data.
- Analyst: read-only reports.

Use least privilege, server-side authorization, audit logs and explicit approval for sensitive changes.

## 9. Architecture principles

Prefer a modular core within the current application/backend architecture rather than splitting every domain into a new microservice prematurely.

Conceptual flow:

```text
SULY Admin / Client
        |
Authenticated API + RBAC
        |
Unified SULY Core
  |       |        |        |
Models  Routing  Credits  Ads & Rewards
  |       |        |        |
Provider Adapters / Verified Events
        |
Canonical Usage, Wallet & Audit Ledgers
        |
Unified Admin Analytics
```

- Provider adapters isolate vendor-specific APIs.
- Model registry and ad-provider registry are separate domain records but use consistent provider integration patterns.
- The credit wallet is the sole authority for SULY Credits.
- Ads reward verification writes to that same wallet; it must not create a second reward balance.
- All admin mutations create audit events.
- Secrets remain server-side and are never committed to the repository.

## 10. Consolidation and replacement procedure

1. Inventory all existing admin pages, routes, components, database objects, edge functions, permissions and configuration sources.
2. Produce a capability map: existing location → target Admin 3.0.0 location → reuse/migrate/replace/retire decision.
3. Identify duplicate or conflicting systems, especially model registry, provider settings, pricing, wallet/credits, ads/rewards and analytics.
4. Select one canonical implementation for each domain.
5. Migrate required records and configuration with integrity checks.
6. Replace old navigation/routes with the unified Admin 3.0.0 structure.
7. Update all callers to use the canonical services and records.
8. Verify no active duplicate route, table, ledger, scheduler, reward handler or settings source remains.
9. Run regression, security, permission, migration and end-to-end tests.
10. Retire obsolete components only after verified parity and safe migration.
11. Report exactly what is complete, partial, blocked or not started.

## 11. Delivery phases and completion tracking

All statuses below are **NOT COMPLETED** until implementation and verification evidence exists.

| Phase | Scope | Status |
|---|---|---|
| 0 | Repository audit, existing Admin inventory, duplicate-system map and baseline tests | [ ] NOT COMPLETED |
| 1 | Unified Admin shell, icon-led navigation, responsive layout and RBAC | [ ] NOT COMPLETED |
| 2 | Unified provider registry and AI model registry | [ ] NOT COMPLETED |
| 3 | Full model details: configuration, pricing, routing, usage, financials, transactions, health and audit | [ ] NOT COMPLETED |
| 4 | Unified routing and Chat/Agent/Studio integration | [ ] NOT COMPLETED |
| 5 | Canonical SULY Credits ledger, reservation, settlement, refund and subscription entitlements | [ ] NOT COMPLETED |
| 6 | Ads & Rewards: AdMob App IDs, Ad Unit IDs, placements, reward policies, verification and ledger integration | [ ] NOT COMPLETED |
| 7 | Analytics, provider invoice reconciliation, ads analytics and financial reports | [ ] NOT COMPLETED |
| 8 | HIMS integration and preservation checks | [ ] NOT COMPLETED |
| 9 | Legacy-system consolidation, migration, duplicate removal and regression verification | [ ] NOT COMPLETED |
| 10 | Security review, accessibility, responsive QA, operational tests and final acceptance | [ ] NOT COMPLETED |

### Definition of 100% completion

A phase is 100% complete only when:
- Its UI and navigation are connected to real persisted data.
- Backend authorization and validation are enforced.
- Success, failure, retry and empty states are handled.
- Relevant unit/integration/end-to-end tests pass.
- No duplicate or competing implementation remains for that capability.
- Audit and operational observability are present where required.
- Evidence (test output, commit and changed-file summary) is recorded.

## 12. Acceptance checklist

- [ ] Existing `develop` branch used; no new branch created.
- [ ] Production branch/configuration untouched.
- [ ] One unified Admin navigation and one coherent visual system.
- [ ] Iconography is consistent and accessible.
- [ ] One canonical model/provider registry.
- [ ] One pricing policy/version history and traceable model transactions.
- [ ] One canonical SULY Credits ledger.
- [ ] Ads & Rewards is a single top-level section.
- [ ] AdMob Android/iOS App IDs and per-platform Ad Unit IDs are managed distinctly.
- [ ] Reward completion is server-verified where supported and idempotent.
- [ ] Rewards credit the canonical SULY wallet; no parallel reward balance.
- [ ] Ads analytics are distinct from AI revenue and wallet accounting.
- [ ] HIMS remains available and functional.
- [ ] Old duplicate systems are retired only after migration and parity checks.
- [ ] All completion labels reflect verified evidence, not assumptions.

---

**End of specification — SULY Admin 3.0.0**
