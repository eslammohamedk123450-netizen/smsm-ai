import { Redirect } from "expo-router";

// Student education is handled in the regular SULY conversation, not a separate area.
export default function HimsRoute() {
  return <Redirect href="/(protected)/chat" />;
}
