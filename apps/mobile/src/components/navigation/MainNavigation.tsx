import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumText as Text } from "../ui/PremiumText";
import { AppLogo } from "../ui/AppLogo";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";
import type { ThemePalette } from "../../theme/colors";
import { chatService, type Conversation } from "../../features/chat/chat-service";
import { useAuth } from "../../features/auth/auth-provider";

type Props = { children: React.ReactNode };
const NavigationMenuContext = createContext<(() => void) | null>(null);
const PlusMenuContext = createContext<(() => void) | null>(null);

export function useNavigationMenu() {
  return useContext(NavigationMenuContext) ?? (() => undefined);
}

export function usePlusMenu() {
  return useContext(PlusMenuContext) ?? (() => undefined);
}

const BASIC_CHAT_ONLY = true;

const ITEMS = [
  { key: "account", labelAr: "الحساب", labelEn: "Account", href: "/settings", icon: "person-circle-outline" as const },
] as const;

function activeSection(pathname: string): string {
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/studio") || pathname.startsWith("/image-studio") || pathname.startsWith("/video-studio")) return "studio";
  if (pathname.startsWith("/media") || pathname.startsWith("/hims")) return "library";
  if (pathname.startsWith("/integrations")) return "tools";
  if (pathname.startsWith("/settings") || pathname.startsWith("/support") || pathname.startsWith("/upgrade") || pathname.startsWith("/balance")) return "account";
  return "conversations";
}

export function MainNavigation({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const { user, profileFullName } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && viewportWidth >= 1024;
  const sidebarStorageKey = `suly:sidebar-collapsed:${user?.id ?? "guest"}`;
  const [sidebarPreference, setSidebarPreference] = useState<{ key: string; collapsed: boolean }>({ key: "", collapsed: false });
  const sidebarCollapsed = isDesktop && sidebarPreference.key === sidebarStorageKey && sidebarPreference.collapsed;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(false);
  const [recentRefresh, setRecentRefresh] = useState(0);
  const active = activeSection(pathname);
  const isChat = pathname.startsWith("/chat");

  useEffect(() => {
    if (BASIC_CHAT_ONLY && !pathname.startsWith("/chat") && !pathname.startsWith("/admin") && !pathname.startsWith("/settings")) router.replace("/chat");
  }, [pathname, router]);

  useEffect(() => {
    let activeRequest = true;
    void AsyncStorage.getItem(sidebarStorageKey).then((stored) => {
      if (activeRequest) setSidebarPreference({ key: sidebarStorageKey, collapsed: stored === "true" });
    }).catch(() => {
      if (activeRequest) setSidebarPreference({ key: sidebarStorageKey, collapsed: false });
    });
    return () => { activeRequest = false; };
  }, [sidebarStorageKey]);

  useEffect(() => {
    if (sidebarPreference.key !== sidebarStorageKey) return;
    void AsyncStorage.setItem(sidebarStorageKey, String(sidebarPreference.collapsed)).catch(() => undefined);
  }, [sidebarPreference, sidebarStorageKey]);

  const toggleSidebar = () => setSidebarPreference({ key: sidebarStorageKey, collapsed: !sidebarCollapsed });

  useEffect(() => {
    if (pathname.startsWith("/admin") || (!isDesktop && !drawerVisible)) return;
    let activeRequest = true;
    setRecentLoading(true);
    setRecentError(false);
    void chatService.listConversations(6).then((items) => {
      if (activeRequest) setRecentConversations(items);
    }).catch(() => {
      if (activeRequest) setRecentError(true);
    }).finally(() => {
      if (activeRequest) setRecentLoading(false);
    });
    return () => { activeRequest = false; };
  }, [drawerVisible, isDesktop, pathname, recentRefresh]);

  if (pathname.startsWith("/admin")) return <>{children}</>;

  const openDrawer = () => setDrawerVisible(true);
  const goHome = () => {
    setDrawerVisible(false);
    router.replace("/chat");
  };

  const navigate = (href: string) => {
    setDrawerVisible(false);
    if (href === "/chat") router.replace("/chat");
    else router.replace(href as never);
  };

  const sidebarContent = (
    <>
      <View style={[styles.drawerHeader, { flexDirection: isArabic ? "row-reverse" : "row" }, sidebarCollapsed && styles.collapsedHeader]}>
        <AppLogo size={44} />
        {!sidebarCollapsed ? (
          <View style={styles.drawerBrandCopy}>
            <Text style={[styles.drawerBrandName, { color: colors.textPrimary }]}>SULY</Text>
            <Text style={[styles.drawerSubtitle, { color: colors.textMuted }]}>{isArabic ? "شريكك الذكي" : "Your intelligent partner"}</Text>
          </View>
        ) : null}
        {isDesktop ? (
          <Pressable onPress={toggleSidebar} style={[styles.closeButton, sidebarCollapsed && styles.collapseButtonCentered]} accessibilityRole="button" accessibilityLabel={sidebarCollapsed ? (isArabic ? "توسيع القائمة الجانبية" : "Expand sidebar") : (isArabic ? "طي القائمة الجانبية" : "Collapse sidebar")} accessibilityHint={isArabic ? "تغيير عرض القائمة دون التأثير على المحتوى" : "Change sidebar width without changing the current page"}>
            <Ionicons name={sidebarCollapsed ? (isArabic ? "chevron-back" : "chevron-forward") : (isArabic ? "chevron-forward" : "chevron-back")} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setDrawerVisible(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"}>
            <Ionicons name="close" size={21} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.drawerItems}>
          <Pressable onPress={() => navigate("/chat")} accessibilityRole="button" accessibilityLabel={isArabic ? "محادثة جديدة" : "New conversation"} style={[styles.drawerItem, sidebarCollapsed && styles.collapsedDrawerItem, sidebarCollapsed && styles.sidebarTooltipAnchor, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: colors.surfaceElevated }]}
            onHoverIn={() => setHoveredSidebarItem("new-chat")} onHoverOut={() => setHoveredSidebarItem(null)} onFocus={() => setHoveredSidebarItem("new-chat")} onBlur={() => setHoveredSidebarItem(null)}>
            <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
            {!sidebarCollapsed ? <Text style={[styles.drawerItemText, { color: colors.textPrimary, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? "محادثة جديدة" : "New chat"}</Text> : null}
            {sidebarCollapsed && hoveredSidebarItem === "new-chat" ? <View pointerEvents="none" style={[styles.sidebarTooltip, isArabic ? { right: "100%" } : { left: "100%" }]}><Text style={[styles.sidebarTooltipText, { color: colors.textPrimary }]}>{isArabic ? "محادثة جديدة" : "New chat"}</Text></View> : null}
          </Pressable>
          {ITEMS.map((item) => {
            const selected = active === item.key;
            return (
              <Pressable key={item.key} onPress={() => navigate(item.href)} accessibilityRole="button" accessibilityLabel={isArabic ? item.labelAr : item.labelEn} accessibilityState={{ selected }}
                style={[styles.drawerItem, sidebarCollapsed && styles.collapsedDrawerItem, sidebarCollapsed && styles.sidebarTooltipAnchor, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: selected ? colors.surfaceElevated : "transparent" }]}
                onHoverIn={() => setHoveredSidebarItem(item.key)} onHoverOut={() => setHoveredSidebarItem(null)} onFocus={() => setHoveredSidebarItem(item.key)} onBlur={() => setHoveredSidebarItem(null)}>
                <Ionicons name={item.icon} size={20} color={selected ? colors.textPrimary : colors.textMuted} />
                {!sidebarCollapsed ? <Text style={[styles.drawerItemText, { color: selected ? colors.textPrimary : colors.textSecondary, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? item.labelAr : item.labelEn}</Text> : null}
                {!sidebarCollapsed && selected ? <View style={[styles.selectedMark, { backgroundColor: colors.textPrimary }]} /> : null}
                {sidebarCollapsed && hoveredSidebarItem === item.key ? <View pointerEvents="none" style={[styles.sidebarTooltip, isArabic ? { right: "100%" } : { left: "100%" }]}><Text style={[styles.sidebarTooltipText, { color: colors.textPrimary }]}>{isArabic ? item.labelAr : item.labelEn}</Text></View> : null}
              </Pressable>
            );
          })}
        </View>

        {!sidebarCollapsed ? (
          <View style={styles.recentSection}>
            <View style={[styles.recentHeading, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Text style={[styles.recentTitle, { color: colors.textMuted }]}>{isArabic ? "أحدث المحادثات" : "Recent chats"}</Text>
              <Text style={[styles.recentCount, { color: colors.textMuted }]}>{recentConversations.length}/6</Text>
            </View>
            {recentLoading ? (
              <View style={styles.recentState}><Text style={[styles.recentStateText, { color: colors.textMuted }]}>{isArabic ? "جارٍ تحميل المحادثات..." : "Loading chats..."}</Text></View>
            ) : recentError ? (
              <Pressable onPress={() => setRecentRefresh((value) => value + 1)} style={styles.recentState} accessibilityRole="button">
                <Text style={[styles.recentStateText, { color: colors.textSecondary }]}>{isArabic ? "تعذر التحميل — اضغط لإعادة المحاولة" : "Could not load — tap to retry"}</Text>
              </Pressable>
            ) : recentConversations.length ? recentConversations.map((conversation) => (
              <Pressable key={conversation.id} onPress={() => navigate("/chat?conversationId=" + encodeURIComponent(conversation.id))}
                style={[styles.recentItem, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button" accessibilityLabel={conversation.title}>
                <Ionicons name={conversation.isPinned ? "pin-outline" : "chatbubble-outline"} size={16} color={colors.textMuted} />
                <Text numberOfLines={1} style={[styles.recentItemText, { color: colors.textSecondary, textAlign: isArabic ? "right" : "left" }]}>{conversation.title}</Text>
              </Pressable>
            )) : (
              <View style={styles.recentState}><Text style={[styles.recentStateText, { color: colors.textMuted }]}>{isArabic ? "لا توجد محادثات بعد" : "No conversations yet"}</Text></View>
            )}
            <Pressable onPress={() => navigate("/conversations")} style={[styles.viewAllButton, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
              <Text style={[styles.viewAllText, { color: colors.textPrimary }]}>{isArabic ? "عرض المزيد" : "Show more"}</Text>
              <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : recentConversations.length ? (
          <View style={styles.collapsedRecentList}>
            {recentConversations.slice(0, 6).map((conversation) => (
              <Pressable key={conversation.id} onPress={() => navigate("/chat?conversationId=" + encodeURIComponent(conversation.id))} style={[styles.collapsedRecentButton, styles.sidebarTooltipAnchor]} accessibilityRole="button" accessibilityLabel={conversation.title} onHoverIn={() => setHoveredSidebarItem("recent-" + conversation.id)} onHoverOut={() => setHoveredSidebarItem(null)} onFocus={() => setHoveredSidebarItem("recent-" + conversation.id)} onBlur={() => setHoveredSidebarItem(null)}>
                <Ionicons name={conversation.isPinned ? "pin-outline" : "chatbubble-outline"} size={17} color={colors.textMuted} />
                {hoveredSidebarItem === "recent-" + conversation.id ? <View pointerEvents="none" style={[styles.sidebarTooltip, isArabic ? { right: "100%" } : { left: "100%" }]}><Text style={[styles.sidebarTooltipText, { color: colors.textPrimary }]}>{conversation.title}</Text></View> : null}
              </Pressable>
            ))}
            <Pressable onPress={() => navigate("/conversations")} style={[styles.collapsedRecentButton, styles.sidebarTooltipAnchor]} accessibilityRole="button" accessibilityLabel={isArabic ? "عرض كل المحادثات" : "Show all conversations"} onHoverIn={() => setHoveredSidebarItem("all-conversations")} onHoverOut={() => setHoveredSidebarItem(null)} onFocus={() => setHoveredSidebarItem("all-conversations")} onBlur={() => setHoveredSidebarItem(null)}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
              {hoveredSidebarItem === "all-conversations" ? <View pointerEvents="none" style={[styles.sidebarTooltip, isArabic ? { right: "100%" } : { left: "100%" }]}><Text style={[styles.sidebarTooltipText, { color: colors.textPrimary }]}>{isArabic ? "عرض كل المحادثات" : "Show all conversations"}</Text></View> : null}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.drawerFooter, { borderColor: colors.divider }]}>
        <Pressable
          onPress={() => navigate("/settings")}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "فتح الحساب وتعديل الملف الشخصي" : "Open account and edit profile"}
          style={[styles.profileButton, sidebarCollapsed && styles.collapsedProfileButton, sidebarCollapsed && styles.sidebarTooltipAnchor, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: colors.surfaceElevated }]}
          onHoverIn={() => setHoveredSidebarItem("profile")} onHoverOut={() => setHoveredSidebarItem(null)} onFocus={() => setHoveredSidebarItem("profile")} onBlur={() => setHoveredSidebarItem(null)}
        >
          <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.profileAvatarText, { color: colors.onPrimary }]}>{(profileFullName?.trim()?.[0] || user?.email?.[0] || "S").toLocaleUpperCase(isArabic ? "ar" : "en")}</Text>
          </View>
          {!sidebarCollapsed ? (
            <>
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={[styles.profileName, { color: colors.textPrimary, textAlign: isArabic ? "right" : "left" }]}>{profileFullName || (isArabic ? "حسابي" : "My account")}</Text>
                <Text numberOfLines={1} style={[styles.profileEmail, { color: colors.textMuted, textAlign: isArabic ? "right" : "left" }]}>{user?.email || (isArabic ? "إدارة الملف الشخصي" : "Manage profile")}</Text>
              </View>
              <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color={colors.textMuted} />
            </>
          ) : null}
          {sidebarCollapsed && hoveredSidebarItem === "profile" ? <View pointerEvents="none" style={[styles.sidebarTooltip, isArabic ? { right: "100%" } : { left: "100%" }]}><Text style={[styles.sidebarTooltipText, { color: colors.textPrimary }]}>{isArabic ? "الحساب" : "Account"}</Text></View> : null}
        </Pressable>
      </View>
    </>
  );

  return (
    <NavigationMenuContext.Provider value={openDrawer}>
      <PlusMenuContext.Provider value={() => router.push("/integrations" as never)}>
        <View style={[styles.root, isDesktop && { flexDirection: isArabic ? "row-reverse" : "row" }, { backgroundColor: colors.background }]}>
          {isDesktop ? (
            <SafeAreaView edges={["top", "bottom"]} style={[styles.desktopSidebar, { width: sidebarCollapsed ? 64 : 272, backgroundColor: colors.surface, borderColor: colors.divider, borderLeftWidth: isArabic ? 1 : 0, borderRightWidth: isArabic ? 0 : 1 }]}>
              {sidebarContent}
            </SafeAreaView>
          ) : null}

          <View style={[styles.mainContent, { backgroundColor: colors.background }]}>
            {!isChat ? (
              <SafeAreaView edges={["top"]} style={[styles.topSafe, { backgroundColor: colors.background }]}>
                <View style={[styles.topBar, { borderColor: colors.divider, flexDirection: "row", direction: isArabic ? "rtl" : "ltr" }]}>
                  <Pressable onPress={openDrawer} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "فتح القائمة الجانبية" : "Open sidebar"}>
                    <Ionicons name="menu-outline" size={23} color={colors.textPrimary} />
                  </Pressable>
                  <View style={styles.brand}>
                    <Text style={[styles.brandName, { color: colors.textPrimary }]}>SULY</Text>
                  </View>
                  <Pressable onPress={goHome} style={styles.homeButton} accessibilityRole="button" accessibilityLabel={isArabic ? "العودة إلى الصفحة الرئيسية" : "Return to home"}>
                    <AppLogo size={34} />
                  </Pressable>
                </View>
              </SafeAreaView>
            ) : null}
            <SafeAreaView style={styles.content} edges={[]}>{children}</SafeAreaView>
          </View>

          <Modal visible={drawerVisible} transparent animationType="fade" onRequestClose={() => setDrawerVisible(false)}>
            <View style={styles.modalRoot}>
              <Pressable style={styles.scrim} onPress={() => setDrawerVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق القائمة" : "Close menu"} />
              <SafeAreaView edges={["top", "bottom"]} style={[styles.drawer, { alignSelf: isArabic ? "flex-end" : "flex-start", backgroundColor: colors.surface, borderColor: colors.divider }]}>
                {sidebarContent}
              </SafeAreaView>
            </View>
          </Modal>


        </View>
      </PlusMenuContext.Provider>
    </NavigationMenuContext.Provider>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, minWidth: 0 },
  mainContent: { flex: 1, minWidth: 0, minHeight: 0 },
  desktopSidebar: { height: "100%", flexShrink: 0, borderColor: colors.divider },
  collapsedHeader: { flexDirection: "column", alignItems: "center", justifyContent: "center", paddingHorizontal: 0, paddingBottom: 12, gap: 10 },
  collapseButtonCentered: { alignSelf: "center" },
  collapsedDrawerItem: { width: 44, minHeight: 44, alignSelf: "center", justifyContent: "center", paddingHorizontal: 0 },
  collapsedRecentList: { alignItems: "center", gap: 5, marginTop: 12 },
  collapsedRecentButton: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  collapsedProfileButton: { justifyContent: "center", paddingHorizontal: 0 },
  sidebarTooltipAnchor: { position: "relative", overflow: "visible" },
  sidebarTooltip: { position: "absolute", top: 3, zIndex: 1000, minWidth: 96, maxWidth: 220, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderColor: colors.divider, elevation: 8 },
  sidebarTooltipText: { fontSize: 11, fontWeight: "600" },
  topSafe: { zIndex: 1 },
  topBar: { minHeight: 66, alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, gap: 14 },
  headerButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  homeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surface },
  homeMark: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  homeMarkLetter: { fontSize: 20, fontWeight: "900" },
  brand: { flex: 1, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  modalRoot: { flex: 1, justifyContent: "flex-start" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "#00000088" },
  drawer: { width: "88%", maxWidth: 360, height: "100%", borderRightWidth: 1, borderLeftWidth: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 14 },
  drawerHeader: { alignItems: "center", gap: 11, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 25 },
  brandMark: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  brandLetter: { fontSize: 23, fontWeight: "900" },
  drawerBrandCopy: { flex: 1, gap: 2 },
  drawerBrandName: { fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  drawerSubtitle: { fontSize: 10 },
  closeButton: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { paddingBottom: 12 },
  drawerItems: { gap: 7 },
  recentSection: { marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: colors.divider },
  recentHeading: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingBottom: 8 },
  recentTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  recentCount: { fontSize: 10, fontVariant: ["tabular-nums"] },
  recentItem: { minHeight: 42, alignItems: "center", gap: 11, paddingHorizontal: 12, borderRadius: 11, marginBottom: 2 },
  recentItemText: { flex: 1, fontSize: 12, fontWeight: "500" },
  recentState: { minHeight: 42, justifyContent: "center", paddingHorizontal: 11 },
  recentStateText: { fontSize: 11, textAlign: "center" },
  viewAllButton: { minHeight: 40, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, marginTop: 4 },
  viewAllText: { fontSize: 12, fontWeight: "700" },
  drawerItem: { minHeight: 52, borderRadius: 14, alignItems: "center", gap: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: "transparent" },
  drawerItemText: { flex: 1, fontSize: 13, fontWeight: "700" },
  selectedMark: { width: 4, height: 19, borderRadius: 4 },
  drawerFooter: { marginTop: "auto", borderTopWidth: 1, paddingTop: 16 },
  profileButton: { minHeight: 62, alignItems: "center", gap: 11, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: colors.divider },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 15, fontWeight: "900" },
  profileCopy: { flex: 1, minWidth: 0, gap: 3 },
  profileName: { fontSize: 12, fontWeight: "800" },
  profileEmail: { fontSize: 10 },
});
