import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumText as Text } from "../ui/PremiumText";
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

const ITEMS = [
  { key: "studio", labelAr: "Studio", labelEn: "Studio", href: "/studio", icon: "sparkles-outline" as const },
  { key: "library", labelAr: "المكتبة", labelEn: "Library", href: "/media", icon: "albums-outline" as const },
  { key: "projects", labelAr: "المشاريع", labelEn: "Projects", href: "/projects", icon: "folder-open-outline" as const },
  { key: "tools", labelAr: "الأدوات والموصلات", labelEn: "Tools & connectors", href: "/integrations", icon: "git-network-outline" as const },
] as const;

const PLUS_ITEMS = [
  { labelAr: "محادثة جديدة", labelEn: "New chat", href: "/chat", icon: "chatbubble-ellipses-outline" as const },
  { labelAr: "الملفات والمكتبة", labelEn: "Files & library", href: "/media", icon: "folder-open-outline" as const },
  { labelAr: "Studio", labelEn: "Studio", href: "/studio", icon: "sparkles-outline" as const },
  { labelAr: "الموصلات", labelEn: "Connectors", href: "/integrations", icon: "git-network-outline" as const },
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [plusVisible, setPlusVisible] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(false);
  const [recentRefresh, setRecentRefresh] = useState(0);
  const active = activeSection(pathname);
  const isChat = pathname.startsWith("/chat");

  useEffect(() => {
    if (!drawerVisible) return;
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
  }, [drawerVisible, recentRefresh]);

  if (pathname.startsWith("/admin")) return <>{children}</>;

  const openDrawer = () => setDrawerVisible(true);
  const navigate = (href: string) => {
    setDrawerVisible(false);
    setPlusVisible(false);
    if (href === "/chat") router.replace("/chat");
    else router.replace(href as never);
  };

  return (
    <NavigationMenuContext.Provider value={openDrawer}>
      <PlusMenuContext.Provider value={() => setPlusVisible(true)}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {!isChat ? (
          <SafeAreaView edges={["top"]} style={[styles.topSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.topBar, { borderColor: colors.divider, flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Pressable onPress={openDrawer} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "فتح القائمة الجانبية" : "Open sidebar"}>
                <Ionicons name="menu-outline" size={23} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.brand}>
                <Text style={[styles.brandName, { color: colors.textPrimary }]}>SULY</Text>
              </View>
              <Pressable onPress={() => setPlusVisible(true)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "إضافة ملف أو أداة" : "Add file or tool"}>
                <Ionicons name="add" size={25} color={colors.textPrimary} />
              </Pressable>
            </View>
          </SafeAreaView>
        ) : null}
        <SafeAreaView style={styles.content} edges={[]}>{children}</SafeAreaView>

        <Modal visible={drawerVisible} transparent animationType="fade" onRequestClose={() => setDrawerVisible(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.scrim} onPress={() => setDrawerVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق القائمة" : "Close menu"} />
            <SafeAreaView edges={["top", "bottom"]} style={[styles.drawer, { alignSelf: isArabic ? "flex-end" : "flex-start", backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={[styles.drawerHeader, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                <View style={[styles.brandMark, { backgroundColor: colors.primary }]}><Text style={[styles.brandLetter, { color: colors.onPrimary }]}>S</Text></View>
                <View style={styles.drawerBrandCopy}>
                  <Text style={[styles.drawerBrandName, { color: colors.textPrimary }]}>SULY</Text>
                  <Text style={[styles.drawerSubtitle, { color: colors.textMuted }]}>{isArabic ? "شريكك الذكي" : "Your intelligent partner"}</Text>
                </View>
                <Pressable onPress={() => setDrawerVisible(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"}>
                  <Ionicons name="close" size={21} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.drawerItems}>
                <Pressable onPress={() => navigate("/chat")} accessibilityRole="button" style={[styles.drawerItem, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.drawerItemText, { color: colors.textPrimary, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? "محادثة جديدة" : "New chat"}</Text>
                </Pressable>
                {ITEMS.map((item) => {
                  const selected = active === item.key;
                  return (
                    <Pressable key={item.key} onPress={() => navigate(item.href)} accessibilityRole="button" accessibilityState={{ selected }}
                      style={[styles.drawerItem, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: selected ? colors.surfaceElevated : "transparent" }]}>
                      <Ionicons name={item.icon} size={20} color={selected ? colors.textPrimary : colors.textMuted} />
                      <Text style={[styles.drawerItemText, { color: selected ? colors.textPrimary : colors.textSecondary, textAlign: isArabic ? "right" : "left" }]}>{isArabic ? item.labelAr : item.labelEn}</Text>
                      {selected ? <View style={[styles.selectedMark, { backgroundColor: colors.textPrimary }]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
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
                    style={[styles.recentItem, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
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
              </ScrollView>
              <View style={[styles.drawerFooter, { borderColor: colors.divider }]}>
                <Pressable
                  onPress={() => navigate("/settings")}
                  accessibilityRole="button"
                  accessibilityLabel={isArabic ? "فتح الحساب وتعديل الملف الشخصي" : "Open account and edit profile"}
                  style={[styles.profileButton, { flexDirection: isArabic ? "row-reverse" : "row", backgroundColor: colors.surfaceElevated }]}
                >
                  <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.profileAvatarText, { color: colors.onPrimary }]}>{(profileFullName?.trim()?.[0] || user?.email?.[0] || "S").toLocaleUpperCase(isArabic ? "ar" : "en")}</Text>
                  </View>
                  <View style={styles.profileCopy}>
                    <Text numberOfLines={1} style={[styles.profileName, { color: colors.textPrimary, textAlign: isArabic ? "right" : "left" }]}>{profileFullName || (isArabic ? "حسابي" : "My account")}</Text>
                    <Text numberOfLines={1} style={[styles.profileEmail, { color: colors.textMuted, textAlign: isArabic ? "right" : "left" }]}>{user?.email || (isArabic ? "إدارة الملف الشخصي" : "Manage profile")}</Text>
                  </View>
                  <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        <Modal visible={plusVisible} transparent animationType="slide" onRequestClose={() => setPlusVisible(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.scrim} onPress={() => setPlusVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق قائمة الإضافة" : "Close add menu"} />
            <SafeAreaView edges={["bottom"]} style={[styles.plusSheet, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={[styles.sheetHeading, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{isArabic ? "إضافة" : "Add"}</Text>
                <Pressable onPress={() => setPlusVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"}>
                  <Ionicons name="close" size={21} color={colors.textMuted} />
                </Pressable>
              </View>
              {PLUS_ITEMS.map((item) => (
                <Pressable key={item.href} onPress={() => navigate(item.href)} style={[styles.plusItem, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                  <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                  <Text style={[styles.plusItemText, { color: colors.textPrimary }]}>{isArabic ? item.labelAr : item.labelEn}</Text>
                  <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color={colors.textMuted} />
                </Pressable>
              ))}
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
  topSafe: { zIndex: 1 },
  topBar: { minHeight: 54, alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, gap: 12 },
  headerButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brand: { flex: 1, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  modalRoot: { flex: 1, justifyContent: "flex-start" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "#00000088" },
  drawer: { width: "84%", maxWidth: 340, height: "100%", borderRightWidth: 1, borderLeftWidth: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 14 },
  drawerHeader: { alignItems: "center", gap: 10, paddingHorizontal: 4, paddingBottom: 24 },
  brandMark: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  brandLetter: { fontSize: 23, fontWeight: "900" },
  drawerBrandCopy: { flex: 1, gap: 2 },
  drawerBrandName: { fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  drawerSubtitle: { fontSize: 10 },
  closeButton: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { paddingBottom: 12 },
  drawerItems: { gap: 6 },
  recentSection: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.divider },
  recentHeading: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingBottom: 8 },
  recentTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  recentCount: { fontSize: 10, fontVariant: ["tabular-nums"] },
  recentItem: { minHeight: 39, alignItems: "center", gap: 10, paddingHorizontal: 11, borderRadius: 9 },
  recentItemText: { flex: 1, fontSize: 12, fontWeight: "500" },
  recentState: { minHeight: 42, justifyContent: "center", paddingHorizontal: 11 },
  recentStateText: { fontSize: 11, textAlign: "center" },
  viewAllButton: { minHeight: 40, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, marginTop: 4 },
  viewAllText: { fontSize: 12, fontWeight: "700" },
  drawerItem: { minHeight: 50, borderRadius: 12, alignItems: "center", gap: 12, paddingHorizontal: 13 },
  drawerItemText: { flex: 1, fontSize: 13, fontWeight: "700" },
  selectedMark: { width: 5, height: 5, borderRadius: 3 },
  drawerFooter: { marginTop: "auto", borderTopWidth: 1, paddingTop: 14 },
  profileButton: { minHeight: 58, alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 15, fontWeight: "900" },
  profileCopy: { flex: 1, minWidth: 0, gap: 3 },
  profileName: { fontSize: 12, fontWeight: "800" },
  profileEmail: { fontSize: 10 },
  plusSheet: { marginTop: "auto", borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  sheetHeading: { alignItems: "center", justifyContent: "space-between", paddingBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "800" },
  plusItem: { minHeight: 48, alignItems: "center", gap: 12 },
  plusItemText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
