import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "Suly Agent AI",
  slug: "smsm-ai",
  scheme: "suly-agent-ai",
  version: "1.0.0",
  android: {
    package: "com.suly.agentai",
    versionCode: 1,
  },
  updates: easProjectId ? {
    url: `https://u.expo.dev/${easProjectId}`,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  } : undefined,
  extra: easProjectId ? { eas: { projectId: easProjectId } } : undefined,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android", "web"],
  plugins: [
    "expo-router",
    ["expo-speech-recognition", {
      microphonePermission: "السماح لـ Suly باستخدام الميكروفون لإملاء الرسائل.",
      speechRecognitionPermission: "السماح لـ Suly بتحويل الصوت إلى نص للرسائل.",
    }],
    ["react-native-google-mobile-ads", {
      androidAppId: process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID ?? "ca-app-pub-3940256099942544~3347511713",
      iosAppId: process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS ?? "ca-app-pub-3940256099942544~1458002511",
    }],
    // Release builds only: R8 removes unused Java/Kotlin code and resources so
    // the APK stays close to the libraries the app actually uses. The Google
    // Mobile Ads rules protect SDK classes that R8 cannot see through.
    ["expo-build-properties", {
      android: {
        enableProguardInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        useLegacyPackaging: false,
        extraProguardRules: [
          "-keep class com.google.android.gms.ads.** { *; }",
          "-keep class com.google.android.ads.** { *; }",
          "-keep class com.google.ads.** { *; }",
          "-dontwarn com.google.android.gms.ads.**",
        ].join("\n"),
      },
      ios: {
        useFrameworks: "static",
      },
    }],
  ],
  web: {
    bundler: "metro",
    output: "static",
  },
  experiments: {
    // Root-relative by default (Cloudflare Pages / Netlify). GitHub Pages builds
    // override this with EXPO_PUBLIC_WEB_BASE_URL=/smsm-ai.
    baseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "",
  },
};

export default config;
