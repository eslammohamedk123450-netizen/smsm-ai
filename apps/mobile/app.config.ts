import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EAS_PROJECT_ID?.trim() || undefined;

const config: ExpoConfig & { splash?: { image: string; resizeMode: "contain"; backgroundColor: string } } = {
  name: "SULY",
  icon: "./assets/suly-icon.jpg",
  owner: "suly-sam100",
  slug: "smsm-ai",
  scheme: "suly-agent-ai",
  version: "1.0.4",
  splash: { image: "./assets/suly-icon.jpg", resizeMode: "cover", backgroundColor: "#000000" },
  runtimeVersion: { policy: "appVersion" },
  android: {
    package: "com.suly.agentai",
    versionCode: 11,
    softwareKeyboardLayoutMode: "resize",
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
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android", "web"],
  plugins: [
    "expo-router",
    "expo-web-browser",
    "expo-font",
    ["expo-speech-recognition", {
      microphonePermission: "اسمح لـ SULY باستخدام الميكروفون لإملاء رسالتك الصوتية.",
      speechRecognitionPermission: "اسمح لـ SULY بتحويل كلامك إلى نص داخل المحادثة.",
      androidSpeechServicePackages: ["com.google.android.googlequicksearchbox", "com.google.android.tts"],
    }],
    ["expo-splash-screen", {
      image: "./assets/suly-icon.jpg",
      imageWidth: 200,
      resizeMode: "cover",
      backgroundColor: "#000000",
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
    // The canonical site uses a custom domain, so production assets are
    // root-relative. The GitHub Pages preview is mounted at /preview.
    // The deploy workflow supplies the correct base URL for each export.
    baseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "",
  },
};

export default config;
