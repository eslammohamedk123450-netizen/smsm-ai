import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

type NavItem = { path: string; label: string; labelEn: string; icon: string };
type NavGroup = { key: string; label: string; labelEn: string; hint: string; hintEn: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: "overview",
    label: "المتابعة والنشاط", labelEn: "Overview & activity",
    hint: "حالة الخدمة وسجل العمليات", hintEn: "Service health and activity",
    items: [
      { path: "/admin", label: "نظرة عامة", labelEn: "Overview", icon: "⌂" },
      { path: "/admin/conversations", label: "المحادثات", labelEn: "Conversations", icon: "▤" },
      { path: "/admin/audit", label: "سجل النشاط", labelEn: "Activity & audit", icon: "≡" },
      { path: "/admin/support", label: "الدعم", labelEn: "Support", icon: "?" },
    ],
  },
  {
    key: "ai-platform",
    label: "المزودون والنماذج", labelEn: "Providers & models",
    hint: "الكتالوج والاختبارات والقدرات", hintEn: "Catalogue, tests and capabilities",
    items: [
      { path: "/admin/models", label: "النماذج والمزودون", labelEn: "Models & providers", icon: "◈" },
      { path: "/admin/image-generation", label: "نماذج الوسائط", labelEn: "Media models", icon: "▣" },
      { path: "/admin/brain", label: "القدرات والتحقق", labelEn: "Capabilities & verification", icon: "✧" },
      { path: "/admin/agents", label: "الوكيل والتوجيه", labelEn: "Agent & routing", icon: "✦" },
    ],
  },
  {
    key: "accounts-finance",
    label: "الحسابات والمالية", labelEn: "Accounts & finance",
    hint: "المستخدمون والباقات والأرصدة", hintEn: "Users, plans and credits",
    items: [
      { path: "/admin/users", label: "المستخدمون والاشتراكات", labelEn: "Users & subscriptions", icon: "♙" },
      { path: "/admin/credit-management", label: "المحفظة والرصيد", labelEn: "Wallet & credits", icon: "◉" },
      { path: "/admin/pricing", label: "الأسعار والباقات", labelEn: "Pricing & plans", icon: "▧" },
    ],
  },
  {
    key: "education",
    label: "HIMS والمحتوى", labelEn: "HIMS & content",
    hint: "الاستحقاقات والموارد التعليمية", hintEn: "Entitlements and learning resources",
    items: [
      { path: "/admin/hims", label: "إدارة HIMS", labelEn: "Manage HIMS", icon: "H" },
    ],
  },
  {
    key: "system",
    label: "النظام والتكاملات", labelEn: "System & integrations",
    hint: "الأمان والمفاتيح والخدمات", hintEn: "Security, keys and services",
    items: [
      { path: "/admin/api-keys", label: "مفاتيح API", labelEn: "API keys", icon: "⌘" },
      { path: "/admin/composio", label: "Composio", labelEn: "Composio", icon: "C" },
      { path: "/admin/tavily", label: "Tavily · بحث الويب", labelEn: "Tavily · Web search", icon: "T" },
      { path: "/admin/storage", label: "التخزين", labelEn: "Storage", icon: "↥" },
      { path: "/admin/circuit-breaker", label: "إعدادات النظام", labelEn: "System settings", icon: "⚙" },
    ],
  },
] as const;

const WIDE_BREAKPOINT = 900;
const DEFAULT_OPEN_GROUPS = ["operations", "intelligence"];

export function AdminShell() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [adminName, setAdminName] = useState("A");
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setAdminName((data.user?.email?.[0] ?? "A").toLocaleUpperCase(isArabic ? "ar" : "en"));
    });
    return () => { active = false; };
  }, [isArabic]);

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
  const activeGroupKey = NAV_GROUPS.find((group) => group.items.some((item) => isActive(item.path)))?.key ?? "operations";

  useEffect(() => {
    if (!openGroups.includes(activeGroupKey)) setOpenGroups((current) => [...current, activeGroupKey]);
  }, [activeGroupKey, openGroups]);

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => router.push(item.path)} style={[styles.navItem, active && styles.navItemActive]}>
      <View style={styles.navContent}>
        <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{isArabic ? item.label : item.labelEn}</Text>
      </View>
    </Pressable>;
  };

  const activeItem = NAV_GROUPS.flatMap((group) => group.items).find((item) => isActive(item.path));

  const submitSearch = () => {
    const value = query.trim();
    if (!value) return;
    const destination = value.includes("@") || /^[0-9a-f-]{30,}$/i.test(value) ? "/admin/users" : "/admin/models";
    router.push({ pathname: destination, params: { q: value } });
  };
  const refreshPage = () => { void refreshHealth(); router.replace(pathname as never); };

  return <View style={styles.root}>
    {wide ? <View style={styles.rail}>
      <View style={styles.brand}><View style={styles.brandBadge}><Text style={styles.brandMark}>S</Text></View><View style={styles.brandCopy}><Text style={styles.brandName}>Suly</Text><Text style={styles.brandSub}>SULY CONTROL CENTER</Text></View></View>
      <Text style={styles.navCaption}>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Text>
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {NAV_GROUPS.map((group) => {
          const expanded = openGroups.includes(group.key);
          const active = group.key === activeGroupKey;
          return <View key={group.key} style={styles.group}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => toggleGroup(group.key)} style={[styles.groupHeader, active && styles.groupHeaderActive]}>
              <View style={styles.groupCopy}><Text style={[styles.groupLabel, active && styles.groupLabelActive]}>{isArabic ? group.label : group.labelEn}</Text><Text style={styles.groupHint}>{isArabic ? group.hint : group.hintEn}</Text></View>
              <Text style={[styles.groupChevron, active && styles.groupLabelActive]}>{expanded ? "⌃" : "⌄"}</Text>
            </Pressable>
            {expanded ? <View style={styles.groupItems}>{group.items.map((item) => renderNavItem(item))}</View> : null}
          </View>;
        })}
      </ScrollView>
      <View style={styles.railFooter}><View style={styles.secureDot} /><Text style={styles.secureText}>{isArabic ? "جلسة مشرف محمية" : "Protected admin session"}</Text></View>
    </View> : null}
    <View style={styles.main}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "الانتقال إلى التطبيق" : "Go to app"} onPress={() => router.replace("/home")} style={styles.appLink}><Text style={styles.appLinkIcon}>⌂</Text><Text style={styles.appLinkText}>{isArabic ? "التطبيق" : "App"}</Text></Pressable>
        <View style={styles.searchBox}><Text style={styles.searchGlyph}>⌕</Text><TextInput value={query} onChangeText={setQuery} onSubmitEditing={submitSearch} returnKeyType="search" style={styles.searchInput} placeholder={isArabic ? "بحث: مستخدم، نموذج، UUID…" : "Search: user, model, UUID…"} placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={submitSearch}><Text style={styles.searchAction}>{isArabic ? "بحث" : "Search"}</Text></Pressable></View>
        <View style={styles.topActions}>
          <View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? (isArabic ? "الحالة غير متاحة" : "Status unavailable") : systemOk ? (isArabic ? "النظام سليم" : "System healthy") : (isArabic ? "يحتاج مراجعة" : "Needs review")}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث الصفحة" : "Refresh page"} onPress={refreshPage} style={styles.refreshButton}><Text style={styles.refreshGlyph}>{checking ? "…" : "↻"}</Text></Pressable>
          <View style={styles.adminAvatar}><Text style={styles.avatarText}>{adminName}</Text></View>
        </View>
      </View>
      {!wide ? <>
        <View style={styles.mobileTitleRow}>
          <View style={styles.mobileTitleCopy}><Text style={styles.mobileTitle}>{isArabic ? "مركز تحكم الأدمن" : "Admin control center"}</Text><Text style={styles.mobileSubtitle}>{(isArabic ? activeItem?.label : activeItem?.labelEn) ?? (isArabic ? "نظرة عامة" : "Overview")}</Text></View>
          <View style={styles.mobileTitleActions}><View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? (isArabic ? "غير متاح" : "Unavailable") : systemOk ? (isArabic ? "سليم" : "Healthy") : (isArabic ? "مراجعة" : "Review")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "فتح قائمة الإدارة" : "Open admin menu"} onPress={() => setMobileMenuOpen(true)} style={styles.menuButton}><Text style={styles.menuButtonText}>☰</Text><Text style={styles.menuButtonLabel}>{isArabic ? "القائمة" : "Menu"}</Text></Pressable></View>
        </View>
        <Modal visible={mobileMenuOpen} transparent animationType="slide" onRequestClose={() => setMobileMenuOpen(false)}>
          <View style={styles.modalBackdrop}><View style={styles.mobileMenuCard}>
            <View style={styles.mobileMenuHeader}><View><Text style={styles.mobileMenuTitle}>مساحة الإدارة</Text><Text style={styles.mobileMenuHint}>{isArabic ? "اختر القسم أو الصفحة المطلوبة" : "Choose a section or page"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق القائمة" : "Close menu"} onPress={() => setMobileMenuOpen(false)}><Text style={styles.modalCloseText}>×</Text></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileMenuContent}>{NAV_GROUPS.map((group) => <View key={group.key} style={styles.mobileGroup}><Text style={styles.mobileGroupLabel}>{isArabic ? group.label : group.labelEn}</Text><Text style={styles.mobileGroupHint}>{isArabic ? group.hint : group.hintEn}</Text>{group.items.map((item) => { const active = isActive(item.path); return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setMobileMenuOpen(false); router.push(item.path); }} style={[styles.mobileMenuItem, active && styles.mobileMenuItemActive]}><Text style={[styles.mobileMenuIcon, active && styles.mobileMenuTextActive]}>{item.icon}</Text><Text style={[styles.mobileMenuText, active && styles.mobileMenuTextActive]}>{item.label}</Text><Text style={styles.mobileMenuArrow}>‹</Text></Pressable>; })}</View>)}</ScrollView>
          </View></View>
        </Modal>
      </> : null}
      <View style={styles.page}><Slot /></View>
    </View>
  </View>;
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  root: { flex: 1, flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: colors.background },
  rail: { width: 244, borderLeftWidth: isArabic ? 1 : 0, borderRightWidth: isArabic ? 0 : 1, borderRightColor: colors.divider, borderLeftColor: colors.divider, backgroundColor: colors.surface, paddingVertical: 20, paddingHorizontal: 13 },
  brand: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingBottom: 22 },
  brandBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandMark: { color: colors.onPrimary, fontSize: 20, fontWeight: "900" }, brandCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" }, brandSub: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.1 },
  navCaption: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", paddingHorizontal: 11, paddingBottom: 8, letterSpacing: 0.6 }, nav: { flex: 1 },
  group: { marginBottom: 7 }, groupHeader: { minHeight: 49, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8 }, groupHeaderActive: { backgroundColor: colors.background }, groupCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, groupLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, groupLabelActive: { color: colors.primary }, groupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left" }, groupChevron: { color: colors.textMuted, fontSize: 15, width: 18, textAlign: "center" }, groupItems: { paddingTop: 3, paddingRight: isArabic ? 7 : 0, paddingLeft: isArabic ? 0 : 7 },
  navItem: { minHeight: 37, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", marginBottom: 2 }, navItemActive: { backgroundColor: colors.surfaceElevated, borderRightWidth: isArabic ? 3 : 0, borderLeftWidth: isArabic ? 0 : 3, borderLeftColor: colors.primary, borderRightColor: colors.primary }, navContent: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, navIcon: { minWidth: 20, color: colors.textMuted, fontSize: 14, textAlign: "center" }, navIconActive: { color: colors.primary }, navLabel: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "right" : "left" }, navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7, justifyContent: "flex-start" }, secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }, secureText: { color: colors.textMuted, fontSize: 10 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  appLink: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, appLinkIcon: { color: colors.primary, fontSize: 15 }, appLinkText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  searchBox: { flex: 1, maxWidth: 560, height: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", paddingHorizontal: 10, gap: 8 }, searchGlyph: { color: colors.textMuted, fontSize: 20 }, searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 12, paddingVertical: 0 }, searchAction: { color: colors.primary, fontSize: 11, fontWeight: "700" }, topActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, healthPill: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 9, paddingVertical: 6 }, healthDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.success }, healthDotBad: { backgroundColor: colors.error }, healthDotUnknown: { backgroundColor: colors.textMuted }, healthText: { color: colors.textSecondary, fontSize: 10 }, refreshButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, refreshGlyph: { color: colors.textPrimary, fontSize: 18 }, adminAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  page: { flex: 1, minHeight: 0 }, mobileTitleRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface }, mobileTitleCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, mobileTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, mobileSubtitle: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" }, mobileTitleActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7 }, menuButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, menuButtonText: { color: colors.primary, fontSize: 15, fontWeight: "900" }, menuButtonLabel: { color: colors.primary, fontSize: 10, fontWeight: "800" }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" }, mobileMenuCard: { maxHeight: "86%", borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.surface, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 24 }, mobileMenuHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, mobileMenuTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileMenuHint: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", marginTop: 3 }, modalCloseText: { color: colors.textSecondary, fontSize: 30, lineHeight: 30 }, mobileMenuContent: { paddingVertical: 12, gap: 16 }, mobileGroup: { gap: 5 }, mobileGroupLabel: { color: colors.primary, fontSize: 12, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileGroupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left", marginBottom: 3 }, mobileMenuItem: { minHeight: 46, borderRadius: 10, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider }, mobileMenuItemActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, mobileMenuIcon: { minWidth: 22, color: colors.textMuted, fontSize: 15, textAlign: "center" }, mobileMenuText: { flex: 1, color: colors.textSecondary, fontSize: 12, textAlign: isArabic ? "right" : "left" }, mobileMenuTextActive: { color: colors.primary, fontWeight: "800" }, mobileMenuArrow: { color: colors.textMuted, fontSize: 18 },
});
