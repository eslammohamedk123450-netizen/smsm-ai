# SULY UI/UX 2.0 — Complete Design & Implementation Blueprint

**Document type:** Approved product-design and engineering implementation specification  
**Status:** Phase 0 baseline audit recorded; implementation phases remain pending and must execute sequentially  
**Target repository:** `eslammohamedk123450-netizen/smsm-ai`  
**Target branch:** `develop` only  
**Platforms:** Expo / React Native Android, iOS, and Web  
**Product language:** Arabic-first (RTL), English (LTR)  
**Visual direction:** Monochrome Minimal Luxury — balanced density  
**Version:** 2.1  
**Date:** 2026-11-18

---

## 0. Mandatory execution rules

1. Implement application/UI work only on the existing develop branch. Do not create, rename, or switch to any new branch.
2. The owner has explicitly authorized this Phase 0 documentation update to be promoted to release/v1 and deployed so it can be reviewed. This exception applies only to the plan document and its deployment; it does not authorize application/UI code changes, later phase promotion, or automatic production deployment.
3. Do not change branch protections, deployment environments, production configuration, database schemas, secrets, provider settings, routing, billing, or user data as part of this plan-document update.
4. Use development/test evidence for implementation audits. Do not invent production users, payment events, usage, or analytics.
5. Execute implementation phases sequentially on develop. The blueprint is the single source of truth; do not begin a later phase until the current phase's acceptance checks and status update are recorded.
6. Do not delete, disable, hide permanently, or replace existing working capabilities merely to simplify the UI. Reorganize them and preserve access. If a feature is not operational end-to-end, do not present it as working: mark it unavailable, explain why, and record the dependency.
7. Every visible interactive control must have a real action, a real data source, a loading state, an error state, and a success/empty state as applicable. No decorative buttons, fake progress, fabricated counts, mock model availability, or placeholder actions in the shipped UI.
8. Before changing a screen, inspect its current implementation, services, route, database/RPC/Edge Function dependencies, and tests. Reuse existing functionality and shared components where possible.
9. Keep one central SULY Agent/AI Router decision authority. The end-user UI has no mode selection and must not introduce a second independent planner or competing agent brain.
10. Do not change database schemas, RLS, billing rules, credit prices, subscriptions, provider configuration, model activation policy, or server authorization as a side effect of a visual redesign. If a real UI requirement exposes a backend gap, document it and implement only through an explicitly scoped, separately reviewed backend change.
11. Do not expose service-role keys, provider secrets, privileged RPCs, or admin-only data to the client.
12. Preserve Expo universal-client parity: one shared application and shared feature logic for Android, iOS, and Web. Platform-specific presentation is allowed only where the platform requires it (file picker, keyboard, safe areas, pointer/hover, responsive layout).
13. Keep HIMS and all existing product modules intact. Do not remove routes or features because they are not in the new navigation's first visible group.
14. No new Git branches. No automatic production merge or deployment. A production promotion requires separate explicit owner approval; the current explicit approval is limited to this Phase 0 plan-document change.

## 1. Product vision and design principles

SULY should feel like one calm, premium, capable workspace—not a crowded dashboard and not a copy of another AI product.

- **One conversation surface:** ordinary chat and Agent execution happen in the same conversation. There is no separate duplicate chat product or second conversation history.
- **Progressive disclosure:** show the most-used destinations and six recent conversations; reveal the full history only when the user asks.
- **Balanced density:** enough visible capability to make SULY discoverable, with generous spacing and no unnecessary panels.
- **Monochrome identity:** black, white, and neutral grays only for product UI. Do not introduce gold, purple, blue, gradients, or colored decorative accents. Semantic status may use monochrome icon + label + shape; color must not be the only signal.
- **Same product on every screen size:** the same information architecture, labels, actions, and state on mobile and web. Responsive layout changes geometry, not product behavior.
- **Real functionality first:** UI must reflect the actual backend capability and authorization result.
- **Arabic-first correctness:** proper RTL layout, text alignment, icon placement, focus order, and mirrored navigation. English must work in LTR without separate duplicated screens.

## 2. Shared design system

### 2.1 Neutral color tokens

Use semantic tokens rather than hard-coded colors inside feature components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFFFFF` | `#0A0A0A` | Main page background |
| `surface` | `#FFFFFF` | `#141414` | Main cards, sheets |
| `surfaceSubtle` | `#F5F5F5` | `#1B1B1B` | Secondary panels |
| `surfaceElevated` | `#EEEEEE` | `#242424` | Hover/selected surfaces |
| `textPrimary` | `#111111` | `#F7F7F7` | Primary text |
| `textSecondary` | `#555555` | `#B8B8B8` | Supporting text |
| `textMuted` | `#737373` | `#929292` | Hints and metadata |
| `border` | `#E5E5E5` | `#303030` | Dividers and outlines |
| `primary` | `#111111` | `#F5F5F5` | Primary action fill |
| `onPrimary` | `#FFFFFF` | `#111111` | Primary action text/icon |
| `secondaryAction` | transparent / gray hover | transparent / gray hover | Secondary actions |
| `overlay` | `#00000066` | `#00000099` | Modal backdrop |

All light/dark token pairs must be neutral grayscale. Existing semantic error/success/warning states may retain accessible status semantics only if necessary, but must be restrained, never decorative, and always paired with text/icon. Do not change backend status meaning.

**Contrast:** normal text >= 4.5:1; large text and meaningful UI boundaries >= 3:1. Add automated contrast tests for both themes. Existing color tests must pass; do not weaken thresholds to make a palette pass.

### 2.2 Typography

- Use the existing bundled font setup where suitable; do not add a font dependency without need.
- Arabic: use the existing Arabic-capable typeface (e.g. Tajawal if already bundled); English: existing Latin UI typeface (e.g. Inter if already bundled).
- Screen title: 20–22 px, weight 650–700.
- Section heading: 16–18 px, weight 600.
- Body: 14–16 px, weight 400–500.
- Supporting text: 12–13 px.
- Compact metadata: minimum 11 px only when legible.
- Line height: 1.45–1.65 for Arabic body copy.
- Avoid all-caps labels except short technical abbreviations.

### 2.3 Spacing and geometry

Use a 4 px base spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- Main content horizontal padding: 24 px desktop; 16 px mobile.
- Standard gap between related controls: 8 px.
- Gap between sections: 24 px.
- Card internal padding: 16 px; dense table cells: 12 px.
- Standard control height: 44 px minimum; primary composer controls: 40–44 px.
- Icon-only hit target: minimum 44 × 44 px, even if glyph is 18–22 px.
- Standard card radius: 12 px; dialog/sheet radius: 16–20 px; pill radius only for compact chips and the composer if visual testing confirms it.
- Borders: 1 px neutral. Avoid heavy shadows; use subtle elevation only for overlays.
- Content maximum width in wide chat view: 820 px (message column); composer maximum width: 860 px.

### 2.4 Icons and interaction states

- Use one consistent icon family already present in the project (`@expo/vector-icons` / Ionicons).
- Keep icon meaning consistent across the entire app.
- Default icon size: 20 px; compact: 16 px; prominent action: 22–24 px.
- Never use emoji as primary navigation or action icons.
- Button states: default, hover (web), pressed, focused, disabled, loading, success where relevant.
- Pressed state: subtle neutral surface change and 0.98 scale at most; no colored flash.
- Focus: visible 2 px neutral outline with offset; keyboard focus must not be removed.
- Disabled: reduced contrast but still readable; explain why unavailable where needed.
- Loading: spinner/progress indicator and disabled duplicate submission.
- Destructive actions: secondary danger confirmation dialog, explicit object/name, Cancel and Confirm.
- Use 150–220 ms transitions; respect reduced-motion settings. Do not animate layout continuously.

## 3. Information architecture — 14 approved primary screens

The following 14-screen structure is the product-level reference. Some entries may be implemented as nested routes or tabs within a screen; do not create redundant pages when a focused subview is more usable.

1. Sign in.
2. Create account.
3. Recover account / reset password.
4. Main conversation (chat and Agent in one surface).
5. Agent execution details (an expandable run/task view within conversation; not a second chat).
6. Projects list.
7. Project details and project conversation/files.
8. Studio (image creation as the primary Studio destination; expose other media modalities only when operational).
9. Library and memory.
10. Tools and connected services.
11. Model capability and availability information (read-only; routing and model selection remain automatic).
12. Plans and subscription management.
13. Credits, usage, and billing history.
14. Account and settings (profile, security, preferences, notifications, accessibility, help, about).

Admin screens and HIMS are existing product areas and remain preserved; they are not counted as additional end-user primary destinations in this 14-screen navigation map. Existing routes not listed must be audited and remain reachable from the appropriate parent area.

## 4. Global navigation and conversation drawer

### 4.1 No bottom navigation

Do not add a bottom tab bar. Navigation is through the side drawer only. On mobile the drawer is modal/overlay-based; on desktop it is a persistent collapsible sidebar. The user must not be forced to use two competing navigation systems.

### 4.2 Desktop sidebar

- Expanded width: 272 px.
- Collapsed width: 64 px, icons only with accessible tooltips.
- Sidebar stays fixed while the content area scrolls.
- Sidebar collapse state is persisted locally per user/device; it must not affect account data.
- The chat page header must not display the SULY wordmark/name. It begins with the sidebar control only.

Recommended order, top to bottom:

1. New conversation action.
2. Studio (image studio).
3. Library.
4. Projects.
5. Tools / connected services.
6. Account.
7. Divider.
8. Recent conversations heading.
9. Up to six recent conversations.
10. “Show more” / “عرض المزيد” to open the complete conversation history view/list.
11. Bottom account identity and plan shortcut (only when authenticated and the information is available).

The six recent conversations are the six most recently updated conversations for the authenticated user, ordered by actual `updated_at` (or the established canonical sort field). Do not show fake examples or hardcoded conversation titles. If fewer than six exist, show only the available ones. If none exist, show a quiet empty state. The “Show more” action opens the full history view with pagination/search if supported; it must not expand an unbounded list inside the drawer.

### 4.3 Mobile drawer

- Opens from the top-left/right edge according to current locale (RTL opens from the right; LTR from the left).
- Width: min(88% of viewport, 360 px).
- Safe-area aware, with a visible close button.
- Tapping the scrim, close button, Escape (web), or selecting a destination closes the drawer.
- Swipe-to-close is optional only if it does not conflict with navigation gestures.
- Same item order and semantics as desktop; no bottom navigation.
- Recent conversations section shows at most six real items and “عرض المزيد”.
- Preserve scroll position when the drawer is closed and reopened during the same session.

### 4.4 Sidebar item visual spec

- Row height: 44 px.
- Icon: 20 px; text: 14 px medium.
- Horizontal padding: 12 px; gap: 12 px.
- Default background transparent; hover/selected background uses `surfaceSubtle` or `surfaceElevated`.
- Selected state: neutral background plus a 2–3 px edge marker; do not rely on color alone.
- Recent conversation row: one-line title with ellipsis; optional contextual overflow menu.
- Overflow menu actions must be real: rename, archive/delete only if existing service supports it; destructive actions require confirmation.
- On desktop, sidebar collapse control is separate from the chat header menu trigger.

### 4.5 Navigation destination ownership

- Studio means the image studio entry point. Do not create a second separate “Images” destination if it duplicates Studio.
- Library contains user files/media and memory entry points, grouped clearly.
- Projects owns project list and project details.
- Tools owns connected apps/integrations and their real connection status.
- Account owns profile, plan/credits shortcuts, and settings entry.
- Full conversation history remains separate from Library.

## 5. Main chat screen

### 5.1 Header

- No app name/logo in the chat header.
- One menu/sidebar icon at the leading edge, 44 × 44 px hit area.
- Optional conversation title and overflow actions may appear only when they add context; do not crowd the header.
- Header height: 56 px plus safe area.
- Desktop header content aligns to the chat column; mobile remains compact.
- No duplicate “Agent screen” title. Chat and Agent are modes/behaviors within one conversation.

### 5.2 Message stream

- One chronological conversation stream.
- User messages align to the locale's trailing edge; assistant messages align to the leading edge.
- Max text column width: 820 px desktop; mobile full width with 16 px side margins.
- Avoid heavy message bubbles. Use subtle surface treatment only where it improves grouping.
- Support streaming text, markdown, code blocks, tables, attachments, and existing message actions.
- Existing copy, edit, feedback, retry/variant, share, and usage actions must remain wired to their current services.
- Show timestamps only when useful (hover on desktop or contextual metadata; do not clutter every message).
- Preserve scroll behavior: auto-scroll while the user is already at the bottom; do not force-scroll if they are reading older messages.
- Empty state: short welcoming prompt and a small set of real, useful starter suggestions; suggestions must submit actual messages and must not imply unavailable features.

### 5.3 Composer: exact RTL order and behavior

The composer is the primary interaction control. SULY has **one unified conversation mode**. The central Agent is always available and decides automatically whether a request needs a direct response, tools, planning, or multi-step execution. The user must not switch modes.

On Arabic RTL, arrange controls from **right to left** in this order:

1. **Plus / connectors button** at the far right. Opens the existing connectors/tools sheet or destination. It must show actual connection state and only actions supported by the integration registry.
2. **Paperclip / attachments button** immediately to its left. Opens the attachment sheet for supported file types. This is where users choose image, video, document, or other allowed media only when the current upload pipeline supports that type.
3. **Multiline message input** in the flexible center. Placeholder: “اكتب رسالتك إلى SULY…” (English equivalent in LTR). Auto grows from 42 px to 132 px, then scrolls internally.
4. **Microphone / voice input** next to the input/send area. Show only when speech capture is supported and permission granted/available. Permission denied or unsupported platform must produce an explanation and fallback to typing.
5. **Send button** at the far left after text is entered. Before text is entered, show the microphone action in its own position; once text or attachment is present, send becomes the primary action. During a stream, replace send with a clearly labeled Stop action only if stopping that request is supported.

There is **no Agent ON/OFF toggle**, no Chat/Agent mode switch, and no user-facing model/profile selector. The request is always submitted through the unified automatic execution path. The backend's central router remains authoritative for model, tool, and execution decisions.

The visual grouping should be one single composer container, not a row of unrelated floating buttons. Use a neutral border, surface background, 16–20 px radius (or a tested pill form), and 8 px internal gaps. Composer height grows with text; action hit targets remain at least 40–44 px. Keep the input area visually dominant.

**Important disambiguation:** the plus icon opens connectors/tools; the paperclip opens file/media attachment. Do not swap these actions. Camera may be offered inside the attachment sheet (not as an extra permanent icon) when camera permission and capture are supported.

### 5.4 Attachment sheet

- Trigger: paperclip.
- Mobile: bottom sheet; web: anchored popover or centered compact dialog depending on viewport.
- Show only supported, enabled choices with clear icon + label:
  - Photo / camera (if supported).
  - Image from device.
  - Video (only if current media service and router accept video).
  - Document/file (only supported MIME/size types).
- Every selection routes through the existing media picker, validation, upload, storage, and message-attachment pipeline.
- Display file name, type, size, upload progress, retry, and remove actions.
- Validate MIME type, file size, ownership, and storage policy both client-side and server-side.
- Do not imply a file was attached until upload and message association succeed.
- Failed upload leaves the message draft intact and provides retry/remove.
- No fake attachment previews. Use real local preview for images only where supported.

### 5.5 Plus / connectors sheet

- Trigger: plus.
- Display actual registered connectors and their state: connected, disconnected, needs authorization, unavailable, or error.
- Actions: connect, reconnect, open, disconnect only where the existing integration flow supports them.
- Do not show connectors that have no implementation or authorization path as active buttons.
- Do not execute write actions without existing approval/permission policy.
- Keep this sheet separate from the file attachment sheet.

### 5.6 Automatic model and execution routing (no manual selector)

- The client submits chat and retry/regenerate requests using the existing automatic contract (modelProfileKey: "auto" / model_profile_key: "auto" and executionMode: "auto" where the contract requires these fields).
- The central SULY Agent / AI Router alone chooses the eligible model, profile, tools, and execution depth based on the request, server-side availability, entitlement, safety, and configured routing policy.
- Do not render a model/profile picker, Chat/Agent switch, or Agent activation toggle in the end-user composer or settings.
- Do not create a second planner or let UI state override server-side routing.
- If model availability is useful to explain to the user, show read-only, server-grounded information only; never imply that the user can select or activate an inactive model.
- Existing admin-only model/provider governance remains in the admin area with its existing authorization and audit requirements. It is not an end-user model selector.
- Preserve server-side entitlement and activation validation on every request. Do not change provider configuration, model activation, route assignments, prices, or routing policy during UI implementation.


## 6. Chat and Agent behavior — one conversation, one central brain

### 6.1 One unified mode and automatic execution

- The user has one conversation surface and one interaction mode. There are no separate Chat and Agent modes, no Auto/Agent choice, and no visible Agent ON/OFF toggle.
- The central SULY Agent is always available behind the conversation. It decides automatically whether a request needs a direct answer, planning, tools, or multi-step execution using the existing server policy.
- The user writes a normal message. The client submits it through the automatic request contract; the server remains authoritative for classification, model selection, tool permissions, entitlement, safety, and execution.
- Do not infer that every imperative sentence is a paid task. Any required cost confirmation must follow the existing server-authorized billing/hold policy. Show an estimated cost only when the server provides a trustworthy estimate.
- Do not charge before the authorized hold/settlement flow. Never add a client-only mode flag or UI switch that the backend does not support.

### 6.2 Agent execution card

When an Agent task starts, show an expandable execution card inside the same conversation:

- Collapsed summary: “SULY يفكر…” / “SULY is thinking…” with a small neutral activity indicator.
- A chevron reveals details. The card must not expose private chain-of-thought or hidden reasoning. It may expose a concise user-safe status, task plan, step state, tools invoked, and outputs.
- Expanded sections:
  1. Task summary / user request.
  2. Execution plan (user-safe steps).
  3. Work steps with status: queued, running, completed, failed, skipped, cancelled.
  4. Tool/action name and a short explanation of what it did.
  5. Result/created file links where a real artifact exists.
  6. Usage/credits only when returned from the authoritative ledger.
  7. Error details in safe user-facing form, with retry where idempotency allows.
- “Cancel execution” action is visible while cancellable. It must call the existing task cancellation mechanism and display the server-confirmed result. Do not claim cancellation until acknowledged.
- If the task has passed a non-cancellable stage, explain this and do not display a false active cancel button.
- On refresh/reopen, recover task state from the durable task record, not local-only state.
- Do not show internal chain-of-thought, raw secrets, raw provider prompts, internal tool credentials, or hidden system instructions.
- Use one central agent/task coordinator. Worker processes are bounded execution units, not independent decision-making agents.

### 6.3 Agent states and visual treatment

- Queued: neutral clock icon + “في قائمة الانتظار”.
- Planning: neutral spinner + “SULY يجهز خطة التنفيذ”.
- Running: subtle activity + current safe step.
- Waiting for approval: clear approval card with exact action and consequences.
- Completed: check icon + “اكتملت المهمة” and result summary.
- Failed: warning/error icon + concise message + safe retry option.
- Cancelled: stop icon + “تم إلغاء التنفيذ” only after server confirmation.

Never use an animated “thinking” indicator as proof of real progress if no task/status event is arriving. Use a truthful connection/waiting state.

## 7. Studio, library, projects, tools, plans, credits, settings

### 7.1 Studio (images)

- One Studio destination in the sidebar; image creation is its primary entry point.
- The UI must reflect the actual configured image-generation models, capability evidence, pricing, and activation state from the backend.
- If no model is configured/verified, show a useful unavailable state and setup guidance for the authorized admin; do not show an enabled Generate button.
- Keep prompt, aspect ratio/format, generation options, result gallery, and history logically grouped.
- Do not add a second “Images” navigation destination that duplicates Studio.
- Other modalities (video/audio) may appear only when their full backend flow is active and tested.

### 7.2 Library and memory

- Separate file/media library from memory controls using clear sections or tabs within the same destination.
- File actions must use existing ownership-aware storage APIs.
- Memory controls must use the existing memory service and permission rules.
- Empty state should explain what can be stored and how to add an item.
- Do not show files from another user or private HIMS resources without the exact existing authorization path.

### 7.3 Projects

- List: name, short description, updated date, and status only when those fields exist.
- Detail: project context, associated conversations, files, and available actions.
- New project, rename, archive/delete, and open actions must be connected to current project services and protected by confirmation where destructive.
- Keep project color/labels neutral by default. Existing user-selected project metadata must not be overwritten during the redesign.

### 7.4 Tools and connected services

- Show connector name, actual connection status, scopes/permissions if available, last check if available, and supported actions.
- Connecting/disconnecting uses the existing OAuth/credential flow.
- Never ask for provider secrets in a normal chat composer.
- No fake “connected” state based only on a local toggle.

### 7.5 Plans and subscriptions

Preserve the current plan catalog and backend entitlements. Present the approved order:
1. Lite
2. Pro
3. Max
4. Ultra

Do not assume price, quota, feature limits, or payment provider. Bind all plan details to the authoritative existing subscription/catalog source. If Ultra is not configured, show it only as unavailable/coming later if product policy approves—not as purchasable.

Plan cards:
- Desktop: up to four balanced columns when width permits; otherwise 2 × 2.
- Mobile: vertical stack; selected/current plan is clearly marked.
- Each card: plan name, actual price/cycle, actual allowance, concise included capabilities, current-plan state, and one primary action.
- Comparison table may be collapsible on mobile.
- Subscription management, invoices/payment history, and cancellation/renewal belong in a detail area, not crammed into the plan card.
- Checkout/payment action is visible only if the payment provider and server flow are configured and testable.

### 7.6 Credits and usage

- Show actual balance from the credit ledger.
- Usage history is paginated and sourced from server records.
- Distinguish grants, holds, settlements, refunds, adjustments, and expiry only if the ledger supports those types.
- Never calculate a display balance from client-side assumptions.
- Never add a “recharge” action unless a real payment/credit purchase flow exists.
- Admin adjustments remain admin-only, server-authorized, reasoned, and idempotent.

### 7.7 Account and settings

Organize settings into sections:
- Profile and personal information.
- Appearance: Light / Dark / System.
- Language: Arabic / English.
- Notifications.
- Security and privacy: password/session management and available controls.
- Memory preferences.
- AI behavior: read-only explanation that SULY automatically selects the appropriate model and execution path; no user-facing mode/profile selector.
- Conversation preferences.
- Data and storage.
- Accessibility: text scale, reduced motion, contrast.
- Help and support.
- About/version.

Appearance setting:
- Light, Dark, System.
- Default: System for first-time users unless the existing persisted preference says otherwise.
- A user's explicit selection persists using the existing ThemeProvider preference mechanism.
- Theme change must update every screen, modal, sheet, status bar, web meta theme color, and native system surfaces.
- No screen may retain old gold/purple hard-coded colors after migration.

## 8. Responsive layout and platform parity

Use the same Expo Router routes, shared components, data contracts, and feature services for Web, Android, and iOS.

Suggested breakpoints:
- Small mobile: < 600 px.
- Large mobile/tablet: 600–899 px.
- Desktop: >= 900 px.
- Wide desktop: >= 1280 px.

Behavior:
- Mobile: overlay drawer; one-column content; bottom sheets for model selection and attachment/connectors; composer pinned above keyboard/safe area.
- Tablet: overlay or compact persistent drawer depending on usable width; same navigation order.
- Desktop: persistent collapsible sidebar; popovers for compact selectors; centered chat content; multi-column plan cards where space permits.
- Wide desktop: allow additional breathing room, not a second unrelated dashboard.

Parity definition:
- Same destinations and names.
- Same underlying conversation/task state and history.
- Same action semantics and permission checks.
- Same automatic model/profile eligibility and routing (no manual user selector).
- Same attachment validation.
- Same subscription and credit source.
- Same light/dark/system preference.
- Same RTL/LTR localization.
- Platform-native file pickers, keyboard shortcuts, hover hints, and safe-area adjustments are acceptable differences.

Do not promise pixel-identical geometry across a phone and desktop. The requirement is identical product experience and behavior with responsive layout.

## 9. Accessibility, usability, and error prevention

- All icon-only controls need accessible names.
- Keyboard navigation must cover drawer, dialogs, menus, composer, and task card.
- Focus returns to the trigger after a modal closes.
- Escape closes the topmost non-destructive overlay on web.
- Touch targets >= 44 px.
- Text zoom/reflow must not clip controls.
- Respect reduced motion.
- Never convey status using color alone.
- Confirm destructive actions and irreversible external writes.
- Prevent duplicate sends, uploads, task starts, and billing submissions with existing idempotency guards.
- Preserve unsent draft text on picker cancellation, upload failure, navigation interruptions where safe, and transient errors.
- Provide concise Arabic and English validation/error copy.
- Avoid alert spam; use inline validation and a consistent toast system for transient outcomes.

## 10. Data and backend integration contract

Before implementing each screen, map every displayed field/action to its source:

| UI area | Required source of truth |
|---|---|
| Recent conversations | Existing user-scoped conversation query/service |
| Messages | Existing chat service and canonical message records |
| Model/profile list | Existing active profile/model configuration and entitlement checks |
| Agent state | Durable task/queue/worker status from existing backend |
| Agent steps/tools | Persisted task events/results with user-safe projection |
| Attachments | Existing media service, storage, and message association |
| Connectors | Existing integration registry and OAuth/connection status |
| Projects | Existing project service and RLS-protected records |
| Studio | Existing media capability registry, activation evidence, and generation endpoint |
| Plans | Existing plan/catalog/subscription service |
| Credits | Authoritative credit ledger/balance RPC |
| Settings | Existing preference/theme/locale services |
| Admin-only settings | Existing admin guard and server-side admin authorization |

For each UI action, document:
- service/function invoked;
- authenticated user context;
- authorization/RLS/RPC/Edge Function guard;
- request id/idempotency strategy;
- loading and disabled state;
- success state;
- recoverable and terminal error states;
- telemetry event if already approved and privacy-safe.

Never write assistant messages or credit balances directly from the client if the current architecture assigns those operations to the AI Router or ledger service. The client must not bypass the central `ai-router`.

## 11. Execution plan, phase split, and live status

Execute the stages below in order on develop. This section is the execution tracker. Update it in the same commit whenever a phase changes status. Do not mark a task complete because a component or route merely exists; require the stated evidence.

### Status legend
- ⬜ **Not started — 0%**
- 🟡 **In progress — percentage shown**
- ◐ **Partially complete — percentage shown**
- ☑️ **Completed — 100%**, only after implementation and acceptance checks pass
- ❌ **Failed / regression — percentage shown**, repair before proceeding
- ⏸️ **Blocked — percentage shown**, record the exact dependency or owner decision

Percentages are source-audit estimates of deliverable coverage, not test pass rates. Each checklist item is marked separately; completed items require evidence. Unknown/unverified behavior stays partial or blocked.

### Phase 0 — Baseline audit and plan alignment
**Status: ◐ 85% — source audit recorded; final runtime/working-tree evidence remains unavailable.**

- ☑️ Record the observed baseline commit references: develop baseline 2106e2b40fd4d1fb45d2eef02daef0846c869743; release/v1 baseline c48530a539112554664c4f1776be135485bd830e.
- ☑️ Confirm branch relationship: develop is two commits behind release/v1 at audit time; no develop-only commits were reported by the comparison.
- ☑️ Record core application and backend ownership using the existing docs/PHASES_1_4_BUILD_AUDIT.md inventory and the source files listed in the baseline table below.
- ☑️ Reconcile the plan with the approved product decision: one unified conversation mode; central Agent always available; automatic model/tool/execution routing; no Agent toggle, no Chat/Agent switch, and no manual model/profile picker.
- ☑️ Split implementation into Phases 1–7 plus final Phase 8, with explicit status markers and acceptance gates.
- ◐ Record route/service ownership for chat, navigation, theme, tasks, plans, credits, settings, media, and projects; exhaustive route-by-route and RPC-by-RPC mapping is still required as each owning phase begins.
- ⏸️ Working-tree cleanliness and uncommitted local changes cannot be observed through the repository file API; verify from the actual development workspace before any code edit.
- ⏸️ Fresh baseline CI and live browser/device screenshots were not run during this documentation audit. Existing README/audit evidence is historical and must not be presented as a fresh pass.
- **Deliverable:** this updated blueprint plus the source-level baseline matrix in §14. Phase 0 is not 100% until the working-tree and fresh baseline checks are recorded.

### Phase 1 — Monochrome design system and shared tokens
**Status: ☑️ 100% — shared theme foundations, source audit, semantic color normalization, contrast tests, and TypeScript checks passed. Rendered cross-device screenshot review is intentionally part of Phase 7.**

- ☑️ Confirm shared light/dark semantic grayscale palettes exist in apps/mobile/src/theme/colors.ts with matching token keys.
- ☑️ Confirm ThemeProvider supports System / Light / Dark, persists the preference, and follows the system appearance when selected.
- ☑️ Search application source for legacy gold/purple brand colors and explicit inline color overrides; no legacy gold/purple palette values were found in app source. Neutral black/white splash and overlay values remain intentional.
- ☑️ Make the AppLogo wrapper use shared theme background/divider tokens instead of fixed black/gray values.
- ☑️ Replace custom green/red connector status borders and the unused success badge treatment with semantic theme tokens, preserving success/error meaning through the shared palette.
- ☑️ Expand and run automated theme tests for matching token sets, neutral grayscale values, text contrast across shared surfaces, primary button contrast, and approved palette identity. The Monochrome theme and project defaults job passed.
- ☑️ Confirm Expo TypeScript typecheck and mobile authentication regression test step passed in CI.
- ⏭️ Defer rendered focus/disabled/loading/error-state review and light/dark screenshots to Phase 7's cross-platform quality gate, where device and viewport comparisons can be assessed together.
- **Changed files:** apps/mobile/src/components/ui/AppLogo.tsx; apps/mobile/src/features/integrations/ConnectedAppsScreen.tsx; apps/mobile/src/theme/colors.test.ts.
- **CI evidence:** [Monochrome theme and project defaults](https://github.com/eslammohamedk123450-netizen/smsm-ai/actions/runs/44283876242/job/134731382683); [Expo TypeScript typecheck and mobile regression job](https://github.com/eslammohamedk123450-netizen/smsm-ai/actions/runs/44283881664/job/134731637030).
- **Deliverable:** source-level token audit, theme contrast test coverage, and successful CI checks.

### Phase 2 — Responsive application shell and global navigation
**Status: 🟡 50% — navigation audit complete; persistent desktop sidebar is the next implementation target.**

- ☑️ Confirm protected routes mount the shared MainNavigation.
- ☑️ Confirm mobile drawer, recent conversation loading (bounded to six), and primary destinations are present in the current navigation component.
- ◐ Reconcile destination order, account placement, recent-chat empty/loading/error states, and “Show more” full-history behavior against the blueprint.
- ⬜ Implement/verify persistent desktop sidebar with 272 px expanded / 64 px collapsed states and keyboard-accessible tooltips.
- ⬜ Verify responsive breakpoints, RTL/LTR drawer direction, focus management, Escape/scrim dismissal, and no bottom navigation.
- **Deliverable:** responsive navigation screenshots and route smoke tests.

### Phase 3 — Unified chat shell and composer
**Status: ◐ 55% — chat, attachment, voice, and automatic request foundations exist; target composer layout is not complete.**

- ☑️ Confirm chat uses one chronological conversation stream and existing send/retry/regenerate services.
- ☑️ Confirm send/retry/regenerate requests use automatic model profile and execution mode values in the inspected chat route.
- ☑️ Confirm an attachment sheet and microphone/speech-recognition handling exist in ChatComposer.
- ◐ Align the composer to the approved order: plus/connectors, paperclip/attachments, input, microphone, send/stop.
- ⬜ Verify plus opens connectors and paperclip exclusively opens supported media attachments, with real loading/error/success states.
- ⬜ Remove any remaining user-facing model/profile selector artifacts and stale UI state/styles after source-wide reference checks.
- ⬜ Run Arabic/English send, attachment, voice permission, cancellation, retry, and draft-preservation tests.
- **Deliverable:** composer interaction matrix and chat send/upload regression report.

### Phase 4 — Always-available central Agent execution experience
**Status: ◐ 45% — central routing and durable task services exist; complete in-chat lifecycle UI remains.**

- ☑️ Preserve one central AI Router / Agent decision authority; do not introduce a second planner.
- ☑️ Confirm durable task progress and bounded task-history services exist in task-service.ts.
- ◐ Connect safe, persisted task status to the unified conversation without creating a separate Agent chat or mode.
- ⬜ Add an expandable in-chat execution card for safe plan summaries, steps, tool activity, results, and status; never expose hidden reasoning.
- ⬜ Verify server-confirmed cancellation, reconnect/reload recovery, duplicate prevention, and partial/failed task states.
- ⬜ Verify usage/credit display comes only from authoritative ledger/usage services.
- **Deliverable:** task lifecycle, cancellation, reconnect, and safe-rendering tests.

### Phase 5 — Studio, library, projects, and connected tools
**Status: ◐ 50% — core routes/services exist; end-to-end availability and action audit remains.**

- ☑️ Confirm Studio, media/library, projects, and integrations areas exist in the current application source/inventory.
- ◐ Map each visible action to its service, permission boundary, and real connection/capability status.
- ⬜ Apply the shared monochrome page patterns without removing existing working capabilities or HIMS.
- ⬜ Mark unavailable integrations/capabilities honestly; no decorative or fake actions.
- ⬜ Run owner-scoped project, upload/delivery, connector authorization, and route tests.
- **Deliverable:** per-feature integration matrix and route tests.

### Phase 6 — Plans, credits, account, and settings
**Status: ◐ 55% — catalog/ledger/settings foundations exist; checkout and broader account organization remain.**

- ☑️ Confirm plans and features load from active plan catalog records.
- ☑️ Confirm credit history/balance surfaces use existing credit/ledger services.
- ☑️ Confirm theme and language settings are persisted through existing providers/services.
- ◐ Reorganize account/settings into the approved sections while preserving security and privacy controls.
- ⬜ Clearly label paid upgrade/checkout as unavailable until a real payment flow is implemented and verified; do not imply that a disabled “coming soon” control is purchasable.
- ⬜ Run billing/ledger regression tests and account security/settings persistence tests.
- **Deliverable:** billing/ledger regression report and settings tests.

### Phase 7 — Cross-platform polish and quality gate
**Status: ⬜ 0% — not started.**

- ⬜ Test small mobile, large mobile/tablet, desktop, and wide desktop.
- ⬜ Test Arabic RTL and English LTR.
- ⬜ Test Light / Dark / System.
- ⬜ Test keyboard, touch targets, reduced motion, focus order, screen-reader labels, and modal dismissal.
- ⬜ Run Expo typecheck, Jest suite, web export, Android export/build validation, and relevant Supabase/Edge tests if those areas changed.
- ⬜ Inspect actual browser and native screenshots. Do not claim visual verification without viewing rendered output.
- **Deliverable:** exact test report, screenshots, changed-file list, and known limitations.

### Phase 8 — Final audit, handoff, and production-promotion decision
**Status: ⬜ 0% — not started.**

- ⬜ Reconcile every checklist item against code, tests, and rendered evidence.
- ⬜ Publish final report with branch/commit, files, completed/partial items, exact test results, screenshots, and known gaps.
- ⬜ Confirm HIMS, admin, auth, chat, credits, memory, permissions, and data boundaries remain intact.
- ⬜ Request separate explicit approval before promoting implementation phases to production.
- **Deliverable:** final review report and explicit promotion decision.

### Phase 0 source-level baseline matrix

| Area | Inspected source / evidence | Current finding | Phase |
|---|---|---|---|
| Universal app and routes | apps/mobile/app/, protected layout, docs/PHASES_1_4_BUILD_AUDIT.md | Expo Router shared client for Android/iOS/Web; full route tree still needs fresh enumeration | 0 / 2 |
| Navigation | apps/mobile/src/components/navigation/MainNavigation.tsx | Mobile drawer, bounded recent-conversation query, Studio/Library/Projects/Tools entries; desktop collapsible sidebar not verified | 2 |
| Chat request contract | apps/mobile/app/(protected)/chat.tsx | Inspected send/retry/regenerate calls use modelProfileKey: "auto" and executionMode: "auto" | 3 / 4 |
| Composer and media | apps/mobile/src/features/chat/components/ChatComposer.tsx, AttachSheet.tsx | Attachment sheet and speech-recognition handling exist; exact plus/paperclip target order needs verification | 3 |
| Durable Agent tasks | apps/mobile/src/features/brain/task-service.ts | Durable progress snapshot and bounded history mapping/query exist; complete in-chat task card/cancel/recovery flow not verified | 4 |
| Design system | apps/mobile/src/theme/colors.ts, ThemeProvider.tsx, AppLogo.tsx, ConnectedAppsScreen.tsx, colors.test.ts | Neutral grayscale light/dark palette and persisted preference confirmed; AppLogo and connector status colors now use shared tokens; CI and rendered contrast/screenshots remain | 1 |
| Plans | apps/mobile/src/features/billing/UpgradeScreen.tsx | Reads active plan/features and current tier; paid upgrade action is explicitly unavailable (“coming soon”) | 6 |
| Settings and credits | apps/mobile/src/features/settings/SettingsScreen.tsx | Theme/language controls and credit history are present; broader security/account sections need audit | 6 |
| HIMS and admin | docs/PHASES_1_4_BUILD_AUDIT.md, src/features/hims/, src/features/admin/, Supabase functions/migrations | Existing HIMS/admin are protected product areas; preserve them and their authorization boundaries | All |
| Automated checks | apps/mobile/package.json, .github/workflows/verify-agent-queue.yml, .github/workflows/verify-ai-router-bundle.yml | Theme test coverage expanded; draft verification PR #177 opened. No fresh passing CI result has been confirmed yet | 1 / 7 |

## 12. Acceptance criteria (must all pass)

### Navigation
- No bottom navigation exists.
- Drawer works on mobile and desktop.
- Exactly six or fewer real recent chats are visible.
- “Show more” opens complete history.
- Studio, Library, Projects, Tools, Account are easy to find.
- All old routes/features remain reachable.

### Chat
- Chat header has menu control and no SULY name.
- Message composer controls appear in the approved RTL/LTR order: plus/connectors, paperclip/attachments, input, microphone, send/stop.
- Plus opens connectors; paperclip opens attachment selection.
- There is one unified conversation mode; no Agent toggle, no Chat/Agent switch, and no user-facing model/profile selector.
- Every request uses the central router's automatic model and execution selection; server-side eligibility remains authoritative.
- Mic is permission-aware and graceful when unavailable.
- Send/stop controls are state-correct and duplicate-safe.
- Draft survives recoverable failures.

### Agent
- One central brain/router that is always available in the unified conversation; no mode switch or competing planner.
- Real status comes from durable backend task state.
- Expanded details show safe plan/steps/tools/results, not hidden chain-of-thought.
- Cancellation is server-confirmed.
- No false progress or fabricated costs/credits.

### Visual and responsive
- Light/dark/system works across all routes.
- Neutral palette only, with accessible contrast.
- Mobile and web share functionality and labels.
- No clipped controls, horizontal overflow, or inaccessible overlays at supported widths.
- No bottom tabs.

### Functional integrity and security
- Existing chat, auth, subscriptions, credits, media, projects, integrations, HIMS, admin, and data flows remain intact.
- Every visible action has a real service/action and authorization check.
- RLS and server-side guards remain authoritative.
- No secret keys in client code.
- No direct client-side ledger or assistant-message fabrication.
- No schema or billing-policy changes hidden inside a UI commit.
- Relevant automated tests pass; failures are reported honestly.

## 13. Required implementation report

At the end of implementation, report:
1. Current branch and final commit SHA.
2. Files changed and purpose.
3. Screens/routes completed.
4. Existing features preserved and where they moved.
5. UI controls and their real backend/service bindings.
6. Tests run with exact pass/fail counts and workflow links.
7. Screenshots for mobile/web, Arabic/English, light/dark.
8. Known gaps and disabled features.
9. Confirmation that no branch was created and no production branch/deployment was changed.
10. Whether the implementation is ready for user review—not a claim of production readiness unless production checks have actually passed.

---

## 14. Current repository observations (baseline facts to verify again before implementation)

The development branch currently uses an Expo Router universal client under `apps/mobile/`, with shared React Native/TypeScript screens for Android, iOS, and Web. The existing protected layout mounts `MainNavigation`. The existing navigation component already has a mobile drawer and a plus sheet, but its current ordering and content do not yet match this approved specification. The current chat route uses `ChatComposer`, `MessageBubble`, `StreamingStatus`, and a Supabase-backed chat service. Inspected send/retry/regenerate requests already use automatic model-profile and execution values. The source still contains legacy profile-related types/styles that must be checked for any remaining user-visible selector before being removed. The theme provider supports light/dark/system and the current shared color file is already neutral grayscale; full screen-by-screen migration and contrast verification remain implementation work.

The current composer and navigation contain separate attachment and connectors entry points; this specification standardizes the plus as connectors and the paperclip as attachments. The current client README lists Agent tools, image/vision input, web search, and manual per-message model selection as not implemented in the described client contract. The current code and server contract must therefore be re-audited before claiming those functions are operational. This document defines the target UX, not proof that all target functions already exist.

The chat route source still contains legacy profile-option types/defaults and picker-related styles, while the inspected send/retry/regenerate requests already submit automatic routing values. Phase 3 must confirm whether any selector remains user-visible and remove all such UI/state without changing server routing. The current README and server inventory identify the central `ai-router` and durable task queue/worker/scheduler architecture; preserve that single decision authority.

These observations are a starting point only. Phase 0 must re-fetch the current `develop` branch state before editing because repository state may change.

---

**Final instruction to implementers:** Follow this document literally unless a requirement conflicts with an existing security boundary, a verified backend contract, or an existing user-facing feature. In that case, do not silently improvise: preserve the feature, document the conflict, and request a scoped decision. Work only on the existing develop branch; never create another branch. The current owner-approved product decision is one unified conversation mode with an always-available central Agent and fully automatic model/tool/execution routing. No user-facing Agent toggle, Chat/Agent switch, or manual model/profile selector may be reintroduced.
