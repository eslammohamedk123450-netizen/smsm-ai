import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumText as Text } from "../ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";
import type { ThemePalette } from "../../theme/colors";

type Props = { children: React.ReactNode };
const ITEMS = [
  { key: "home", labelAr: "الرئيسية", labelEn: "Home", href: "/home", icon: "home-outline" as const },
  { key: "conversations", labelAr: "المحادثات", labelEn: "Chats", href: "/conversations", icon: "chatbubbles-outline" as const },
  { key: "studio", labelAr: "الاستوديو", labelEn: "Studio", href: "/studio", icon: "sparkles-outline" as const },
  { key: "library", labelAr: "المكتبة", labelEn: "Library", href: "/media", icon: "folder-open-outline" as const },
  { key: "account", labelAr: "حسابي", labelEn: "Account", href: "/settings", icon: "person-circle-outline" as const },
] as const;

function activeSection(pathname: string): string {
  if (pathname.startsWith("/studio") || pathname.startsWith("/image-studio") || pathname.startsWith("/video-studio")) return "studio";
  if (pathname.startsWith("/media") || pathname.startsWith("/hims")) return "library";
  if (pathname.startsWith("/settings") || pathname.startsWith("/support") || pathname.startsWith("/upgrade") || pathname.startsWith("/balance") || pathname.startsWith("/integrations")) return "account";
  if (pathname.startsWith("/chat") || pathname.startsWith("/conversations") || pathname.startsWith("/tasks")) return "conversations";
  return "home";
}

export function MainNavigation({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const wide = Platform.OS === "web" && width >= 900;
  const active = activeSection(pathname);
  const screenOwnsSafeArea = ["/chat", "/balance", "/image-studio", "/video-studio"].some((route) => pathname.startsWith(route));

  if (pathname.startsWith("/admin")) return <>{children}</>;

  const renderItem = (item: typeof ITEMS[number], compact = false) => {
    const selected = active === item.key;
    return (
      <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => router.replace(item.href as never)}
        style={[
          compact ? styles.bottomItem : [styles.sideItem, { flexDirection: isArabic ? "row-reverse" : "row" }],
          selected && (compact ? styles.bottomItemSelected : styles.sideItemSelected),
          { backgroundColor: selected ? colors.surfaceElevated : "transparent" },
        ]}>
        <Ionicons name={item.icon} size={compact ? 21 : 20} color={selected ? colors.textPrimary : colors.textMuted} />
        <Text style={[compact ? styles.bottomLabel : styles.sideLabel, { color: selected ? colors.textPrimary : colors.textSecondary, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? item.labelAr : item.labelEn}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, wide && [styles.wideRoot, { flexDirection: isArabic ? "row-reverse" : "row" }]]}>
      {wide ? (
        <View style={[styles.sidebar, { backgroundColor: colors.surface, borderColor: colors.divider, borderLeftWidth: isArabic ? 1 : 0, borderRightWidth: isArabic ? 0 : 1 }]}>
          <View style={[styles.brand, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.brandMark, { backgroundColor: colors.primary }]}><Text style={[styles.brandLetter, { color: "#FFFFFF" }]}>S</Text></View>
            <View style={[styles.brandCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}><Text style={[styles.brandName, { color: colors.textPrimary }]}>SULY</Text><Text style={[styles.brandTagline, { color: colors.textMuted }]}>YOUR INTELLIGENT PARTNER</Text></View>
          </View>
          <Text style={[styles.navCaption, { color: colors.textMuted, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? "مساحة العمل" : "Workspace"}</Text>
          <View style={styles.sideItems}>{ITEMS.map((item) => renderItem(item))}</View>
          <View style={[styles.sidebarFooter, { borderColor: colors.divider }]}><Text style={[styles.footerText, { color: colors.textMuted }]}>More Than AI. Your Intelligent Partner.</Text></View>
        </View>
      ) : null}
      <SafeAreaView style={styles.content} edges={screenOwnsSafeArea ? [] : ["top"]}>{children}</SafeAreaView>
      {!wide && !keyboardVisible ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.divider, paddingBottom: Math.max(insets.bottom, 6), flexDirection: isArabic ? "row-reverse" : "row" }]}>
          {ITEMS.map((item) => renderItem(item, true))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, minWidth: 0, flexDirection: "column" },
  wideRoot: { flexDirection: "row-reverse" },
  sidebar: { width: 238, borderLeftWidth: 1, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 14 },
  brand: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingBottom: 24 },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brandLetter: { fontSize: 23, fontWeight: "900" },
  brandCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  brandName: { fontSize: 17, fontWeight: "900", letterSpacing: 1.4 },
  brandTagline: { fontSize: 8, letterSpacing: 0.8 },
  navCaption: { fontSize: 11, textAlign: "right", paddingHorizontal: 10, paddingBottom: 10 },
  sideItems: { gap: 5 },
  sideItem: { minHeight: 48, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 12 },
  sideItemSelected: { borderRightWidth: 3, borderRightColor: "#777777" },
  sideLabel: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  sidebarFooter: { marginTop: "auto", borderTopWidth: 1, paddingTop: 14 },
  footerText: { fontSize: 9, textAlign: "center" },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  bottomBar: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1, paddingTop: 5 },
  bottomItem: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10, marginHorizontal: 2 },
  bottomItemSelected: { borderTopWidth: 2, borderTopColor: "#777777", borderRadius: 0 },
  bottomLabel: { fontSize: 10, fontWeight: "700" },
});
