import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from "expo-router/drawer";
import { useDrawerStatus } from "@react-navigation/drawer";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type Conversation } from "../../src/features/chat/chat-service";
import { supabase } from "../../src/lib/supabase/client";
import { colors } from "../../src/theme/colors";
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { useToast } from "../../src/components/ui/Toast";
import { getCreditLedger } from "../../src/features/credits/credit-service";

function formatConversationDate(value?: string) {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

function CustomDrawerContent({ isAdmin, ...props }: DrawerContentComponentProps & { isAdmin: boolean }) {
  const { user, profileFullName } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const drawerStatus = useDrawerStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState("free");
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [actionTarget, setActionTarget] = useState<Conversation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = useCallback(async () => {
    try {
      setConversations(await chatService.listConversations(100));
      const ledger = await getCreditLedger(1);
      if (typeof ledger.balance === "number") setBalance(ledger.balance);
      const { data: profile } = await supabase.from("suly_profiles").select("subscription_tier").eq("id", user?.id ?? "").maybeSingle();
      setPlanTier(String(profile?.subscription_tier ?? user?.user_metadata?.subscription_tier ?? "free").toLowerCase());
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر تحميل المحادثات.", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (drawerStatus === "open") void refresh();
  }, [drawerStatus, refresh]);

  const goToChat = (conversationId?: string) => {
    if (conversationId) router.push({ pathname: "/(protected)/chat", params: { conversationId } });
    else router.replace("/(protected)/chat");
    props.navigation.closeDrawer();
  };

  const goToBalance = () => {
    router.push("/(protected)/balance");
    props.navigation.closeDrawer();
  };

  const goToSupport = () => {
    router.push("/(protected)/support");
    props.navigation.closeDrawer();
  };

  const rename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await chatService.renameConversation(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
      await refresh();
    } catch (cause) {
      setRenameTarget(null);
      show(cause instanceof Error ? cause.message : "تعذّرت إعادة تسمية المحادثة.", "error");
    }
  };

  const confirmConversationActions = (conversation: Conversation) => setActionTarget(conversation);
  const deleteConversation = async () => {
    if (!deleteTarget) return;
    try { await chatService.deleteConversation(deleteTarget.id); setDeleteTarget(null); await refresh(); show("حُذفت المحادثة.", "success"); }
    catch (cause) { setDeleteTarget(null); show(cause instanceof Error ? cause.message : "تعذّر حذف المحادثة.", "error"); }
  };

  const togglePinned = async () => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionTarget(null);
    try { await chatService.setConversationPinned(target.id, !target.isPinned); await refresh(); show(target.isPinned ? "تم إلغاء تثبيت المحادثة." : "تم تثبيت المحادثة.", "success"); }
    catch (cause) { show(cause instanceof Error ? cause.message : "تعذر تحديث تثبيت المحادثة.", "error"); }
  };

  const toggleArchived = async () => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionTarget(null);
    try { await chatService.setConversationArchived(target.id, !target.archivedAt); await refresh(); show(target.archivedAt ? "تمت استعادة المحادثة من الأرشيف." : "تمت أرشفة المحادثة.", "success"); }
    catch (cause) { show(cause instanceof Error ? cause.message : "تعذر تحديث أرشيف المحادثة.", "error"); }
  };

  const filtered = conversations.filter((conversation) => conversation.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const displayName = profileFullName?.trim() || "Suly";

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        <TouchableOpacity activeOpacity={0.8} style={styles.newChatButton} onPress={() => goToChat()} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#000000" />
          <Text style={styles.newChatText}>محادثة جديدة</Text>
        </TouchableOpacity>

        <View style={styles.navSection}>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={() => goToChat()}>
            <Ionicons name="chatbubbles-outline" size={18} color="#0EA5E9" />
            <Text style={styles.navItemText}>المحادثة والمهام</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={goToBalance}>
            <View style={styles.navItemRight}>
              <Ionicons name="card-outline" size={18} color="#0EA5E9" />
              <Text style={styles.navItemText}>الرصيد والاستهلاك</Text>
            </View>
            {balance !== null ? (
              <View style={styles.balanceBadge}>
                <Text style={styles.balanceBadgeText}>{balance.toLocaleString("en-US")}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {isAdmin ? <TouchableOpacity activeOpacity={0.7} style={styles.adminButton} onPress={() => { router.push("/(protected)/admin"); props.navigation.closeDrawer(); }} accessibilityRole="button"><Text style={styles.adminButtonText}>لوحة التحكم</Text></TouchableOpacity> : null}

        <TextInput value={query} onChangeText={setQuery} placeholder="بحث في المحادثات" placeholderTextColor={colors.textMuted} style={styles.searchInput} accessibilityLabel="بحث في المحادثات" />
        <Text style={styles.sectionTitle}>سجل المحادثات</Text>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : filtered.length ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.7} onPress={() => goToChat(item.id)} onLongPress={() => confirmConversationActions(item)} delayLongPress={450} style={styles.chatItem} accessibilityRole="button" accessibilityLabel={item.title || "محادثة"}>
                <Ionicons name={item.isPinned ? "pin" : "chatbubble-outline"} size={19} color={item.isPinned ? colors.primary : colors.textSecondary} />
                <View style={styles.chatItemCopy}><Text numberOfLines={1} style={styles.chatItemText}>{item.title?.trim() && item.title !== "New Conversation" ? item.title.trim() : "محادثة بدون عنوان"}</Text><Text style={styles.chatItemDate}>{formatConversationDate(item.updatedAt)}</Text></View>
              </TouchableOpacity>
            )}
          />
        ) : <Text style={styles.emptyHistory}>{query ? "لا توجد نتائج مطابقة." : "لا توجد محادثات سابقة."}</Text>}
      </DrawerContentScrollView>

      <View style={styles.drawerFooter}>
        <View style={styles.planCard}>
          <View style={styles.planCardInfo}>
            <Ionicons name="shield-checkmark" size={18} color="#0EA5E9" />
            <View>
              <Text style={styles.planCardTitle}>{planTier === "free" ? "الخطة المجانية" : `خطة ${planTier.toUpperCase()}`}</Text>
              <Text style={styles.planCardSubtitle}>الخطة الحالية: {planTier === "free" ? "Free" : planTier.toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { router.push("/(protected)/upgrade"); props.navigation.closeDrawer(); }}>
            <Text style={styles.planCardUpgrade}>ترقية</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.7} style={styles.settingsRow} onPress={() => { router.push("/(protected)/settings"); props.navigation.closeDrawer(); }} accessibilityRole="button">
          <Text style={styles.footerText}>الإعدادات</Text>
          <Ionicons name="settings-outline" size={19} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} style={styles.settingsRow} onPress={goToSupport} accessibilityRole="button">
          <Text style={styles.footerText}>الدعم والشكاوى</Text>
          <Ionicons name="help-circle-outline" size={19} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <BottomSheet visible={Boolean(actionTarget)} title={actionTarget?.title ?? "إجراءات المحادثة"} onClose={() => setActionTarget(null)}>
        <View style={styles.sheetActions}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void togglePinned()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{actionTarget?.isPinned ? "إلغاء تثبيت" : "تثبيت"}</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void toggleArchived()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{actionTarget?.archivedAt ? "إلغاء الأرشفة" : "أرشفة"}</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { if (actionTarget) { setRenameValue(actionTarget.title); setRenameTarget(actionTarget); } setActionTarget(null); }} style={styles.sheetAction}><Text style={styles.sheetActionText}>إعادة تسمية</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { setDeleteTarget(actionTarget); setActionTarget(null); }} style={[styles.sheetAction, styles.deleteAction]}><Text style={styles.deleteActionText}>حذف</Text></TouchableOpacity>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(renameTarget)} title="إعادة تسمية المحادثة" onClose={() => setRenameTarget(null)}>
        <TextInput value={renameValue} onChangeText={setRenameValue} style={styles.renameInput} maxLength={120} autoFocus accessibilityLabel="اسم المحادثة الجديد" />
        <View style={styles.modalActions}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setRenameTarget(null)} style={styles.modalButton}><Text style={styles.modalCancel}>إلغاء</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void rename()} style={[styles.modalButton, styles.modalSave]}><Text style={styles.newChatText}>حفظ</Text></TouchableOpacity>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(deleteTarget)} title="حذف المحادثة؟" onClose={() => setDeleteTarget(null)}>
        <Text style={styles.deleteNotice}>سيتم حذف المحادثة ورسائلها نهائيًا.</Text>
        <View style={styles.modalActions}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setDeleteTarget(null)} style={styles.modalButton}><Text style={styles.modalCancel}>إلغاء</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void deleteConversation()} style={[styles.modalButton, styles.deleteButton]}><Text style={styles.newChatText}>حذف</Text></TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

export default function ProtectedLayout() {
  const { user, status } = useAuth();
  const [adminAccess, setAdminAccess] = useState<{ userId: string | null; allowed: boolean }>({ userId: null, allowed: false });
  const isAdmin = Boolean(user?.id && adminAccess.userId === user.id && adminAccess.allowed);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAdminAccess({ userId: null, allowed: false });
      return () => { active = false; };
    }
    setAdminAccess({ userId: user.id, allowed: false });
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_is_admin");
        if (active) setAdminAccess({ userId: user.id, allowed: !error && data === true });
      } catch {
        if (active) setAdminAccess({ userId: user.id, allowed: false });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  if (status === "loading") return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (status === "misconfigured") return <Redirect href="/" />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Drawer drawerContent={(props) => <CustomDrawerContent {...props} isAdmin={isAdmin} />} screenOptions={{ headerShown: false, drawerPosition: "right", drawerStyle: { backgroundColor: colors.background, width: 320 }, swipeEdgeWidth: 36 }}>
      <Drawer.Screen name="chat" options={{ title: "المحادثة" }} />
      <Drawer.Screen name="balance" options={{ title: "الرصيد والاستهلاك", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="media" options={{ title: "المكتبة" }} />
      <Drawer.Screen name="upgrade" options={{ title: "الباقات والترقية", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="admin" options={{ title: "لوحة التحكم", drawerItemStyle: isAdmin ? undefined : { display: "none" } }} />
      <Drawer.Screen name="settings" options={{ title: "الإعدادات" }} />
      <Drawer.Screen name="support" options={{ title: "الشكاوى والدعم" }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  drawerRoot: { flex: 1, backgroundColor: "#111111" },
  drawerContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
  drawerBrand: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#262626", marginBottom: 16 },
  drawerBrandInfo: { alignItems: "flex-end" },
  drawerBrandTitle: { color: "#F5F5F5", fontSize: 17, fontWeight: "700" },
  drawerBrandSubtitle: { color: "#A1A1AA", fontSize: 11, marginTop: 2 },
  newChatButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 9999, backgroundColor: "#FFFFFF", marginBottom: 16 },
  newChatText: { color: "#000000", fontWeight: "700", fontSize: 14, textAlign: "center" },
  navSection: { gap: 4, marginBottom: 16 },
  navItem: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "transparent" },
  navItemRight: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  navItemText: { color: "#F5F5F5", fontSize: 14, fontWeight: "500" },
  balanceBadge: { backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#262626", borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  balanceBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  adminButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#0EA5E9", marginBottom: 12 },
  adminButtonText: { color: "#0EA5E9", fontWeight: "700", textAlign: "right", fontSize: 13 },
  searchInput: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#262626", color: "#F5F5F5", marginBottom: 16, textAlign: "right", fontSize: 13 },
  sectionTitle: { color: "#A1A1AA", fontSize: 11, marginBottom: 8, textAlign: "right" },
  loader: { marginTop: 22 },
  chatItem: { minHeight: 56, flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: "#262626", backgroundColor: "#1F1F1F" },
  chatItemCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  chatItemText: { width: "100%", color: "#F5F5F5", textAlign: "right", fontSize: 13 },
  chatItemDate: { color: "#A1A1AA", fontSize: 10, textAlign: "right" },
  emptyHistory: { color: "#A1A1AA", textAlign: "right", padding: 10, fontSize: 13 },
  drawerFooter: { borderTopWidth: 1, borderTopColor: "#262626", paddingHorizontal: 16, paddingVertical: 14, gap: 10, backgroundColor: "#111111" },
  planCard: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#262626", borderRadius: 12, padding: 10 },
  planCardInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  planCardTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  planCardSubtitle: { color: "#A1A1AA", fontSize: 10, marginTop: 1 },
  planCardUpgrade: { color: "#0EA5E9", fontSize: 11, fontWeight: "700" },
  settingsRow: { minHeight: 38, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  footerText: { color: "#F5F5F5", fontSize: 13 },
  renameInput: { color: colors.textPrimary, padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, textAlign: "right" },
  modalActions: { flexDirection: "row", justifyContent: "flex-start", gap: 10, marginTop: 18 },
  modalButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surfaceElevated },
  modalSave: { backgroundColor: colors.primary },
  modalCancel: { color: colors.textPrimary },
  sheetActions: { gap: 10 },
  sheetAction: { minHeight: 50, borderRadius: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  sheetActionText: { color: colors.textPrimary, fontWeight: "600" },
  deleteAction: { borderColor: colors.error },
  deleteActionText: { color: colors.error, fontWeight: "700" },
  deleteButton: { backgroundColor: colors.error },
  deleteNotice: { color: colors.textSecondary, textAlign: "right", lineHeight: 22 },
});
