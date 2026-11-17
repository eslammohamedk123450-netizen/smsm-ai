# SULY UI/UX 2.0 — Complete Design & Implementation Blueprint

**Document type:** Approved product-design and engineering implementation specification  
**Status:** Ready for implementation planning; this document upload does not itself authorize UI code changes  
**Target repository:** `eslammohamedk123450-netizen/smsm-ai`  
**Target branch:** `develop` only  
**Platforms:** Expo / React Native Android, iOS, and Web  
**Product language:** Arabic-first (RTL), English (LTR)  
**Visual direction:** Monochrome Minimal Luxury — balanced density  
**Version:** 2.0  
**Date:** 2026-11-17

---

## 0. Mandatory execution rules

1. Work only on the existing `develop` branch. **Do not create, rename, or switch to any new branch.**
2. Do not commit UI implementation changes to `release/v1`, `main`, or any production branch. Do not change branch protections, deployment environments, or production configuration.
3. This is a development build. There are currently no real end users and no production customer data. Use the development environment and existing test data only; do not invent production users, payment events, usage, or analytics.
4. The current task is a design/implementation blueprint. Uploading this document is not permission to start modifying application code. Implementation is a separate, staged task.
5. Do not delete, disable, hide permanently, or replace existing working capabilities merely to simplify the UI. Reorganize them and preserve access. If a feature is not operational end-to-end, do not present it as working: mark it unavailable, explain why, and record the dependency.
6. Every visible interactive control must have a real action, a real data source, a loading state, an error state, and a success/empty state as applicable. No decorative buttons, fake progress, fabricated counts, mock model availability, or placeholder actions in the shipped UI.
7. Before changing a screen, inspect its current implementation, services, route, database/RPC/Edge Function dependencies, and tests. Reuse existing functionality and shared components where possible.
8. Keep one central SULY Agent/AI Router decision authority. UI mode selection must not introduce a second independent planner or competing agent brain.
9. Do not change database schemas, RLS, billing rules, credit prices, subscriptions, provider configuration, model activation policy, or server authorization as a side effect of a visual redesign. If a real UI requirement exposes a backend gap, document it and implement only through an explicitly scoped, separately reviewed backend change.
10. Do not expose service-role keys, provider secrets, privileged RPCs, or admin-only data to the client.
11. Preserve Expo universal-client parity: one shared application and shared feature logic for Android, iOS, and Web. Platform-specific presentation is allowed only where the platform requires it (file picker, keyboard, safe areas, pointer/hover, responsive layout).
12. Keep HIMS and all existing product modules intact. Do not remove routes or features because they are not in the new navigation's first visible group.
13. No new Git branches, no automatic production merge, no production deployment as part of the redesign.

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
11. Model/profile selection and availability.
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

The composer is the primary interaction control. On Arabic RTL, arrange controls from **right to left** in this order:

1. **Plus / connectors button** at the far right. This is the connections/tools shortcut, not the file picker. Opens the existing connectors/tools sheet or destination. It must show actual connection state and only actions supported by the integration registry.
2. **Paperclip / attachments button** immediately to its left. Opens the attachment sheet for supported file types. This is where users choose image, video, document, or other allowed media only when the current upload pipeline supports that type.
3. **Agent mode toggle** immediately to the left of the attachment control. A compact icon toggle with a visible selected state and accessible label. It enables/disables Agent execution for the next request; it does not create another conversation.
4. **Multiline message input** in the flexible center. Placeholder: “اكتب رسالتك إلى SULY…” (English equivalent in LTR). Auto grows from 42 px to 132 px, then scrolls internally.
5. **Model/profile selector** on the left side near the microphone. A small chevron + current profile/model name. Opens a bottom sheet on mobile and a compact popover/menu on web. Options must be loaded from the existing backend configuration and filtered by actual activation, entitlement, and availability. Do not hardcode an inactive model as selectable. Preserve server-side validation on every request.
6. **Microphone / voice input** next to the selector. Show only when speech capture is supported and permission granted/available. Permission denied or unsupported platform must produce an explanation and fallback to typing. It must not silently replace the connectors action.
7. **Send button** at the far left after text is entered. Before text is entered, show the microphone action in its own position; once text or attachment is present, send becomes the primary action. During a stream, replace send with a clearly labeled Stop action only if stopping that request is supported.

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

### 5.6 Model/profile selector

- Trigger: current profile label + chevron.
- Use backend-provided profiles and capabilities; show only eligible active options.
- Distinguish SULY profile/tier from raw provider model names if those are different concepts in the backend. Never mislabel a plan as a model.
- Each option may show: display name, short use-case description, availability/lock state, and entitlement requirement where returned by the server.
- Selection updates the next request's profile key using the existing request contract. Server remains authoritative for entitlement and activation.
- Persist selection only using the existing supported preference mechanism; do not add a new database field just for appearance.
- “Auto” may be offered only if the router contract supports it and its meaning is clear. If enabled, it is the default; user can still explicitly select a supported profile.
- An inactive/unconfigured profile (including a placeholder such as X if not approved/active) is disabled and clearly labeled—not selectable and not presented as available.
- Mobile: bottom sheet, max height 70% viewport, searchable only if option count warrants it.
- Desktop: compact popover, max width 320 px.

## 6. Chat and Agent behavior — one conversation, one central brain

### 6.1 One conversation surface

Do not create separate “Chat” and “Agent Chat” products. The user remains in one conversation and may choose:
- **Auto:** the central router decides whether a request is a normal conversational response or an executable task, according to existing server policy.
- **Agent:** the user explicitly asks the central agent to execute a task, when the capability is enabled and authorized.
- **Chat:** optional explicit conversational mode only if the existing request contract supports it; it must not bypass safety, entitlement, or server-side routing.

Recommended default: **Auto**, because it reduces friction. Keep a visible Agent toggle for deliberate execution. The UI must not infer that every sentence containing an imperative is a paid task. If the central router classifies a request as an executable/credit-consuming task while the user is in Auto, show a clear confirmation before starting when the existing billing policy requires confirmation. State the estimated cost only when the server provides a trustworthy estimate. Do not charge for a task before the server's authorized hold/settlement flow.

If the existing router currently cannot accept a mode field, do not invent a client-only flag and pretend it works. Document the contract gap and request an explicit backend change before exposing the toggle as functional.

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
- AI defaults: profile/mode only where supported.
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
- Same model/profile eligibility.
- Same attachment validation.
- Same subscription and credit source.
- Same light/dark/system preference.
- Same RTL/LTR localization.
- Platform-native file pickers, keyboard shortcuts, hover hints, and safe-area adjustments are acceptable differences.

Do not promise pixel-identical geometry across a phone and desktop. The requirement is identical product experience and behavior with responsive layout.

## 9. Accessibility, usability, and error prevention

- All icon-only controls need accessible names.
- Keyboard navigation must cover drawer, dialogs, menus, composer, model selector, and task card.
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

## 11. Implementation phases and deliverables

Execute in order on `develop` only. Do not start a later phase until the current phase passes its acceptance checks.

### Phase 0 — Baseline and route/function inventory
- Record current commit SHA and working tree/branch state.
- Inventory all routes, screens, components, theme tokens, navigation entries, chat/Agent services, media flows, plan/credit services, and settings.
- Map every existing capability to its current screen and backend endpoint/RPC.
- Record current tests and known failures before changes.
- Identify functionality that is implemented, partially implemented, disabled, or absent.
- Deliverable: baseline audit table and preservation checklist.

### Phase 1 — Monochrome design tokens
- Update shared light/dark semantic tokens.
- Remove old gold/purple UI colors from shared components and screens in scope.
- Verify grayscale values, text contrast, focus, disabled states, and system theme.
- Keep project-specific user content intact.
- Deliverable: token diff, screenshots on light/dark, contrast test report.

### Phase 2 — Shared layout and global navigation
- Rework MainNavigation into responsive desktop sidebar and mobile drawer.
- Add approved destination order and recent-six section.
- Wire real recent conversations and “Show more” history.
- Remove/avoid bottom navigation.
- Remove SULY wordmark from chat header while preserving brand identity in appropriate non-chat contexts.
- Deliverable: navigation screenshots and route smoke tests.

### Phase 3 — Chat shell and composer
- Rework chat header, message column, spacing, and composer.
- Implement correct control order: plus/connectors, paperclip/attachments, Agent toggle, input, profile selector, microphone, send/stop.
- Reuse existing attachment and upload flows; extend only after service contract review.
- Implement selector against actual backend profiles and entitlement.
- Deliverable: composer interaction matrix and end-to-end chat send/upload tests.

### Phase 4 — Unified Agent execution experience
- Keep one conversation stream.
- Add Auto/Agent interaction only if the existing router contract supports it; otherwise document and request a separately scoped backend contract.
- Add expandable task status/plan/steps/tools/results and server-confirmed cancellation.
- Do not expose hidden reasoning.
- Deliverable: task lifecycle tests, cancellation tests, reconnect/reload recovery tests.

### Phase 5 — Studio, library, projects, tools
- Apply shared page patterns and monochrome visual language.
- Verify every action is connected to its actual service and permission checks.
- Hide or label unavailable capabilities honestly.
- Deliverable: per-feature integration matrix and route tests.

### Phase 6 — Plans, credits, account, settings
- Redesign plan cards and comparison layout using actual catalog data.
- Redesign credit balance/history from ledger.
- Reorganize settings into approved sections.
- Verify theme/language persistence and account security flows.
- Deliverable: billing/ledger regression report and settings tests.

### Phase 7 — Cross-platform polish and quality gate
- Test small mobile, large mobile/tablet, desktop, and wide desktop.
- Test RTL Arabic and LTR English.
- Test light, dark, and system themes.
- Test keyboard, touch, reduced motion, focus, modal dismissal, and screen-reader labels.
- Run Expo typecheck, Jest suite, web export, Android export/build validation, and relevant Supabase/Edge tests if code touched those areas.
- Inspect browser and native screenshots. Do not claim visual verification without actually viewing the rendered output.
- Deliverable: final test report, screenshots, changed-file list, known limitations, and explicit approval request before production promotion.

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
- Message composer controls appear in the approved RTL/LTR order.
- Plus opens connectors; paperclip opens attachment selection.
- Agent toggle is not a second chat and does not create a separate history.
- Model/profile selector reflects actual server eligibility.
- Mic is permission-aware and graceful when unavailable.
- Send/stop controls are state-correct and duplicate-safe.
- Draft survives recoverable failures.

### Agent
- One central brain/router.
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

The development branch currently uses an Expo Router universal client under `apps/mobile/`, with shared React Native/TypeScript screens for Android, iOS, and Web. The existing protected layout mounts `MainNavigation`. The existing navigation component already has a mobile drawer and a plus sheet, but its current ordering and content do not yet match this approved specification. The current chat route uses `ChatComposer`, `MessageBubble`, `StreamingStatus`, a Supabase-backed chat service, and a screen-local SULY profile selector. The current theme provider supports light/dark/system; the current color file still contains the former gold-tinted palette and must be replaced by neutral semantic tokens in the implementation phase.

The current composer has a plus attachment action and a connectors shortcut; this specification intentionally changes the plus to connectors and assigns file selection to the paperclip. The current client README lists Agent tools, image/vision input, web search, and manual per-message model selection as not implemented in the described client contract. The current code and server contract must therefore be re-audited before claiming those functions are operational. This document defines the target UX, not proof that all target functions already exist.

The current chat route contains a profile selector for SULY Lite/Pro/Max/X, with server-side eligibility checks. The UI must use live active/entitled profiles; never enable an inactive placeholder. The current README identifies the central `ai-router` and durable task queue/worker/scheduler architecture; implementation must preserve that central authority.

These observations are a starting point only. Phase 0 must re-fetch the current `develop` branch state before editing because repository state may change.

---

**Final instruction to implementers:** Follow this document literally unless a requirement conflicts with an existing security boundary, a verified backend contract, or an existing user-facing feature. In that case, do not silently improvise: preserve the feature, document the conflict, and request a scoped decision. Work only on `develop`; never create another branch.
