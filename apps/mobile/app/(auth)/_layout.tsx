import { Stack } from "expo-router";
import { useSulyTheme } from "../../src/theme/ThemeProvider";

export default function AuthLayout() {
  const { colors } = useSulyTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
