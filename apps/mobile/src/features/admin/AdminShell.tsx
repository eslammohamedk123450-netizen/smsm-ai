import { Slot, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

type NavItem = { path: string; label: string; labelEn: string; icon: keyof typeof Ionicons.glyphMap };
type NavGroup = { key: string; label: string; labelEn: string; hint: string; hintEn: string; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: "overview",
    label: "المتابعة والنشاط", labelEn: "Overview & activity",
    hint: "حالة الخدمة وسجل العمليات", hintEn: "Service health and activity",
    items: [
      { path: "/admin", label: "نظرة عامة", labelEn: "Overview", icon: "home-outline" },
      { path: "/admin/conversations", label: "المحادثات", labelEn: "Conversations", icon: "chatbubbles-outline" },
      { path: "/admin/audit", label: "سجل النشاط", labelEn: "Activity & audit", icon: "list-outline" },
      { path: "/admin/support", label: "الدعم", labelEn: "Support", icon: "help-circle-outline" },
      { path: "/admin/friction", label: "مشاكل وتجربة المستخدم", labelEn: "User friction", icon: "compass-outline" },
    ],
  },
  {
    key: "ai-platform",
    label: "المزودون والنماذج", labelEn: "Providers & models",
    hint: "الكتالوج والاختبارات والقدرات", hintEn: "Catalogue, tests and capabilities",
    items: [
      { path: "/admin/models", label: "النماذج والمزودون", labelEn: "Models & providers", icon: "git-branch-outline" },
      { path: "/admin/image-generation", label: "نماذج الوسائط", labelEn: "Media models", icon: "images-outline" },
      { path: "/admin/brain", label: "القدرات والتحقق", labelEn: "Capabilities & verification", icon: "shield-checkmark-outline" },
      { path: "/admin/agents", label: "الوكيل والتوجيه", labelEn: "Agent & routing", icon: "git-network-outline" },
    ],
  },
  {
    key: "accounts-finance",
    label: "الحسابات والمالية", labelEn: "Accounts & finance",
    hint: "المستخدمون والباقات والأرصدة", hintEn: "Users, plans and credits",
    items: [
      { path: "/admin/users", label: "المستخدمون والاشتراكات", labelEn: "Users & subscriptions", icon: "people-outline" },
      { path: "/admin/credit-management", label: "المحفظة والرصيد", labelEn: "Wallet & credits", icon: "wallet-outline" },
      { path: "/admin/pricing", label: "الأسعار والباقات", labelEn: "Pricing & plans", icon: "pricetags-outline" },
      { path: "/admin/finance", label: "المالية والربحية", labelEn: "Finance & profitability", icon: "calculator-outline" },
    ],
  },
  {
    key: "ads-rewards",
    label: "الإعلانات والمكافآت", labelEn: "Ads & rewards",
    hint: "إعدادات AdMob ومكافآت المستخدمين", hintEn: "AdMob configuration and user rewards",
    items: [
      { path: "/admin/ads", label: "إعدادات الإعلانات", labelEn: "Ad settings", icon: "images-outline" },
    ],
  },
  {
    key: "education",
    label: "HIMS والمحتوى", labelEn: "HIMS & content",
    hint: "الاستحقاقات والموارد التعليمية", hintEn: "Entitlements and learning resources",
    items: [
      { path: "/admin/hims", label: "إدارة HIMS", labelEn: "Manage HIMS", icon: "school-outline" },
    ],
  },
  {
    key: "system",
    label: "النظام والتكاملات", labelEn: "System & integrations",
    hint: "الأمان والمفاتيح والخدمات", hintEn: "Security, keys and services",
    items: [
      { path: "/admin/api-keys", label: "مفاتيح API", labelEn: "API keys", icon: "key-outline" },
      { path: "/admin/composio", label: "Composio", labelEn: "Composio", icon: "apps-outline" },
      { path: "/admin/tavily", label: "Tavily · بحث الويب", labelEn: "Tavily · Web search", icon: "search-outline" },
      { path: "/admin/storage", label: "التخزين", labelEn: "Storage", icon: "cloud-upload-outline" },
      { path: "/admin/circuit-breaker", label: "إعدادات النظام", labelEn: "System settings", icon: "settings-outline" },
      { path: "/admin/page-builder", label: "منشئ صفحات الإدارة", labelEn: "Admin page builder", icon: "grid-outline" },
    ],
  },
] as const;

const WIDE_BREAKPOINT = 900;
const DEFAULT_OPEN_GROUPS = ["overview", "ai-platform"];

export function AdminShell() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [adminName, setAdminName] = useState("A");
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customPages, setCustomPages] = useState<Array<{ page_key: string; title: string }>>([]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setAdminName((data.user?.email?.[0] ?? "A").toLocaleUpperCase(isArabic ? "ar" : "en"));
    });
    return () => { active = false; };
  }, [isArabic]);

  useEffect(() => {
    let active = true;
    void supabase.rpc("suly_admin_list_custom_pages").then(({ data, error }) => {
      if (!active || error || !Array.isArray(data)) return;
      setCustomPages(data.filter((page: any) => page?.status === "published" && typeof page.page_key === "string" && typeof page.title === "string")
        .slice(0, 30).map((page: any) => ({ page_key: page.page_key, title: page.title })));
    }, () => { if (active) setCustomPages([]); });
    return () => { active = false; };
  }, []);

  const navGroups = useMemo<readonly NavGroup[]>(() => [
    ...NAV_GROUPS,
    ...(customPages.length ? [{
      key: "custom-pages",
      label: "صفحات مخصصة", labelEn: "Custom pages",
      hint: "صفحات الإدارة المنشورة", hintEn: "Published admin pages",
      items: customPages.map((page) => ({
        path: `/admin/custom/${page.page_key}`,
        label: page.title, labelEn: page.title, icon: "albums-outline" as const,
      })),
    }] : []),
  ], [customPages]);

  const refreshHealth = async () => {
    setChecking(true);
    try {
      const [modelsResult, healthResult] = await Promise.all([
        supabase.from("ai_models").select("id,enabled").eq("enabled", true).limit(500),
        supabase.from("ai_model_health").select("model_id,last_status,auto_restricted").limit(1000),
      ]);
      if (modelsResult.error || healthResult.error) throw modelsResult.error ?? healthResult.error;
      const activeModels = modelsResult.data ?? [];
      const healthById = new Map((healthResult.data ?? []).map((row) => [Number(row.model_id), row]));
      if (!activeModels.length || activeModels.some((model) => !healthById.has(Number(model.id)))) setSystemOk(null);
      else setSystemOk(activeModels.every((model) => {
        const health = healthById.get(Number(model.id));
        return health?.last_status !== "error" && health?.auto_restricted !== true;
      }));
    } catch { setSystemOk(null); }
    finally { setChecking(false); }
  };
  useEffect(() => { void refreshHealth(); }, []);

  const isActive = (path: string) => path === "/admin" ? pathname === path : pathname === path || pathname.startsWith(path);
  const activeGroupKey = navGroups.find((group) => group.items.some((item) => isActive(item.path)))?.key ?? "overview";

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
        <Ionicons name={item.icon} size={17} color={active ? colors.primary : colors.textMuted} />
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{isArabic ? item.label : item.labelEn}</Text>
      </View>
    </Pressable>;
  };

  const activeItem = navGroups.flatMap((group) => group.items).find((item) => isActive(item.path));

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return [];
    return NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: isArabic ? group.label : group.labelEn })))
      .filter((item) => `${item.label} ${item.labelEn} ${item.path} ${item.groupLabel}`.toLocaleLowerCase().includes(value))
      .slice(0, 6);
  }, [query, isArabic]);

  const openSearchResult = (path: string) => {
    const value = query.trim();
    if (!value) return;
    setSearchOpen(false);
    router.push({ pathname: path as never, params: { q: value } } as never);
  };

  const submitSearch = () => {
    const value = query.trim();
    if (!value) return;
    if (value.includes("@") || /^[0-9a-f-]{30,}$/i.test(value)) {
      setSearchOpen(false);
      router.push({ pathname: "/admin/users", params: { q: value } });
      return;
    }
    if (searchResults.length) openSearchResult(searchResults[0].path);
    else setSearchOpen(true);
  };
  const refreshPage = () => { void refreshHealth(); router.replace(pathname as never); };

  return <View style={styles.root}>
    {wide ? <View style={styles.rail}>
      <View style={styles.brand}><View style={styles.brandBadge}><Text style={styles.brandMark}>S</Text></View><View style={styles.brandCopy}><Text style={styles.brandName}>Suly</Text><Text style={styles.brandSub}>SULY CONTROL CENTER</Text></View></View>
      <Text style={styles.navCaption}>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Text>
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {navGroups.map((group) => {
          const expanded = openGroups.includes(group.key);
          const active = group.key === activeGroupKey;
          return <View key={group.key} style={styles.group}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => toggleGroup(group.key)} style={[styles.groupHeader, active && styles.groupHeaderActive]}>
              <View style={styles.groupCopy}><Text style={[styles.groupLabel, active && styles.groupLabelActive]}>{isArabic ? group.label : group.labelEn}</Text><Text style={styles.groupHint}>{isArabic ? group.hint : group.hintEn}</Text></View>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={active ? colors.primary : colors.textMuted} />
            </Pressable>
            {expanded ? <View style={styles.groupItems}>{group.items.map((item) => renderNavItem(item))}</View> : null}
          </View>;
        })}
      </ScrollView>
      <View style={styles.railFooter}><View style={styles.secureDot} /><Text style={styles.secureText}>{isArabic ? "جلسة مشرف محمية" : "Protected admin session"}</Text></View>
    </View> : null}
    <View style={styles.main}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "الانتقال إلى التطبيق" : "Go to app"} onPress={() => router.replace("/home")} style={styles.appLink}><Ionicons name="home-outline" size={15} color={colors.primary} /><Text style={styles.appLinkText}>{isArabic ? "التطبيق" : "App"}</Text></Pressable>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={17} color={colors.textMuted} /><TextInput value={query} onChangeText={(value) => { setQuery(value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onSubmitEditing={submitSearch} returnKeyType="search" style={styles.searchInput} placeholder={isArabic ? "بحث: مستخدم، نموذج، UUID…" : "Search: user, model, UUID…"} placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={submitSearch}><Text style={styles.searchAction}>{isArabic ? "بحث" : "Search"}</Text></Pressable></View>
        <View style={styles.topActions}>
          <View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? (isArabic ? "الحالة غير متاحة" : "Status unavailable") : systemOk ? (isArabic ? "النظام سليم" : "System healthy") : (isArabic ? "يحتاج مراجعة" : "Needs review")}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث الصفحة" : "Refresh page"} onPress={refreshPage} style={styles.refreshButton}><Ionicons name="refresh-outline" size={17} color={colors.textPrimary} /></Pressable>
          <View style={styles.adminAvatar}><Text style={styles.avatarText}>{adminName}</Text></View>
        </View>
      </View>
      {searchOpen && query.trim() ? <View style={styles.searchResults}>
        {searchResults.length ? searchResults.map((item) => <Pressable key={item.path} accessibilityRole="button" onPress={() => openSearchResult(item.path)} style={styles.searchResult}>
          <Text style={styles.searchResultGroup}>{item.groupLabel}</Text>
          <Text style={styles.searchResultText}>{isArabic ? item.label : item.labelEn}</Text>
          <Text style={styles.searchResultPath}>{item.path}</Text>
        </Pressable>) : <View style={styles.searchEmpty}><Text style={styles.searchEmptyText}>{isArabic ? "لا توجد صفحة مطابقة. جرّب اسم قسم مثل المستخدمين أو النماذج أو المالية." : "No matching admin page. Try users, models or finance."}</Text></View>}
      </View> : null}
      {!wide ? <>
        <View style={styles.mobileTitleRow}>
          <View style={styles.mobileTitleCopy}><Text style={styles.mobileTitle}>{isArabic ? "مركز تحكم الأدمن" : "Admin control center"}</Text><Text style={styles.mobileSubtitle}>{(isArabic ? activeItem?.label : activeItem?.labelEn) ?? (isArabic ? "نظرة عامة" : "Overview")}</Text></View>
          <View style={styles.mobileTitleActions}><View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? (isArabic ? "غير متاح" : "Unavailable") : systemOk ? (isArabic ? "سليم" : "Healthy") : (isArabic ? "مراجعة" : "Review")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "فتح قائمة الإدارة" : "Open admin menu"} onPress={() => setMobileMenuOpen(true)} style={styles.menuButton}><Ionicons name="menu-outline" size={18} color={colors.primary} /><Text style={styles.menuButtonLabel}>{isArabic ? "القائمة" : "Menu"}</Text></Pressable></View>
        </View>
        <Modal visible={mobileMenuOpen} transparent animationType="slide" onRequestClose={() => setMobileMenuOpen(false)}>
          <View style={styles.modalBackdrop}><View style={styles.mobileMenuCard}>
            <View style={styles.mobileMenuHeader}><View><Text style={styles.mobileMenuTitle}>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Text><Text style={styles.mobileMenuHint}>{isArabic ? "اختر القسم أو الصفحة المطلوبة" : "Choose a section or page"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق القائمة" : "Close menu"} onPress={() => setMobileMenuOpen(false)}><Ionicons name="close" size={22} color={colors.textSecondary} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileMenuContent}>{navGroups.map((group) => <View key={group.key} style={styles.mobileGroup}><Text style={styles.mobileGroupLabel}>{isArabic ? group.label : group.labelEn}</Text><Text style={styles.mobileGroupHint}>{isArabic ? group.hint : group.hintEn}</Text>{group.items.map((item) => { const active = isActive(item.path); return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setMobileMenuOpen(false); router.push(item.path); }} style={[styles.mobileMenuItem, active && styles.mobileMenuItemActive]}><Ionicons name={item.icon} size={18} color={active ? colors.primary : colors.textMuted} /><Text style={[styles.mobileMenuText, active && styles.mobileMenuTextActive]}>{isArabic ? item.label : item.labelEn}</Text><Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color={colors.textMuted} /></Pressable>; })}</View>)}</ScrollView>
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
  brandMark: { color: colors.onPrimary, fontSize: 20, fontWeight: "900" }, brandCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 2 }, brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" }, brandSub: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.1 },
  navCaption: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", paddingHorizontal: 11, paddingBottom: 8, letterSpacing: 0.6 }, nav: { flex: 1 },
  group: { marginBottom: 7 }, groupHeader: { minHeight: 49, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8 }, groupHeaderActive: { backgroundColor: colors.background }, groupCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 2 }, groupLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, groupLabelActive: { color: colors.primary }, groupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left" }, groupItems: { paddingTop: 3, paddingRight: isArabic ? 7 : 0, paddingLeft: isArabic ? 0 : 7 },
  navItem: { minHeight: 37, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", marginBottom: 2 }, navItemActive: { backgroundColor: colors.surfaceElevated, borderRightWidth: isArabic ? 3 : 0, borderLeftWidth: isArabic ? 0 : 3, borderLeftColor: colors.primary, borderRightColor: colors.primary }, navContent: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, navLabel: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "right" : "left" }, navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7, justifyContent: "flex-start" }, secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }, secureText: { color: colors.textMuted, fontSize: 10 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  appLink: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, appLinkText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  searchBox: { flex: 1, maxWidth: 560, height: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", paddingHorizontal: 10, gap: 8 }, searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 12, paddingVertical: 0 }, searchAction: { color: colors.primary, fontSize: 11, fontWeight: "700" }, topActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, healthPill: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 9, paddingVertical: 6 }, healthDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.success }, healthDotBad: { backgroundColor: colors.error }, healthDotUnknown: { backgroundColor: colors.textMuted }, healthText: { color: colors.textSecondary, fontSize: 10 }, refreshButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, adminAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  searchResults: { position: "relative", zIndex: 20, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 7, gap: 5 },
  searchResult: { minHeight: 42, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 10, paddingVertical: 6, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  searchResultGroup: { color: colors.textMuted, fontSize: 9 },
  searchResultText: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", flex: 1, textAlign: isArabic ? "right" : "left" },
  searchResultPath: { color: colors.textMuted, fontSize: 8 },
  searchEmpty: { padding: 10 },
  searchEmptyText: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
  page: { flex: 1, minHeight: 0 }, mobileTitleRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface }, mobileTitleCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, mobileTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, mobileSubtitle: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" }, mobileTitleActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7 }, menuButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, menuButtonLabel: { color: colors.primary, fontSize: 10, fontWeight: "800" }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" }, mobileMenuCard: { maxHeight: "86%", borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.surface, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 24 }, mobileMenuHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, mobileMenuTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileMenuHint: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", marginTop: 3 }, mobileMenuContent: { paddingVertical: 12, gap: 16 }, mobileGroup: { gap: 5 }, mobileGroupLabel: { color: colors.primary, fontSize: 12, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileGroupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left", marginBottom: 3 }, mobileMenuItem: { minHeight: 46, borderRadius: 10, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider }, mobileMenuItemActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, mobileMenuText: { flex: 1, color: colors.textSecondary, fontSize: 12, textAlign: isArabic ? "right" : "left" }, mobileMenuTextActive: { color: colors.primary, fontWeight: "800" }, 
});
