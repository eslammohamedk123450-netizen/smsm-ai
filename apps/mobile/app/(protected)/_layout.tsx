import { Redirect, Slot, useFocusEffect, useRouter } from "expo-router";
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from "expo-router/drawer";
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
import { MainNavigation } from "../../src/components/navigation/MainNavigation";

function formatConversationDate(value?: string) {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

function CustomDrawerContent({ isAdmin, ...props }: DrawerContentComponentProps & { isAdmin: boolean }) {
  const { user, profileFullName } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationLimit, setConversationLimit] = useState(100);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
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
      setConversations(await chatService.listConversations(conversationLimit));
      const ledger = await getCreditLedger(1);
      if (typeof ledger.balance === "number") setBalance(ledger.balance);
      const { data: profile } = await supabase.from("suly_profiles").select("subscription_tier").eq("id", user?.id ?? "").maybeSingle();
      setPlanTier(String(profile?.subscription_tier ?? user?.user_metadata?.subscription_tier ?? "free").toLowerCase());
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر تحميل المحادثات.", "error");
    } finally {
      setLoading(false);
    }
  }, [show, conversationLimit, user?.id]);

  const loadOlderConversations = async () => {
    const nextLimit = conversationLimit + 100;
    setLoadingMoreConversations(true);
    try {
      setConversations(await chatService.listConversations(nextLimit));
      setConversationLimit(nextLimit);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر تحميل محادثات أقدم.", "error");
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const goToChat = (conversationId?: string) => {
    if (conversationId) router.push({ pathname: "/(protected)/chat", params: { conversationId } });
    else router.replace("/(protected)/chat");
    props.navigation.closeDrawer();
  };

  const goToBalance = () => {
    router.push("/(protected)/balance");
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
            <Text style={styles.navItemText}>المحادثة</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={() => { router.push("/(protected)/hims"); props.navigation.closeDrawer(); }}>
            <View style={styles.navItemRight}><Ionicons name="school-outline" size={18} color={colors.primary} /><Text style={styles.navItemText}>محتوى الجامعة HIMS</Text></View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={() => { router.push("/(protected)/image-studio"); props.navigation.closeDrawer(); }}>
            <View style={styles.navItemRight}><Ionicons name="images-outline" size={18} color="#D4AF37" /><Text style={styles.navItemText}>استوديو الصور</Text></View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={() => { router.push("/(protected)/video-studio"); props.navigation.closeDrawer(); }}>
            <View style={styles.navItemRight}><Ionicons name="videocam-outline" size={18} color="#D4AF37" /><Text style={styles.navItemText}>استوديو الفيديو</Text></View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItem} onPress={() => { router.push("/(protected)/media"); props.navigation.closeDrawer(); }}>
            <View style={styles.navItemRight}><Ionicons name="library-outline" size={18} color="#0EA5E9" /><Text style={styles.navItemText}>مكتبتي</Text></View>
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
        {!loading && conversations.length >= conversationLimit ? <TouchableOpacity activeOpacity={0.7} disabled={loadingMoreConversations} onPress={() => void loadOlderConversations()} style={styles.loadOlderButton} accessibilityRole="button">{loadingMoreConversations ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.loadOlderText}>تحميل محادثات أقدم</Text>}</TouchableOpacity> : null}
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
  if (status === "loading") return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (status === "misconfigured") return <Redirect href="/" />;
  if (!user) return <Redirect href="/login" />;
  return <MainNavigation><Slot /></MainNavigation>;
}
