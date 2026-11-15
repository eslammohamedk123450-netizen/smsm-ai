# SMSM AI

Suly is currently developed as an Expo application using React Native, TypeScript, and Expo Router.

## Active application

- **Mobile application:** `apps/mobile/`
- **Platforms:** Android and web preview; iOS support depends on native build configuration.
- **Backend:** Supabase (authentication, database, and Edge Functions).

For setup, environment variables, development commands, and security notes, see [apps/mobile/README.md](apps/mobile/README.md).

## Repository layout

- `apps/mobile/` — active Expo client and its application source.
- `supabase/` — database migrations, Edge Functions, configuration, and the checked-in AI router deployment artifact.
- `.github/workflows/` — CI and build workflows.
- `agent/`, `.agents/`, and `scripts/` — agent resources and project automation.
- Root-level `src/`, `index.html`, `vite.config.ts`, and `server.ts` — legacy Vite/Express web application. This is **not** the active Expo client. The legacy server still contains Composio administration routes, so these files are retained pending a separate usage/dependency audit.

## Root Node.js tooling

The root `package.json` and `package-lock.json` are still used by the AI router bundle verification workflow. Do not remove them as part of cleaning up the legacy web client unless that workflow is migrated first.

## Important security note

Never commit Supabase service-role keys or other server secrets to the mobile app. Client-side Expo public environment variables are embedded in the application and must contain only publishable/anon configuration. Enforce authorization with Supabase Auth, RLS, and server-side functions.

## Project status

The Expo client is the current application. Legacy web files are intentionally documented as legacy until their remaining routes, deployments, and external usage have been verified.
