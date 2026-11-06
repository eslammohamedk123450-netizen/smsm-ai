import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SMSM AI",
  slug: "smsm-ai",
  scheme: "smsm-ai",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android", "web"],
  plugins: ["expo-router"],
  web: {
    bundler: "metro",
  },
};

export default config;
