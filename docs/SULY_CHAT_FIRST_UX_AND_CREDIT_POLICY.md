# SULY — UX and Credit Policy (Supporting Historical Record)

> **Current approved UX source:** [SULY Development Master Plan](SULY_DEVELOPMENT_MASTER_PLAN.md). This older supporting note is retained for historical implementation context only. If any navigation, model-selection, subscription, theme, or account detail below conflicts with the master plan, the master plan and the latest owner-approved decisions take precedence. The current approved interface is chat-first with a four-item sidebar, no bottom navigation, a user-selectable SULY model picker, monochrome light/dark themes, and separate subscription tiers and model profiles.

---

# SULY — Approved Chat-First UX & Credit Presentation Decisions

**Decision date:** 2026-11-16  
**Status:** Product-owner approved design specification  
**Implementation status:** Specification only — existing application, billing, subscription, model-routing, and database behavior has not been changed.

## 1. Primary conversation experience

- The default entry experience is a simple, chat-first interface.
- Users describe what they need in ordinary language; they are not required to choose between chat, coding, research, analysis, or execution modes.
- The single central SULY agent determines whether a request is ordinary conversation or requires planning, tools, bounded workers, or a longer-running task.
- Keep the main chat uncluttered. Do not add a row of competing task-mode cards to the home screen.
- Preserve existing chat history, attachments, task runtime, cancellation, usage ledger, and HIMS behavior.

## 2. Header and model selector

- The chat header should provide the navigation/menu control and a compact selected-model label, such as **Suly Lite 2.0**, with a dropdown affordance.
- The model selector lists all four product model profiles: **Suly Lite, Suly Pro, Suly Max, and Suly Ultra**.
- **Approved decision: show all models.** Clearly distinguish selectable/available models from models restricted by the user's current plan or permissions.
- A subscription plan and the currently selected model are separate concepts. A user may select a lower-cost model when their plan allows it; never imply that selecting a model upgrades a subscription.
- The central agent remains responsible for task/tool orchestration. A model selector is not a separate agent-mode selector.
- The displayed version (for example, 2.0) must come from verified product/model metadata; do not hardcode an unverified version or claim a model was used unless routing confirms it.

## 3. Studio boundary

- Studio is the focused destination for specialized media workflows such as image generation, video generation, audio transcription, and related media tools.
- The central agent may still initiate a media/tool workflow from ordinary chat when the user's request calls for it, and should return the result in the conversation with an appropriate Studio/library reference where supported.
- Studio must not become a competing general-purpose assistant.

## 4. Credits and subscription presentation

### Approved decisions

| Setting | Approved value |
|---|---|
| Subscription-plan allowance | **Monthly** |
| Purchased credits expiry | **Never expire** |
| Model selector visibility | **All four models visible**, with availability/restriction labels |

- The monthly plan allowance is a product-policy decision for the future UX/specification. It does not assert that the current backend already grants monthly credits.
- Purchased credits are intended not to expire. Existing ledger, expiry columns, grant logic, legal disclosures, and UI must be inspected before implementation; do not silently change existing balances or historical records.
- All four model profiles should be discoverable in the selector, while actual access remains governed by the existing server-side entitlement and routing controls.

## 5. Balance display and accounting principles

- Prefer one clear available-credit total in the primary chat experience.
- In a details view, explain the balance by source (plan allowance, rewards, purchased credits), with transaction history and any applicable grant/renewal details.
- Do not display a combined percentage that implies unlike credit pools share one reset/expiry schedule.
- Keep source-level accounting, immutable transaction history, atomic reserve/settle/release, idempotency, and auditability.
- Any future deduction order, reward expiry, daily/monthly grant schedule, package quantities, EGP price points, credit value, or service charge must be separately specified and verified against actual provider cost and the current ledger before implementation. These values are **not approved by this document**.
- Any cancellation must charge only work actually performed under the approved usage ledger and release unused reservations without duplicate settlement.

## 6. Navigation and visual behavior

- Keep the primary chat screen minimal, with secondary destinations reachable through the existing navigation architecture.
- Studio remains specialized; projects, conversation history, library, account, subscription, rewards, and settings remain accessible without crowding the chat composer.
- Preserve responsive Web/Android/iOS behavior, Arabic RTL and English LTR, keyboard/safe-area handling, theme support, accessibility, and all existing deep links/routes.

## 7. Mandatory pre-implementation verification gate

Before changing any existing system, inspect and document:

1. Current subscription/plan tables, grant schedules, renewal logic, and entitlement checks.
2. Credit wallet/ledger schema, source buckets, expiry semantics, hold/settlement/release functions, and historical balances.
3. Current model catalog, user-facing labels, model-version metadata, plan restrictions, capability evidence, and server-side routing rules.
4. Existing chat header, navigation, Studio entry points, and responsive behavior.
5. Existing tests, migrations, RLS/grants, admin controls, and rollback strategy for any proposed database change.

Only after that review may an implementation proposal be prepared. Do not change live balances, subscription periods, purchased-credit expiry, prices, provider routes, model availability, or HIMS entitlements as part of this specification update. Any migration or financial-policy change requires its own reviewed implementation and regression plan.

## 8. Explicitly not decided here

- EGP top-up denominations or prices (including example amounts such as 5 or 10 EGP).
- Credits granted per subscription month or by reward ads.
- Reward-ad quantities, caps, frequency, and expiry.
- Purchased-credit deduction priority relative to plan/reward balances.
- Whether a plan has additional daily limits alongside its monthly allowance.
- Exact model capabilities, pricing, provider mapping, or version numbers.
- UI implementation sequence or release date.

These remain pending product/technical decisions and must not be inferred from the three approved choices.
