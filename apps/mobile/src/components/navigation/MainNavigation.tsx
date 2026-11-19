import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { createContext, useContext, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumText as Text } from "../ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";
import type { ThemePalette } from "../../theme/colors";

type Props = { children: React.ReactNode };
const NavigationMenuContext = createContext<(() => void) | null>(null);
const PlusMenuContext = createContext<(() => void) | null>(null);

export function useNavigationMenu() {
  return useContext(NavigationMenuContext) ?? (() => undefined);
}

export function usePlusMenu() {
  return useContext(PlusMenuContext) ?? (() => undefined);
}

/**
 * Global shell without a side drawer. Account and application settings live
 * inside the profile/account screen; the home screen itself is intentionally
 * left to HomeScreen.
 */
export function MainNavigation({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isChat = pathname.startsWith("/chat");
  const isHome = pathname === "/home" || pathname === "/";

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <NavigationMenuContext.Provider value={() => router.push("/settings" as never)}>
      <PlusMenuContext.Provider value={() => router.push("/integrations" as never)}>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <View style={styles.mainContent}>
            {!isChat ? (
              <SafeAreaView edges={["top"]} style={[styles.topSafe, { backgroundColor: colors.background }]}>
                <View style={[styles.topBar, { borderColor: colors.divider, flexDirection: "row", direction: "ltr" }]}>
                  {isHome ? (
                    <Pressable onPress={() => router.push("/conversations" as never)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "البحث في مهامي" : "Search tasks"}>
                      <Ionicons name="search-outline" size={23} color={colors.textPrimary} />
                    </Pressable>
                  ) : <View style={styles.headerButton} />}
                  <View style={styles.brand}>
                    <Text style={[styles.brandName, { color: colors.textPrimary }]}>SULY</Text>
                  </View>
                  <Pressable
                    onPress={isHome ? () => router.push("/settings" as never) : () => { if (router.canGoBack()) router.back(); else router.replace("/home" as never); }}
                    style={styles.homeButton}
                    accessibilityRole="button"
                    accessibilityLabel={isHome ? (isArabic ? "الحساب الشخصي" : "Profile") : (isArabic ? "العودة إلى الصفحة الرئيسية" : "Return to home")}
                  >
                    {isHome ? <Ionicons name="person-circle-outline" size={29} color={colors.textPrimary} /> : <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={24} color={colors.textPrimary} />}
                  </Pressable>
                </View>
              </SafeAreaView>
            ) : null}
            <SafeAreaView style={styles.content} edges={[]}>{children}</SafeAreaView>
          </View>
        </View>
      </PlusMenuContext.Provider>
    </NavigationMenuContext.Provider>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  mainContent: { flex: 1, minWidth: 0, minHeight: 0 },
  topSafe: { borderBottomWidth: 0 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  brand: { flex: 1, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 19, fontWeight: "900", letterSpacing: 2 },
  homeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
});
