import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { integrationService, type ToolkitStatus } from "./integration-service";
import { colors } from "../../theme/colors";
import { useToast } from "../../components/ui/Toast";

const TOOLKIT_ICONS: Record<ToolkitStatus["toolkit"], keyof typeof Ionicons.glyphMap> = {
  gmail: "mail-outline",
  googledrive: "cloud-outline",
  github: "logo-github",
};

export default function ConnectedAppsScreen() {
  const { show } = useToast();
  const [statuses, setStatuses] = useState<ToolkitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState<ToolkitStatus["toolkit"] | null>(null);
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  const load = useCallback(async (showSuccess = false) => {
    setRefreshing(true);
    try {
      const result = await integrationService.getStatus();
      setStatuses(result.toolkits);
      setServiceReady(result.serviceReady);
      if (showSuccess) show("تم فحص خدمة الموصلات وحالة الحسابات.", "success");
    } catch (cause) {
      setServiceReady(false);
      show(cause instanceof Error ? cause.message : "تعذّر تحميل حالة التطبيقات المرتبطة.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => {
    void load();
    return undefined;
  }, [load]));

  const connect = async (toolkit: ToolkitStatus["toolkit"]) => {
    setAddSheetVisible(false);
    setConnecting(toolkit);
    try {
      const completed = await integrationService.openConnectFlow(toolkit);
      if (completed) show("عادت صفحة الربط. حدّث الحالة للتأكد من اكتمال الاتصال.", "success");
      await load();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر بدء ربط التطبيق.", "error");
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = (status: ToolkitStatus) => {
    if (!status.accountId) { show("تعذر تحديد حساب الاتصال. حدّث الحالة وحاول مجددًا.", "error"); return; }
    Alert.alert(
      `قطع اتصال ${status.label}؟`,
      "سيُحذف الاتصال من Suly ويُطلب إلغاء صلاحية التطبيق لدى الخدمة. ستحتاج إلى ربطه مجددًا لاستخدامه لاحقًا.",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "قطع الاتصال", style: "destructive", onPress: () => void performDisconnect(status) },
      ],
    );
  };

  const performDisconnect = async (status: ToolkitStatus) => {
    if (!status.accountId) return;
    setConnecting(status.toolkit);
    try {
      await integrationService.disconnect(status.toolkit, status.accountId);
      show(`تم قطع اتصال ${status.label}.`, "success");
      await load();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر قطع اتصال التطبيق.", "error");
    } finally {
      setConnecting(null);
    }
  };

  const labels: Record<ToolkitStatus["toolkit"], string> = {
    gmail: "Gmail",
    googledrive: "Google Drive",
    github: "GitHub",
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.heading}>التكاملات</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => void load(true)}
            disabled={refreshing}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="إعادة فحص الموصلات"
          >
            {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={19} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setAddSheetVisible(true)}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="إضافة موصل"
          >
            <Ionicons name="add" size={19} color={colors.background} />
            <Text style={styles.addText}>إضافة موصل</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.explainer}>
        اربط Gmail أو Google Drive أو GitHub. الفحص يراجع اتصال الخدمة وحالة الربط فقط، ولا يفتح رسائل أو ملفات ولا يغيّر بيانات حسابك.
      </Text>

      <View style={[styles.serviceStatus, serviceReady === true ? styles.serviceReady : serviceReady === false ? styles.serviceError : null]}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={serviceReady ? "checkmark-circle-outline" : "alert-circle-outline"} size={18} color={serviceReady ? colors.success : colors.error} />}
        <Text style={styles.serviceStatusText}>
          {loading ? "جارٍ فحص خدمة الموصلات…" : serviceReady ? "خدمة الموصلات تستجيب" : "تعذّر فحص خدمة الموصلات"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        statuses.map((status) => (
          <View key={status.toolkit} style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name={TOOLKIT_ICONS[status.toolkit]} size={22} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{status.label}</Text>
              <Text style={styles.state}>{status.connected ? "الحساب متصل ونشط" : status.disabled ? "الحساب مرتبط لكنه معطّل" : status.accountExists ? "الحساب مرتبط لكنه غير نشط" : "الحساب غير مرتبط"}</Text>
              {status.updatedAt ? <Text style={styles.updated}>آخر تحديث: {new Date(status.updatedAt).toLocaleString("ar-EG")}</Text> : null}
            </View>
            {status.connected ? (
              <TouchableOpacity activeOpacity={0.7} style={styles.disconnectButton} disabled={connecting !== null} onPress={() => disconnect(status)} accessibilityRole="button" accessibilityLabel={`قطع اتصال ${status.label}`}>
                {connecting === status.toolkit ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={styles.disconnectText}>قطع الاتصال</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.connectButton}
                disabled={connecting !== null}
                onPress={() => void connect(status.toolkit)}
                accessibilityRole="button"
                accessibilityLabel={`ربط ${status.label}`}
              >
                {connecting === status.toolkit ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.connectText}>ربط</Text>}
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      <Text style={styles.note}>
        بعد الربط، اكتب طلبك في المحادثة. تُنفّذ القراءة بعد فحص الاتصال، أما الإرسال أو التعديل أو الحذف فيحتاج تأكيدك قبل التنفيذ، وبشرط أن تكون الأداة مدعومة ومتاحة من الموصل.
      </Text>

      <Modal visible={addSheetVisible} transparent animationType="fade" onRequestClose={() => setAddSheetVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.addSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>إضافة موصل</Text>
              <TouchableOpacity onPress={() => setAddSheetVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق">
                <Ionicons name="close" size={23} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetHint}>اختر التطبيق الذي تريد ربطه بحسابك.</Text>
            {(Object.keys(labels) as ToolkitStatus["toolkit"][]).map((toolkit) => {
              const status = statuses.find((item) => item.toolkit === toolkit);
              return (
                <TouchableOpacity
                  key={toolkit}
                  activeOpacity={0.75}
                  style={styles.providerOption}
                  onPress={() => void connect(toolkit)}
                  disabled={connecting !== null || status?.connected === true}
                  accessibilityRole="button"
                >
                  <View style={styles.providerIcon}><Ionicons name={TOOLKIT_ICONS[toolkit]} size={21} color={colors.primary} /></View>
                  <Text style={styles.providerName}>{labels[toolkit]}</Text>
                  <Text style={status?.connected ? styles.providerConnected : styles.providerAction}>{status?.connected ? "مرتبط" : "ربط"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  headerActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  addButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, height: 40, borderRadius: 13, backgroundColor: colors.primary },
  addText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  explainer: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 9 },
  serviceStatus: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 16, padding: 12, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  serviceReady: { borderColor: "rgba(16,185,129,0.4)" },
  serviceError: { borderColor: "rgba(248,113,113,0.45)" },
  serviceStatusText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  loader: { marginTop: 24 },
  card: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, marginTop: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  state: { color: colors.textSecondary, fontSize: 12 },
  updated: { color: colors.textMuted, fontSize: 9 },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.14)", borderWidth: 1, borderColor: "rgba(16,185,129,0.4)" },
  badgeText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  connectButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primary, minWidth: 74, alignItems: "center", justifyContent: "center" },
  connectText: { color: colors.background, fontWeight: "800", fontSize: 13 },
  disconnectButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.error, borderWidth: 1, minWidth: 94, alignItems: "center", justifyContent: "center" },
  disconnectText: { color: colors.error, fontWeight: "800", fontSize: 11 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 18 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.72)" },
  addSheet: { width: "100%", maxWidth: 520, borderRadius: 20, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  sheetHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  sheetHint: { color: colors.textSecondary, textAlign: "right", fontSize: 12, marginTop: 7, marginBottom: 10 },
  providerOption: { minHeight: 58, flexDirection: "row-reverse", alignItems: "center", gap: 11, borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: 8 },
  providerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  providerName: { flex: 1, color: colors.textPrimary, fontSize: 14, textAlign: "right", fontWeight: "600" },
  providerAction: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  providerConnected: { color: colors.success, fontSize: 12, fontWeight: "700" },
});
