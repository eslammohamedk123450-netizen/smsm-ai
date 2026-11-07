# Suly — Expo Universal Client

Expo Router (React Native + TypeScript) client for the Suly Agent AI application and its configured Supabase backend.

## Structure

```
apps/mobile/
  app/
    (auth)/login.tsx            # Email/password login and registration
    (protected)/_layout.tsx     # Session guard for every private route
    (protected)/chat.tsx        # Streaming text chat
    (protected)/settings.tsx    # Account + sign out
    (protected)/admin/          # Admin dashboard and five sub-screens
  src/
    config/env.ts               # Public configuration validation
    lib/supabase/               # Supabase client + cross-platform auth storage
    lib/network/                # Platform SSE clients, transport, parser, UTF-8 decoder
    features/auth/              # Auth service, provider, types
    features/chat/              # Chat service, composer, bubbles, submission guard
    features/admin/             # Admin service, screens, confirmation helper
    theme/                      # Palette and tokens mirrored from Flutter
  scripts/preview-server.py     # SPA-fallback server for checking an exported build
```

## Setup

Requires Node.js 20 or newer and npm.

```bash
cd apps/mobile
npm ci
cp .env.example .env
npx expo install --check   # confirms SDK-matched versions
npx expo-doctor            # 20 checks
npm run typecheck
npm test -- --runInBand
```

`.env` holds only public values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL=https://your-project.supabase.co/functions/v1
```

The Edge Function base URL defaults to `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1`. Never place a service-role key in any `EXPO_PUBLIC_*` variable; those values are embedded in the client bundle.

## Running

- Web: `npx expo start --web`
- Device preview: `npx expo start` (the QR code only proves Metro is reachable)
- Native builds require Android SDK/JDK or macOS with Xcode, or Expo cloud builds.

Native streaming uses `expo/fetch` so `response.body.getReader()` is available; the web client uses the browser streaming API. Both feed the same transport, parser, and UTF-8 decoder.

## Verified in this change

These checks were executed in the development environment:

| Check | Result |
| --- | --- |
| `npx expo-doctor` | 20/20 checks passed |
| `npx tsc --noEmit` | no errors |
| `npx jest` | 10 tests passed (SSE frames, UTF-8 splits, single-submission guard) |
| `npx expo export --platform web` | bundles successfully |
| `npx expo export --platform android` | Hermes bundle builds successfully |
| Browser check of exported web build | login screen renders; `/chat` and `/admin` both redirect to `/login` when signed out |

Not verified: live Supabase authentication, message writes, credit settlement, Edge Function calls, a physical Android/iOS device, and any production deployment. Those require project credentials and a device or development build.

## Security model

- Only the public anon/publishable key is used; the client never reads stored provider API keys. `sync-models` receives a new provider key typed by an admin and stores it server-side.
- Admin access is gated by `suly_is_admin()` in `app/(protected)/admin/_layout.tsx`, and every admin service call re-checks it. RLS policies, `suly_admin_*` RPCs, and Edge Functions remain the real authorization boundary.
- Credit changes go through `suly_admin_adjust_credits` and `suly_admin_update_credit_pricing` with mandatory reasons and idempotency IDs — never by writing to `suly_credit_accounts` directly.
- Assistant replies and credit settlement are produced only by `ai-router`; the client inserts one user message and never fabricates assistant rows.
- Detailed server errors are replaced by short user-facing messages so headers, keys, and SQL details are not surfaced.

## Parity notes

- Login and registration send `full_name` in user metadata, matching Flutter; when email confirmation is enabled the app explains that a session is not yet available.
- Chat reads prior history before inserting the new user message, sends at most 20 messages, and uses one `request_id` UUID per send for router idempotency.
- Flutter's `CircuitBreakerTab` renders three fixed sample alerts with buttons that do nothing. The Expo screen states this plainly instead of reproducing mock data or unsupported actions; real model health and the supported reset RPC live under "Models & routing".

## Not implemented

Agent tools, image/vision input, web search, rewarded ads, client-side credit grants, and manual per-message model selection are absent from both the router contract used here and this UI. They are not presented as working features.
