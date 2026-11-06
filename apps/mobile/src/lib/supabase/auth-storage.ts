import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
