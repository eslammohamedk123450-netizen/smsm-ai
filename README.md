# SULY AI

SULY is an Expo application built with React Native, TypeScript, and Expo Router.

## Active architecture

- `apps/mobile/` — active Android, iOS, and web client.
- `supabase/` — PostgreSQL migrations, authentication policies, Edge Functions, storage configuration, and the generated AI Router deployment artifact.
- `agent/` and `.agents/` — agent skills and project resources.
- `.github/workflows/` — mobile, web, Supabase deployment, and regression workflows.

The central `ai-router` coordinates chat and agent execution. Long-running agent work is handled by the Supabase task queue, worker, and scheduler.

## Development

Mobile application:

```bash
cd apps/mobile
npm ci
npm run typecheck
npm test
npx expo start
```

Export the web client:

```bash
cd apps/mobile
npx expo export --platform web
```

Regenerate the AI Router deployment artifact from the repository root:

```bash
npm ci
npm run bundle:ai-router
```

The root Node.js package is intentionally limited to the pinned `esbuild` dependency used by the AI Router bundle workflow. It is not a second application.

## Deployment

- `.github/workflows/deploy-pages.yml` exports the Expo web client to GitHub Pages.
- `.github/workflows/eas-update.yml` publishes Expo OTA updates and requires the `EXPO_TOKEN` GitHub secret.
- `.github/workflows/deploy-supabase-ai-router.yml` deploys Edge Functions and requires `SUPABASE_ACCESS_TOKEN`.
- The Android APK workflow is manual and should only be run for a consolidated device-test cycle.

## Security

- Expo public environment variables may contain only the Supabase URL and publishable/anon key.
- Never place a Supabase service-role key or provider credential in the mobile app or any `EXPO_PUBLIC_*` variable.
- Provider credentials are stored server-side in Supabase Vault/Edge Function secrets.
- Database access is enforced through RLS, user-scoped RPCs, and admin checks.
- Media generation remains unavailable until an administrator configures a supported model and safe pricing.

Use [apps/mobile/README.md](apps/mobile/README.md) for client-specific setup and environment configuration.
