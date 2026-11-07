import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../../theme/colors";

const NAV = [
  { path: "/admin", label: "نظرة عامة" },
  { path: "/admin/models", label: "النماذج والتوجيه" },
  { path: "/admin/api-keys", label: "مزودو الخدمة" },
  { path: "/admin/users", label: "المستخدمون" },
  { path: "/admin/credit-management", label: "الرصيد والتسعير" },
  { path: "/admin/pricing", label: "الباقات والإعلانات" },
  { path: "/admin/hims", label: "نظام HIMS" },
  { path: "/admin/circuit-breaker", label: "قاطع الدائرة" },
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
        <Text style={StyleSheet.flatten([wide ? styles.navLabel : styles.tabLabel, active && styles.navLabelActive])}>{item.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.root}>
      {wide ? (
        <View style={styles.rail}>
          <View style={styles.brand}>
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
              <Text style={styles.mobileTitle}>لوحة المشرف</Text>
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
  rail: { width: 248, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 12, gap: 16 },
  brand: { paddingHorizontal: 4, gap: 2 },
  brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", textAlign: "right" },
  brandSub: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  nav: { flex: 1, gap: 4 },
  navItem: { minHeight: 40, borderRadius: 9, paddingHorizontal: 12, justifyContent: "center" },
  navItemActive: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider },
  navLabel: { color: colors.textSecondary, fontSize: 13, textAlign: "right" },
  navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
  backToApp: { minHeight: 40, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  backToAppText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  main: { flex: 1, minWidth: 0 },
  mobileHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  mobileTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  backToAppSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary },
  backToAppSmallText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tabsContent: { gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  tabItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  tabLabel: { color: colors.textSecondary, fontSize: 12 },
});
