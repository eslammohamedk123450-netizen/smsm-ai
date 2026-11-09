import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig & { splash?: { image: string; resizeMode: "contain"; backgroundColor: string } } = {
  name: "Suly",
  icon: "./assets/suly-icon.png",
  owner: "suly-sam100",
  slug: "smsm-ai",
  scheme: "suly-agent-ai",
  version: "1.0.1",
  splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#000000" },
  runtimeVersion: { policy: "appVersion" },
  android: {
    package: "com.suly.agentai",
    versionCode: 6,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [{ scheme: "suly-agent-ai", host: "auth", pathPrefix: "/callback" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  updates: {
    url: `https://u.expo.dev/${easProjectId ?? "4eb557a8-8aea-4ea9-a3d7-7ccba99f6c73"}`,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  extra: { eas: { projectId: easProjectId ?? "4eb557a8-8aea-4ea9-a3d7-7ccba99f6c73" } },
  orientation: "portrait",
  userInterfaceStyle: "dark",
  platforms: ["ios", "android", "web"],
  plugins: [
    "expo-router",
    "expo-web-browser",
    "expo-font",
    ["expo-splash-screen", {
      image: "./assets/splash.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#000000",
    }],
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
