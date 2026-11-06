# SMSM AI - Expo Universal Client

This is a Expo (React Native + TypeScript + Expo Router) conversion of the SMSM AI application, originally built with Flutter/Dart.

## Project Structure

```
apps/mobile/
  app/                  # Expo Router screens
  src/                  # Source code
    config/             # Environment configuration
    theme/              # Colors and theming
    lib/                # Core libraries
      supabase/         # Supabase client and auth storage
      network/          # SSE client (native & web)
    features/           # Feature modules
      auth/             # Authentication
      chat/             # Chat functionality
      admin/            # Admin panel
      settings/         # Settings
  .env.example          # Environment variables example
  package.json          # Dependencies
  tsconfig.json         # TypeScript config
  app.config.ts         # Expo configuration
  README.md             # This file
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun
- Expo CLI

### Installation

```bash
cd apps/mobile
npm install
npx expo install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project settings:

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL=https://your-project.supabase.co/functions/v1
```

### Running the App

**Web (recommended for initial development):**

```bash
npx expo start --web
```

This will start the Expo development server and open your app in a web browser at `http://localhost:19006`.

**Expo Go (for device preview):**

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your iOS or Android device.

### Development Workflow

1. Run `npx expo start` to start the development server
2. Press `w` to open web view, or scan the QR code with Expo Go
3. The app will automatically reload when you save changes
4. Use `npx expo-doctor` to check for any environment issues

### Build & Deployment

- **Android:** Requires Android SDK and Java Development Kit. Use `npx expo start --android` or build via Expo cloud.
- **iOS:** Requires macOS with Xcode installed. Use `npx expo start --ios` or build via Expo cloud.
- **Web:** Use `npx expo start --web` for development, and Expo cloud for production builds.

## Conversion Notes

- **Backend:** Supabase backend (auth, database, edge functions) is unchanged. This Expo app connects to the same Supabase project.
- **Flutter:** The original Flutter code in `lib/` is preserved for reference and comparison. This Expo app is the new recommended client.
- **SSE Chat:** The streaming text implementation uses SSE (Server-Sent Events) with native and web client implementations.
- **Authentication:** Uses Supabase Auth with email/password. Session is stored in localStorage and persists across app restarts.
- **Admin Features:** Admin panel requires `role: "admin"` in user profiles. Access control is enforced on the client side and via Supabase RLS policies.

## Known Limitations

- Agent features, vision, and image analysis are marked as deferred (not implemented in this beta conversion)
- Some admin tab features may be partially implemented - verify functionality
- Real-time subscription fallback for messages uses polling when WebSocket not available
- Platform-specific UI adjustments may be needed for optimal experience on all devices