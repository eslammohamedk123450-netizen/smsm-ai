import { Slot, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { adminService } from "./admin-service";

type NavItem = { path: string; label: string; labelEn: string; icon: keyof typeof Ionicons.glyphMap };
type NavGroup = { key: string; label: string; labelEn: string; hint: string; hintEn: string; icon: keyof typeof Ionicons.glyphMap; items: readonly NavItem[] };

const NAV_GROUPS: readonly NavGroup[] = [
  { key: "overview", label: "نظرة عامة", labelEn: "Overview", hint: "حالة SULY والنشاط التشغيلي", hintEn: "SULY health and operational activity", icon: "home-outline", items: [
    { path: "/admin", label: "لوحة المتابعة", labelEn: "Operational overview", icon: "home-outline" },
  ] },
  { key: "providers", label: "المزودون والنماذج", labelEn: "Providers & Models", hint: "المزودون وسجل النماذج", hintEn: "Providers and model registry", icon: "layers-outline", items: [
    { path: "/admin/api-keys", label: "المزودون ومفاتيح API", labelEn: "Providers & API keys", icon: "key-outline" },
    { path: "/admin/models", label: "مركز النماذج", labelEn: "Model center", icon: "grid-outline" },
    { path: "/admin/models-catalog", label: "كتالوج النماذج", labelEn: "Model catalog", icon: "list-outline" },
    { path: "/admin/media-catalog?kind=image", label: "نماذج الوسائط", labelEn: "Media models", icon: "images-outline" },
    { path: "/admin/image-generation", label: "إعدادات توليد الصور", labelEn: "Image generation settings", icon: "image-outline" },
  ] },
  { key: "capabilities", label: "القدرات والاختبارات", labelEn: "Capabilities & Tests", hint: "الأدلة والاختبارات وحالة الصحة", hintEn: "Evidence, tests and health status", icon: "flask-outline", items: [
    { path: "/admin/model-capabilities", label: "قدرات النماذج", labelEn: "Model capabilities", icon: "extension-puzzle-outline" },
    { path: "/admin/model-capability-review", label: "مراجعة أدلة القدرات", labelEn: "Capability evidence review", icon: "clipboard-outline" },
    { path: "/admin/models-operations", label: "التشغيل والاختبارات", labelEn: "Operations & tests", icon: "pulse-outline" },
  ] },
  { key: "routing-agent", label: "التوجيه والوكيل المركزي", labelEn: "Routing & Agent", hint: "سياسات التوجيه وأدوار الوكيل الواحد", hintEn: "Routing policies and the single central Agent", icon: "git-network-outline", items: [
    { path: "/admin/agents", label: "إعدادات الوكيل والتوجيه", labelEn: "Agent & routing settings", icon: "git-branch-outline" },
  ] },
  { key: "pricing", label: "الأسعار والباقات", labelEn: "Pricing & Plans", hint: "إصدارات الأسعار واستحقاقات الباقات", hintEn: "Versioned prices and plan entitlements", icon: "pricetags-outline", items: [
    { path: "/admin/pricing", label: "الأسعار والباقات", labelEn: "Pricing & plans", icon: "pricetags-outline" },
  ] },
  { key: "credits", label: "الأرصدة والمحفظة", labelEn: "Credits & Wallet", hint: "الرصيد والحركات والتسوية", hintEn: "Balances, ledger and settlement", icon: "wallet-outline", items: [
    { path: "/admin/credit-management", label: "إدارة المحفظة", labelEn: "Wallet management", icon: "wallet-outline" },
  ] },
  { key: "users", label: "المستخدمون والحسابات", labelEn: "Users & Accounts", hint: "الحسابات والاشتراكات", hintEn: "Accounts and subscriptions", icon: "people-outline", items: [
    { path: "/admin/users", label: "المستخدمون والاشتراكات", labelEn: "Users & subscriptions", icon: "people-outline" },
  ] },
  { key: "ads", label: "الإعلانات والمكافآت", labelEn: "Ads & Rewards", hint: "إعدادات الإعلانات ومكافآت المستخدمين", hintEn: "Ad settings and user rewards", icon: "gift-outline", items: [
    { path: "/admin/ads", label: "الإعلانات والمكافآت", labelEn: "Ads & rewards", icon: "gift-outline" },
  ] },
  { key: "finance", label: "المالية والربحية", labelEn: "Finance & Profit", hint: "التكاليف والإيرادات والتقارير المالية", hintEn: "Costs, revenue and finance reporting", icon: "calculator-outline", items: [
    { path: "/admin/finance", label: "المالية والربحية", labelEn: "Finance & profitability", icon: "calculator-outline" },
  ] },
  { key: "activity", label: "النشاط وسجل التدقيق", labelEn: "Activity & Audit", hint: "الأحداث والدعم وملاحظات الاستخدام", hintEn: "Events, support and usage feedback", icon: "time-outline", items: [
    { path: "/admin/audit", label: "سجل التدقيق", labelEn: "Audit log", icon: "list-outline" },
    { path: "/admin/conversations", label: "المحادثات", labelEn: "Conversations", icon: "chatbubbles-outline" },
    { path: "/admin/support", label: "الدعم", labelEn: "Support inbox", icon: "help-circle-outline" },
    { path: "/admin/friction", label: "مشاكل تجربة المستخدم", labelEn: "User friction", icon: "compass-outline" },
  ] },
  { key: "hims", label: "HIMS والمحتوى", labelEn: "HIMS & Content", hint: "الاستحقاقات والموارد التعليمية", hintEn: "Educational entitlements and resources", icon: "school-outline", items: [
    { path: "/admin/hims", label: "إدارة HIMS", labelEn: "HIMS management", icon: "school-outline" },
  ] },
  { key: "system", label: "النظام والأمان", labelEn: "System & Security", hint: "التخزين والتكاملات وإعدادات النظام", hintEn: "Storage, integrations and system settings", icon: "shield-checkmark-outline", items: [
    { path: "/admin/circuit-breaker", label: "إعدادات النظام", labelEn: "System settings", icon: "settings-outline" },
    { path: "/admin/storage", label: "التخزين", labelEn: "Storage", icon: "cloud-outline" },
    { path: "/admin/composio", label: "Composio", labelEn: "Composio connector", icon: "apps-outline" },
    { path: "/admin/tavily", label: "Tavily · بحث الويب", labelEn: "Tavily · web search", icon: "search-outline" },
    { path: "/admin/page-builder", label: "منشئ صفحات الإدارة", labelEn: "Admin page builder", icon: "construct-outline" },
  ] },
] as const;

const WIDE_BREAKPOINT = 900;
const SIDEBAR_STORAGE_KEY = "suly:admin:sidebar-collapsed";
const DEFAULT_OPEN_GROUPS = ["overview", "providers"];

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
  const [adminEmail, setAdminEmail] = useState("");
  const [shellDialog, setShellDialog] = useState<"help" | "notifications" | "account" | "signout-error" | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [customPages, setCustomPages] = useState<Array<{ page_key: string; title: string }>>([]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setAdminName((data.user?.email?.[0] ?? "A").toLocaleUpperCase(isArabic ? "ar" : "en"));
        setAdminEmail(data.user?.email ?? "");
      }
    });
    return () => { active = false; };
  }, [isArabic]);


  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SIDEBAR_STORAGE_KEY)
      .then((value) => { if (active && value === "true") setSidebarCollapsed(true); })
      .catch(() => undefined)
      .finally(() => { if (active) setSidebarPreferenceReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (sidebarPreferenceReady) void AsyncStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed)).catch(() => undefined);
  }, [sidebarCollapsed, sidebarPreferenceReady]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)));
      if ((event.key === "/" && !isEditing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setHoveredNavItem(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.rpc("suly_admin_list_custom_pages").then(({ data, error }) => {
      if (!active || error || !Array.isArray(data)) return;
      setCustomPages(data.filter((page: any) => page?.status === "published" && typeof page.page_key === "string" && typeof page.title === "string")
        .slice(0, 30).map((page: any) => ({ page_key: page.page_key, title: page.title })));
    }, () => { if (active) setCustomPages([]); });
    return () => { active = false; };
  }, []);

  const navGroups = useMemo<readonly NavGroup[]>(() => NAV_GROUPS.map((group) => {
    if (group.key !== "system" || customPages.length === 0) return group;
    return {
      ...group,
      items: [
        ...group.items,
        ...customPages.map((page) => ({
          path: `/admin/custom/${page.page_key}`,
          label: page.title,
          labelEn: page.title,
          icon: "albums-outline" as const,
        })),
      ],
    };
  }), [customPages]);

  const refreshHealth = async () => {
    setChecking(true);
    try {
      const overview = await adminService.getModelsOverview();
      const activeModels = overview.models.filter((model) => model.enabled);
      if (!activeModels.length || activeModels.some((model) => !model.health)) setSystemOk(null);
      else setSystemOk(activeModels.every((model) =>
        model.health?.last_status !== "error" && model.health?.auto_restricted !== true,
      ));
    } catch { setSystemOk(null); }
    finally { setChecking(false); }
  };
  useEffect(() => { void refreshHealth(); }, []);

  const isActive = (path: string) => { const route = path.split("?")[0]; return route === "/admin" ? pathname === route : pathname === route || pathname.startsWith(route); };
  const activeGroupKey = navGroups.find((group) => group.items.some((item) => isActive(item.path)))?.key ?? "overview";

  useEffect(() => {
    if (!openGroups.includes(activeGroupKey)) setOpenGroups((current) => [...current, activeGroupKey]);
  }, [activeGroupKey, openGroups]);

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const tooltipKey = `item:${item.path}`;
    const label = isArabic ? item.label : item.labelEn;
    return <View key={item.path} style={sidebarCollapsed ? styles.collapsedNavItemWrap : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => router.push(item.path)}
        onHoverIn={() => setHoveredNavItem(tooltipKey)}
        onHoverOut={() => setHoveredNavItem((current) => current === tooltipKey ? null : current)}
        onFocus={() => setHoveredNavItem(tooltipKey)}
        onBlur={() => setHoveredNavItem((current) => current === tooltipKey ? null : current)}
        style={[styles.navItem, sidebarCollapsed && styles.navItemCollapsed, active && styles.navItemActive]}
      >
        <View style={[styles.navContent, sidebarCollapsed && styles.navContentCollapsed]}>
          <Ionicons name={item.icon} size={17} color={active ? colors.primary : colors.textMuted} />
          {!sidebarCollapsed ? <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text> : null}
        </View>
      </Pressable>
      {sidebarCollapsed && hoveredNavItem === tooltipKey ? <View pointerEvents="none" style={[styles.navTooltip, isArabic ? styles.navTooltipRtl : styles.navTooltipLtr]}><Text style={styles.navTooltipText}>{label}</Text></View> : null}
    </View>;
  };

  const activeItem = navGroups.flatMap((group) => group.items).find((item) => isActive(item.path));
  const activeGroup = navGroups.find((group) => group.key === activeGroupKey);

  const signOutAdmin = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { setShellDialog("signout-error"); return; }
    setShellDialog(null);
    router.replace("/login");
  };

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return [];
    return navGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: isArabic ? group.label : group.labelEn })))
      .filter((item) => `${item.label} ${item.labelEn} ${item.path} ${item.groupLabel}`.toLocaleLowerCase().includes(value))
      .slice(0, 8);
  }, [navGroups, query, isArabic]);

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
    {wide ? <View style={[styles.rail, sidebarCollapsed && styles.railCollapsed]}>
      <View style={[styles.brand, sidebarCollapsed && styles.brandCollapsed]}><View style={styles.brandBadge}><Text style={styles.brandMark}>S</Text></View>{!sidebarCollapsed ? <View style={styles.brandCopy}><Text style={styles.brandName}>Suly</Text><Text style={styles.brandSub}>SULY CONTROL CENTER</Text></View> : null}</View>
      {!sidebarCollapsed ? <Text style={styles.navCaption}>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Text> : null}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {navGroups.map((group) => {
          const expanded = openGroups.includes(group.key);
          const active = group.key === activeGroupKey;
          const tooltipKey = `group:${group.key}`;
          const groupLabel = isArabic ? group.label : group.labelEn;
          return <View key={group.key} style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={groupLabel}
              accessibilityHint={isArabic ? group.hint : group.hintEn}
              accessibilityState={{ expanded }}
              onPress={() => toggleGroup(group.key)}
              onHoverIn={() => setHoveredNavItem(tooltipKey)}
              onHoverOut={() => setHoveredNavItem((current) => current === tooltipKey ? null : current)}
              onFocus={() => setHoveredNavItem(tooltipKey)}
              onBlur={() => setHoveredNavItem((current) => current === tooltipKey ? null : current)}
              style={[styles.groupHeader, sidebarCollapsed && styles.groupHeaderCollapsed, active && styles.groupHeaderActive]}
            >
              <Ionicons name={group.icon} size={18} color={active ? colors.primary : colors.textMuted} />
              {!sidebarCollapsed ? <View style={styles.groupCopy}><Text style={[styles.groupLabel, active && styles.groupLabelActive]}>{groupLabel}</Text><Text style={styles.groupHint}>{isArabic ? group.hint : group.hintEn}</Text></View> : null}
              {!sidebarCollapsed ? <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={active ? colors.primary : colors.textMuted} /> : null}
            </Pressable>
            {sidebarCollapsed && hoveredNavItem === tooltipKey ? <View pointerEvents="none" style={[styles.navTooltip, isArabic ? styles.navTooltipRtl : styles.navTooltipLtr]}><Text style={styles.navTooltipText}>{groupLabel}</Text></View> : null}
            {expanded ? <View style={[styles.groupItems, sidebarCollapsed && styles.groupItemsCollapsed]}>{group.items.map((item) => renderNavItem(item))}</View> : null}
          </View>;
        })}
      </ScrollView>
      <View style={[styles.railFooter, sidebarCollapsed && styles.railFooterCollapsed]}>
        <View style={styles.secureDot} />
        {!sidebarCollapsed ? <Text style={styles.secureText}>{isArabic ? "جلسة مشرف محمية" : "Protected admin session"}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={sidebarCollapsed ? (isArabic ? "توسيع القائمة الجانبية" : "Expand sidebar") : (isArabic ? "طي القائمة الجانبية" : "Collapse sidebar")} onPress={() => setSidebarCollapsed((value) => !value)} style={styles.collapseButton}>
          <Ionicons name={sidebarCollapsed ? (isArabic ? "chevron-back" : "chevron-forward") : (isArabic ? "chevron-forward" : "chevron-back")} size={16} color={colors.textSecondary} />
          {!sidebarCollapsed ? <Text style={styles.collapseButtonText}>{isArabic ? "طي القائمة" : "Collapse"}</Text> : null}
        </Pressable>
      </View>
    </View> : null}
    <View style={styles.main}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "الانتقال إلى التطبيق" : "Go to app"} onPress={() => router.replace("/home")} style={styles.appLink}><Ionicons name="home-outline" size={15} color={colors.primary} /><Text style={styles.appLinkText}>{isArabic ? "التطبيق" : "App"}</Text></Pressable>
        {wide ? <View style={styles.breadcrumbs}>
          <Text style={styles.breadcrumbRoot}>{isArabic ? "مركز التحكم" : "Control Center"}</Text>
          <Text style={styles.breadcrumbSeparator}>/</Text>
          <Text style={styles.breadcrumbText}>{isArabic ? activeGroup?.label : activeGroup?.labelEn}</Text>
          {activeItem ? <><Text style={styles.breadcrumbSeparator}>/</Text><Text style={styles.breadcrumbCurrent}>{isArabic ? activeItem.label : activeItem.labelEn}</Text></> : null}
        </View> : null}
        <View style={styles.searchBox}><Ionicons name="search-outline" size={17} color={colors.textMuted} /><TextInput ref={searchInputRef} value={query} onChangeText={(value) => { setQuery(value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onSubmitEditing={submitSearch} returnKeyType="search" style={styles.searchInput} placeholder={isArabic ? "بحث: مستخدم، نموذج، UUID…" : "Search: user, model, UUID…"} placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={submitSearch}><Text style={styles.searchAction}>{isArabic ? "بحث" : "Search"}</Text></Pressable></View>
        <View style={styles.topActions}>
          <View style={styles.healthPill}><View style={[styles.healthDot, systemOk === false && styles.healthDotBad, systemOk === null && styles.healthDotUnknown]} /><Text style={styles.healthText}>{systemOk === null ? (isArabic ? "الحالة غير متاحة" : "Status unavailable") : systemOk ? (isArabic ? "النظام سليم" : "System healthy") : (isArabic ? "يحتاج مراجعة" : "Needs review")}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "المساعدة" : "Help"} accessibilityHint={isArabic ? "عرض حالة وجهة المساعدة" : "Show help availability"} onPress={() => setShellDialog("help")} style={styles.actionIconButton}><Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "الإشعارات" : "Notifications"} accessibilityHint={isArabic ? "عرض حالة مركز الإشعارات" : "Show notification center availability"} onPress={() => setShellDialog("notifications")} style={styles.actionIconButton}><Ionicons name="notifications-outline" size={18} color={colors.textSecondary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "قائمة المشرف والجلسة" : "Administrator and session menu"} onPress={() => setShellDialog("account")} style={styles.adminAvatar}><Text style={styles.avatarText}>{adminName}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث الصفحة" : "Refresh page"} onPress={refreshPage} style={styles.refreshButton}><Ionicons name="refresh-outline" size={17} color={colors.textPrimary} /></Pressable>
        </View>
      </View>
      <Modal visible={shellDialog !== null} transparent animationType="fade" onRequestClose={() => setShellDialog(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogScrim} onPress={() => setShellDialog(null)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق النافذة" : "Close dialog"} />
          <View style={styles.shellDialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>
                {shellDialog === "notifications" ? (isArabic ? "مركز الإشعارات" : "Notifications")
                  : shellDialog === "help" ? (isArabic ? "المساعدة" : "Help")
                  : shellDialog === "account" ? (isArabic ? "حساب المشرف" : "Administrator account")
                  : (isArabic ? "تعذر إنهاء الجلسة" : "Could not end session")}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"} onPress={() => setShellDialog(null)}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>
            {shellDialog === "notifications" ? <Text style={styles.dialogBody}>{isArabic ? "مركز الإشعارات غير متاح حاليًا؛ لا يوجد مصدر إشعارات موصول يمكن تأكيده. لن نعرض إشعارات أو عدّادًا وهميًا." : "The notification center is unavailable because no verified notification source is connected. No synthetic notifications or unread count are shown."}</Text> : null}
            {shellDialog === "help" ? <Text style={styles.dialogBody}>{isArabic ? "لم يتم إعداد وجهة مساعدة داخلية لهذه النسخة بعد. لا يوجد رابط مساعدة نشط حاليًا." : "An internal help destination is not configured for this build. No active help link is available."}</Text> : null}
            {shellDialog === "account" ? <>
              <Text style={styles.dialogBody}>{adminEmail || (isArabic ? "بريد الحساب غير متاح" : "Account email unavailable")}</Text>
              <Text style={styles.dialogHint}>{isArabic ? "تظل كل صلاحيات الإدارة محمية بالتحقق من الخادم." : "Administrative permissions remain enforced by server-side authorization."}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setShellDialog(null); router.replace("/home"); }} style={styles.dialogSecondaryAction}><Text style={styles.dialogSecondaryText}>{isArabic ? "العودة إلى التطبيق" : "Return to app"}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void signOutAdmin()} style={styles.dialogDangerAction}><Text style={styles.dialogDangerText}>{isArabic ? "تسجيل الخروج" : "Sign out"}</Text></Pressable>
            </> : null}
            {shellDialog === "signout-error" ? <>
              <Text style={styles.dialogBody}>{isArabic ? "لم يؤكد نظام المصادقة إنهاء الجلسة. لا تزال لوحة الإدارة مفتوحة." : "Authentication did not confirm session termination. The admin workspace remains open."}</Text>
              <Pressable accessibilityRole="button" onPress={() => void signOutAdmin()} style={styles.dialogDangerAction}><Text style={styles.dialogDangerText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text></Pressable>
            </> : null}
          </View>
        </View>
      </Modal>
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
  railCollapsed: { width: 76, paddingHorizontal: 8 },
  brand: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingBottom: 22 },
  brandCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  brandBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandMark: { color: colors.onPrimary, fontSize: 20, fontWeight: "900" }, brandCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 2 }, brandName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" }, brandSub: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.1 },
  navCaption: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", paddingHorizontal: 11, paddingBottom: 8, letterSpacing: 0.6 }, nav: { flex: 1 },
  group: { marginBottom: 7, position: "relative" }, groupHeader: { minHeight: 49, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 8 }, groupHeaderCollapsed: { minHeight: 44, paddingHorizontal: 0, justifyContent: "center" }, groupHeaderActive: { backgroundColor: colors.background }, groupCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 2 }, groupLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, groupLabelActive: { color: colors.primary }, groupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left" }, groupItems: { paddingTop: 3, paddingRight: isArabic ? 7 : 0, paddingLeft: isArabic ? 0 : 7 }, groupItemsCollapsed: { paddingHorizontal: 0 },
  collapsedNavItemWrap: { position: "relative", alignItems: "center", zIndex: 3 },
  navItem: { minHeight: 37, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", marginBottom: 2 }, navItemCollapsed: { minHeight: 38, paddingHorizontal: 0, alignItems: "center" }, navItemActive: { backgroundColor: colors.surfaceElevated, borderRightWidth: isArabic ? 3 : 0, borderLeftWidth: isArabic ? 0 : 3, borderLeftColor: colors.primary, borderRightColor: colors.primary }, navContent: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, navContentCollapsed: { justifyContent: "center" }, navLabel: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "right" : "left" }, navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  navTooltip: { position: "absolute", top: 2, zIndex: 100, minWidth: 132, maxWidth: 210, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, elevation: 8 }, navTooltipLtr: { left: 60 }, navTooltipRtl: { right: 60 }, navTooltipText: { color: colors.textPrimary, fontSize: 10, fontWeight: "700", textAlign: "center" },
  railFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7, justifyContent: "flex-start", flexWrap: "wrap" }, railFooterCollapsed: { justifyContent: "center" }, secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }, secureText: { color: colors.textMuted, fontSize: 10 }, collapseButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 30, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, marginTop: 4 }, collapseButtonText: { color: colors.textSecondary, fontSize: 9, fontWeight: "700" },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  appLink: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  actionIconButton: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, appLinkText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  breadcrumbs: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, minWidth: 0, maxWidth: 280 }, breadcrumbRoot: { color: colors.textMuted, fontSize: 9, fontWeight: "700" }, breadcrumbSeparator: { color: colors.textMuted, fontSize: 9 }, breadcrumbText: { color: colors.textSecondary, fontSize: 9 }, breadcrumbCurrent: { color: colors.textPrimary, fontSize: 9, fontWeight: "800", flexShrink: 1 },
  searchBox: { flex: 1, maxWidth: 560, height: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", paddingHorizontal: 10, gap: 8 }, searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 12, paddingVertical: 0 }, searchAction: { color: colors.primary, fontSize: 11, fontWeight: "700" }, topActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, healthPill: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 9, paddingVertical: 6 }, healthDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.success }, healthDotBad: { backgroundColor: colors.error }, healthDotUnknown: { backgroundColor: colors.textMuted }, healthText: { color: colors.textSecondary, fontSize: 10 }, refreshButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, adminAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  dialogBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }, dialogScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.modalOverlay }, shellDialog: { width: "100%", maxWidth: 420, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: 16, gap: 11, elevation: 12 }, dialogHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, dialogTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, dialogBody: { color: colors.textSecondary, fontSize: 11, lineHeight: 19, textAlign: isArabic ? "right" : "left" }, dialogHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left" }, dialogSecondaryAction: { minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 12 }, dialogSecondaryText: { color: colors.textPrimary, fontSize: 10, fontWeight: "800" }, dialogDangerAction: { minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.error, borderRadius: 9, paddingHorizontal: 12 }, dialogDangerText: { color: colors.error, fontSize: 10, fontWeight: "800" },
  searchResults: { position: "relative", zIndex: 20, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 7, gap: 5 },
  searchResult: { minHeight: 42, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 10, paddingVertical: 6, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  searchResultGroup: { color: colors.textMuted, fontSize: 9 },
  searchResultText: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", flex: 1, textAlign: isArabic ? "right" : "left" },
  searchResultPath: { color: colors.textMuted, fontSize: 8 },
  searchEmpty: { padding: 10 },
  searchEmptyText: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
  page: { flex: 1, minHeight: 0 }, mobileTitleRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface }, mobileTitleCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, mobileTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, mobileSubtitle: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" }, mobileTitleActions: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7 }, menuButton: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, menuButtonLabel: { color: colors.primary, fontSize: 10, fontWeight: "800" }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" }, mobileMenuCard: { maxHeight: "86%", borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.surface, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 24 }, mobileMenuHeader: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, mobileMenuTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileMenuHint: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", marginTop: 3 }, mobileMenuContent: { paddingVertical: 12, gap: 16 }, mobileGroup: { gap: 5 }, mobileGroupLabel: { color: colors.primary, fontSize: 12, fontWeight: "900", textAlign: isArabic ? "right" : "left" }, mobileGroupHint: { color: colors.textMuted, fontSize: 9, textAlign: isArabic ? "right" : "left", marginBottom: 3 }, mobileMenuItem: { minHeight: 46, borderRadius: 10, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider }, mobileMenuItemActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, mobileMenuText: { flex: 1, color: colors.textSecondary, fontSize: 12, textAlign: isArabic ? "right" : "left" }, mobileMenuTextActive: { color: colors.primary, fontWeight: "800" }, 
});
