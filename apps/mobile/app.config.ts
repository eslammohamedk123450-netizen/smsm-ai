import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SMSM AI",
  slug: "smsm-ai",
  scheme: "smsm-ai",
  version: "1.0.0",
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
  ],
  web: {
    bundler: "metro",
  },
};

export default config;
