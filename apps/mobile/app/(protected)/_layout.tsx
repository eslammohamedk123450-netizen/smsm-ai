import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from "expo-router/drawer";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type Conversation } from "../../src/features/chat/chat-service";
import { supabase } from "../../src/lib/supabase/client";
import { colors } from "../../src/theme/colors";
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { useToast } from "../../src/components/ui/Toast";

function CustomDrawerContent({ isAdmin, ...props }: DrawerContentComponentProps & { isAdmin: boolean }) {
  const { user, profileFullName } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [actionTarget, setActionTarget] = useState<Conversation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = useCallback(async () => {
    try { setConversations(await chatService.listConversations(100)); }
    catch (cause) { show(cause instanceof Error ? cause.message : "تعذّر تحميل المحادثات.", "error"); }
    finally { setLoading(false); }
  }, [show]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const goToChat = (conversationId?: string) => {
    if (conversationId) router.push({ pathname: "/(protected)/chat", params: { conversationId } });
    else router.replace("/(protected)/chat");
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

  const filtered = conversations.filter((conversation) => conversation.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const displayName = profileFullName?.trim() || "Suly";

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        <Pressable style={styles.newChatButton} onPress={() => goToChat()} accessibilityRole="button"><Text style={styles.newChatText}>＋  محادثة جديدة</Text></Pressable>
        {isAdmin ? <Pressable style={styles.adminButton} onPress={() => { router.push("/(protected)/admin"); props.navigation.closeDrawer(); }} accessibilityRole="button" accessibilityLabel="لوحة التحكم"><Text style={styles.adminButtonText}>لوحة التحكم</Text></Pressable> : null}
        <TextInput value={query} onChangeText={setQuery} placeholder="بحث في المحادثات" placeholderTextColor={colors.textMuted} style={styles.searchInput} accessibilityLabel="بحث في سجل المحادثات" />
        <Text style={styles.sectionTitle}>سجل المحادثات</Text>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : filtered.length ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => goToChat(item.id)} onLongPress={() => confirmConversationActions(item)} delayLongPress={450} style={styles.chatItem} accessibilityRole="button" accessibilityHint="اضغط مطولاً لإعادة التسمية أو الحذف">
                <Text numberOfLines={1} style={styles.chatItemText}>{item.title === "New Conversation" ? "محادثة جديدة" : item.title.slice(0, 30)}</Text>
              </Pressable>
            )}
          />
        ) : <Text style={styles.emptyHistory}>{query ? "لا توجد نتائج مطابقة." : "لا توجد محادثات سابقة."}</Text>}
      </DrawerContentScrollView>
      <View style={styles.drawerFooter}>
        <Pressable style={styles.settingsRow} onPress={() => { router.push("/(protected)/support"); props.navigation.closeDrawer(); }} accessibilityRole="button"><Text style={styles.footerText}>الدعم والشكاوى</Text><Text style={styles.footerIcon}>✉</Text></Pressable>
        <Pressable style={styles.settingsRow} onPress={() => { router.push("/(protected)/settings"); props.navigation.closeDrawer(); }} accessibilityRole="button"><Text style={styles.footerText}>الإعدادات</Text><Text style={styles.footerIcon}>⚙</Text></Pressable>
        <View style={styles.profileRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.profileCopy}><Text style={styles.userName} numberOfLines={1}>{displayName}</Text><Text style={styles.email} numberOfLines={1}>{user?.email || ""}</Text></View>
        </View>
      </View>
      <BottomSheet visible={Boolean(actionTarget)} title={actionTarget?.title ?? "إجراءات المحادثة"} onClose={() => setActionTarget(null)}>
        <View style={styles.sheetActions}>
          <Pressable onPress={() => { if (actionTarget) { setRenameValue(actionTarget.title); setRenameTarget(actionTarget); } setActionTarget(null); }} style={styles.sheetAction}><Text style={styles.sheetActionText}>إعادة تسمية</Text></Pressable>
          <Pressable onPress={() => { setDeleteTarget(actionTarget); setActionTarget(null); }} style={[styles.sheetAction, styles.deleteAction]}><Text style={styles.deleteActionText}>حذف المحادثة</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(renameTarget)} title="إعادة تسمية المحادثة" onClose={() => setRenameTarget(null)}>
        <TextInput value={renameValue} onChangeText={setRenameValue} style={styles.renameInput} maxLength={120} autoFocus accessibilityLabel="اسم المحادثة الجديد" />
        <View style={styles.modalActions}>
          <Pressable onPress={() => setRenameTarget(null)} style={styles.modalButton}><Text style={styles.modalCancel}>إلغاء</Text></Pressable>
          <Pressable onPress={() => void rename()} style={[styles.modalButton, styles.modalSave]}><Text style={styles.newChatText}>حفظ</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(deleteTarget)} title="حذف المحادثة؟" onClose={() => setDeleteTarget(null)}>
        <Text style={styles.deleteNotice}>سيتم حذف المحادثة ورسائلها نهائيًا.</Text>
        <View style={styles.modalActions}>
          <Pressable onPress={() => setDeleteTarget(null)} style={styles.modalButton}><Text style={styles.modalCancel}>إلغاء</Text></Pressable>
          <Pressable onPress={() => void deleteConversation()} style={[styles.modalButton, styles.deleteButton]}><Text style={styles.newChatText}>حذف</Text></Pressable>
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
      <Drawer.Screen name="media" options={{ title: "المكتبة" }} />
      <Drawer.Screen name="admin" options={{ title: "لوحة التحكم", drawerItemStyle: isAdmin ? undefined : { display: "none" } }} />
      <Drawer.Screen name="settings" options={{ title: "الإعدادات" }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  drawerRoot: { flex: 1, backgroundColor: colors.background },
  drawerContent: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 22 },
  newChatButton: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.primary, marginBottom: 18 },
  newChatText: { color: colors.background, fontWeight: "700", textAlign: "center" },
  adminButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary, marginBottom: 16 },
  adminButtonText: { color: colors.primary, fontWeight: "700", textAlign: "right" },
  searchInput: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, color: colors.textPrimary, marginBottom: 18, textAlign: "right" },
  sectionTitle: { color: colors.textMuted, fontSize: 12, marginBottom: 8, textAlign: "right" },
  loader: { marginTop: 22 },
  chatItem: { paddingVertical: 12, paddingHorizontal: 11, marginBottom: 4, borderRadius: 10 },
  chatItemText: { color: colors.textPrimary, textAlign: "right", fontSize: 14 },
  emptyHistory: { color: colors.textMuted, textAlign: "right", padding: 10, fontSize: 13 },
  drawerFooter: { borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 15, paddingVertical: 15, gap: 12 },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 },
  footerText: { color: colors.textPrimary, fontSize: 14 },
  footerIcon: { color: colors.textSecondary, fontSize: 18 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  profileCopy: { flex: 1 },
  userName: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" },
  email: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: 2 },
  renameInput: { color: colors.textPrimary, padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, textAlign: "right" },
  modalActions: { flexDirection: "row", justifyContent: "flex-start", gap: 10, marginTop: 18 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.surfaceElevated },
  modalSave: { backgroundColor: colors.primary },
  modalCancel: { color: colors.textPrimary },
  sheetActions: { gap: 10 },
  sheetAction: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  sheetActionText: { color: colors.textPrimary, fontWeight: "600" },
  deleteAction: { borderColor: colors.error },
  deleteActionText: { color: colors.error, fontWeight: "700" },
  deleteButton: { backgroundColor: colors.error },
  deleteNotice: { color: colors.textSecondary, textAlign: "right", lineHeight: 22 },
});
