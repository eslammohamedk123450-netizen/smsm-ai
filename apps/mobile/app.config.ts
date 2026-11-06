import { Config } from "expo/config";

const result: Config = {
  name: "SMSM AI",
  slug: "smsm-ai",
  scheme: "smsm-ai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  jsEngine: "hermes",
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    edgeFunctionBaseUrl: process.env.EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL,
  },
  experiments: {
    typings: true,
  },
};

export default result;