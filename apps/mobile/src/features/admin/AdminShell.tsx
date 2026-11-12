import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

const NAV = [
  { path: "/admin", label: "نظرة عامة", icon: "⌂" },
  { path: "/admin/users", label: "المستخدمون", icon: "♙" },
  { path: "/admin/conversations", label: "المحادثات", icon: "▤" },
  { path: "/admin/models", label: "النماذج والتوجيه", icon: "◈" },
  { path: "/admin/brain", label: "العقول والقدرات", icon: "✧" },
  { path: "/admin/agents", label: "المساعدون", icon: "✦" },
  { path: "/admin/credit-management", label: "الرصيد", icon: "◉" },
  { path: "/admin/pricing", label: "الباقات", icon: "▧" },
  { path: "/admin/api-keys", label: "مفاتيح API", icon: "⌘" },
  { path: "/admin/composio", label: "Composio", icon: "C" },
  { path: "/admin/image-generation", label: "توليد الصور", icon: "▣" },
  { path: "/admin/storage", label: "التخزين", icon: "↥" },
  { path: "/admin/audit", label: "سجل النشاط", icon: "≡" },
  { path: "/admin/circuit-breaker", label: "إعدادات النظام", icon: "⚙" },
] as const;
const WIDE_BREAKPOINT = 900;

export function AdminShell() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [adminName, setAdminName] = useState("A");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setAdminName((data.user?.email?.[0] ?? "A").toLocaleUpperCase("ar"));
    });
    return () => { active = false; };
  }, []);

  const refreshHealth = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.from("ai_model_health").select("model_id,last_status,auto_restricted").limit(500);
      if (error) throw error;
      setSystemOk((data ?? []).every((row) => row.last_status !== "error" && row.auto_restricted !== true));
    } catch { setSystemOk(null); }
    finally { setChecking(false); }
  };
  useEffect(() => { void refreshHealth(); }, []);

  const isActive = (path: string) => path === "/admin" ? pathname === path : pathname === path || pathname.startsWith(path);
  const navItems = useMemo(() => NAV.map((item) => {
    const active = isActive(item.path);
    return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => router.push(item.path)} style={[wide ? styles.navItem : styles.tabItem, active && styles.navItemActive]}>
      <View style={wide ? styles.navContent : styles.tabContent}>
        <Text style={[wide ? styles.navIcon : styles.tabIcon, active && styles.navIconActive]}>{item.icon}</Text>
        <Text style={[wide ? styles.navLabel : styles.tabLabel, active && styles.navLabelActive]}>{item.label}</Text>
      </View>
    </Pressable>;
  }), [pathname, wide, router]);

  const submitSearch = () => {
    const value = query.trim();
    if (!value) return;
    const destination = value.includes("@") || /^[0-9a-f-]{30,}$/i.test(value) ? "/admin/users" : "/admin/models";
    router.push({ pathname: destination, params: { q: value } });
  };
  const refreshPage = () => { void refreshHealth(); router.replace(pathname as never); };

  return <View style={styles.root}>
    {wide ? <View style={styles.rail}>
      <View style={styles.brand}><View style={styles.brandBadge}><Text style={styles.brandMark}>S</Text></View><View style={styles.brandCopy}><Text style={styles.brandName}>Suly</Text><Text style={styles.brandSub}>ADMIN COMMAND CENTER</Text></View></View>
      <Text style={styles.navCaption}>مساحة الإدارة</Text>
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>{navItems}</ScrollView>
      <View style={styles.railFooter}><View style={styles.secureDot} /><Text style={styles.secureText}>جلسة مشرف محمية</Text></View>
    </View> : null}
    <View style={styles.main}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="الانتقال إلى التطبيق" onPress={() => router.replace("/(protected)/chat")} style={styles.appLink}><Text style={styles.appLinkIcon}>⌂</Text><Text style={styles.appLinkText}>التطبيق</Text></Pressable>
        <View style={styles.searchBox}><Text style={styles.searchGlyph}>⌕</Text><TextInput value={query} onChangeText={setQuery} onSubmitEditing={submitSearch} returnKeyType="search" style={styles.searchInput} placeholder="بحث شامل: اسم، بريد، UUID، نموذج…" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={submitSearch}><Text style={styles.searchAction}>بحث</Text></Pressable></View>
        <View style={styles.topActions}>
          <View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? "الحالة غير متاحة" : systemOk ? "النظام سليم" : "يحتاج مراجعة"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث الصفحة" onPress={refreshPage} style={styles.refreshButton}><Text style={styles.refreshGlyph}>{checking ? "…" : "↻"}</Text></Pressable>
          <View style={styles.adminAvatar}><Text style={styles.avatarText}>{adminName}</Text></View>
        </View>
      </View>
      {!wide ? <><View style={styles.mobileTitleRow}><Text style={styles.mobileTitle}>مركز تحكم الأدمن</Text><View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? "غير متاح" : systemOk ? "سليم" : "مراجعة"}</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>{navItems}</ScrollView></> : null}
      <View style={styles.page}><Slot /></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row-reverse", backgroundColor: colors.background },
  rail: { width: 244, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface, paddingVertical: 20, paddingHorizontal: 13 },
  brand: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingBottom: 22 },
  brandBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandMark: { color: "#06110D", fontSize: 20, fontWeight: "900" }, brandCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" }, brandSub: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.1 },
  navCaption: { color: colors.textMuted, fontSize: 10, textAlign: "right", paddingHorizontal: 11, paddingBottom: 8, letterSpacing: 0.6 }, nav: { flex: 1 },
  navItem: { minHeight: 40, borderRadius: 9, paddingHorizontal: 10, justifyContent: "center", marginBottom: 3 }, navItemActive: { backgroundColor: colors.surfaceElevated, borderRightWidth: 3, borderRightColor: colors.primary }, navContent: { flexDirection: "row-reverse", alignItems: "center", gap: 10 }, navIcon: { minWidth: 20, color: colors.textMuted, fontSize: 15, textAlign: "center" }, navIconActive: { color: colors.primary }, navLabel: { color: colors.textSecondary, fontSize: 12, textAlign: "right" }, navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, flexDirection: "row-reverse", alignItems: "center", gap: 7, justifyContent: "flex-start" }, secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }, secureText: { color: colors.textMuted, fontSize: 10 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 14 },
  appLink: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, appLinkIcon: { color: colors.primary, fontSize: 15 }, appLinkText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  searchBox: { flex: 1, maxWidth: 560, height: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 10, gap: 8 }, searchGlyph: { color: colors.textMuted, fontSize: 20 }, searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, textAlign: "right", fontSize: 12, paddingVertical: 0 }, searchAction: { color: colors.primary, fontSize: 11, fontWeight: "700" }, topActions: { flexDirection: "row-reverse", alignItems: "center", gap: 10 }, healthPill: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 9, paddingVertical: 6 }, healthDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.success }, healthDotBad: { backgroundColor: colors.error }, healthDotUnknown: { backgroundColor: colors.textMuted }, healthText: { color: colors.textSecondary, fontSize: 10 }, refreshButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, refreshGlyph: { color: colors.textPrimary, fontSize: 18 }, adminAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  page: { flex: 1, minHeight: 0 }, mobileTitleRow: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, mobileTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" }, tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface }, tabsContent: { flexDirection: "row-reverse", gap: 6, paddingHorizontal: 10, paddingVertical: 8 }, tabItem: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.surfaceElevated }, tabContent: { flexDirection: "row-reverse", alignItems: "center", gap: 5 }, tabIcon: { color: colors.textMuted, fontSize: 12 }, tabLabel: { color: colors.textSecondary, fontSize: 10 },
});
