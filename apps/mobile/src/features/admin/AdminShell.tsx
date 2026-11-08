import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";

const NAV = [
  { path: "/admin", label: "نظرة عامة", icon: "⌂" },
  { path: "/admin/models", label: "النماذج والتوجيه", icon: "◈" },
  { path: "/admin/api-keys", label: "مزودو الخدمة", icon: "⌘" },
  { path: "/admin/users", label: "المستخدمون", icon: "♙" },
  { path: "/admin/credit-management", label: "الرصيد والتسعير", icon: "◉" },
  { path: "/admin/pricing", label: "الباقات والإعلانات", icon: "▤" },
  { path: "/admin/hims", label: "نظام HIMS", icon: "✚" },
  { path: "/admin/support", label: "الدعم والشكاوى", icon: "?" },
  { path: "/admin/friction", label: "التقييم والتعثر", icon: "⌁" },
  { path: "/admin/circuit-breaker", label: "قاطع الدائرة", icon: "ϟ" },
] as const;

const WIDE_BREAKPOINT = 900;

/**
 * One persistent frame for every admin screen: a calm side rail on wide
 * screens and a scrollable tab strip on phones, so moving between sections
 * never requires going back to a hub page.
 */
export function AdminShell() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => pathname === path || (path !== "/admin" && pathname.startsWith(path));

  const navItems = NAV.map((item) => {
    const active = isActive(item.path);
    return (
      <Pressable
        key={item.path}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => router.push(item.path)}
        style={StyleSheet.flatten([wide ? styles.navItem : styles.tabItem, active && styles.navItemActive])}
      >
        <View style={wide ? styles.navContent : styles.tabContent}>
          <Text style={StyleSheet.flatten([wide ? styles.navIcon : styles.tabIcon, active && styles.navIconActive])}>{item.icon}</Text>
          <Text style={StyleSheet.flatten([wide ? styles.navLabel : styles.tabLabel, active && styles.navLabelActive])}>{item.label}</Text>
        </View>
      </Pressable>
    );
  });

  return (
    <View style={styles.root}>
      {wide ? (
        <View style={styles.rail}>
          <View style={styles.brand}>
            <Text style={styles.brandMark}>✦</Text>
            <Text style={styles.brandName}>Suly Agent AI</Text>
            <Text style={styles.brandSub}>لوحة المشرف</Text>
          </View>
          <View style={styles.nav}>{navItems}</View>
          <View style={styles.railFooter}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/chat")} style={styles.backToApp}>
              <Text style={styles.backToAppText}>الذهاب إلى التطبيق</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.main}>
        {!wide ? (
          <>
            <View style={styles.mobileHeader}>
              <View style={styles.mobileHeading}><Text style={styles.brandMark}>✦</Text><Text style={styles.mobileTitle}>لوحة المشرف</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push("/chat")} style={styles.backToAppSmall}>
                <Text style={styles.backToAppSmallText}>التطبيق</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
              {navItems}
            </ScrollView>
          </>
        ) : null}
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row-reverse", backgroundColor: colors.background },
  rail: { width: 260, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface, paddingVertical: 20, paddingHorizontal: 14, gap: 20 },
  brand: { paddingHorizontal: 8, gap: 3, alignItems: "flex-end" },
  brandMark: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", textAlign: "right" },
  brandSub: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  nav: { flex: 1, gap: 6 },
  navItem: { minHeight: 44, borderRadius: 11, paddingHorizontal: 12, justifyContent: "center" },
  navItemActive: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
  navContent: { flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  navIcon: { minWidth: 20, color: colors.textMuted, fontSize: 17, textAlign: "center" },
  navIconActive: { color: colors.primary },
  navLabel: { color: colors.textSecondary, fontSize: 13, textAlign: "right" },
  navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
  backToApp: { minHeight: 40, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  backToAppText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  main: { flex: 1, minWidth: 0 },
  mobileHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  mobileHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  mobileTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  backToAppSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary },
  backToAppSmallText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  tabsContent: { gap: 7, paddingHorizontal: 12, paddingVertical: 10 },
  tabItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.surfaceElevated },
  tabContent: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  tabIcon: { color: colors.textMuted, fontSize: 13 },
  tabLabel: { color: colors.textSecondary, fontSize: 12 },
});
