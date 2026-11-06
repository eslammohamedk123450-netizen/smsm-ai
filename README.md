# SMSM AI

This project was originally built with Flutter/Dart and has been converted to Expo (React Native + TypeScript + Expo Router) for a unified codebase across Android, iOS, and Web.

## Current Status

- **Expo App:** Located in `apps/mobile/`
- **Flutter Source:** Preserved in `lib/` for reference and comparison
- **Backend:** Supabase (unchanged - auth, database, edge functions)

## Getting Started with Expo

See `apps/mobile/README.md` for detailed instructions.

## Development

- Use `npx expo start --web` for web preview
- Use Expo Go app with QR code for device preview
- TypeScript strict mode enabled
- Expo Router for navigation

## Backend

Supabase backend is unchanged. Key files in `supabase/`:
- Migrations: `001_initial_schema.sql` through `012_restrict_provider_catalog_privileges.sql`
- Edge Functions: `ai-router` for AI routing with SSE streaming
- Config: `config.toml`

## Conversion

This is a conversion from Flutter to Expo, not a rewrite of the backend. The goal is to provide a TypeScript/React Native client that connects to the existing Supabase backend.

## License

See individual files for license information.