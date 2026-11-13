import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
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
  const [connecting, setConnecting] = useState<ToolkitStatus["toolkit"] | null>(null);

  const load = useCallback(async () => {
    try {
      setStatuses(await integrationService.getStatus());
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر تحميل حالة التطبيقات المرتبطة.", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const connect = async (toolkit: ToolkitStatus["toolkit"]) => {
    setConnecting(toolkit);
    try {
      const completed = await integrationService.openConnectFlow(toolkit);
      if (completed) show("أكمل الربط من نافذة الخدمة، وسيتم تحديث الحالة تلقائيًا.", "success");
      await load();
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر بدء ربط التطبيق.", "error");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>التطبيقات المرتبطة</Text>
      <Text style={styles.explainer}>
        اربط حسابك في Gmail أو Google Drive أو GitHub ليسأل Suly عن بريدك وملفاتك ومستودعاتك. الربط يتم داخل صفحة الخدمة نفسها، ولا يراها التطبيق ولا نموذج الذكاء الاصطناعي. حاليًا يدعم Suly الاطلاع فقط (قراءة) على هذه الحسابات، ولن ينفذ إرسالًا أو حذفًا أو أي تغيير.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        statuses.map((status) => (
          <View key={status.toolkit} style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name={TOOLKIT_ICONS[status.toolkit]} size={22} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{status.label}</Text>
              <Text style={styles.state}>{status.connected ? "مرتبط — الاطلاع مفعّل" : "غير مرتبط"}</Text>
            </View>
            {status.connected ? (
              <View style={styles.badge}><Text style={styles.badgeText}>مرتبط</Text></View>
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
        بعد الربط، اكتب في المحادثة طلبك مباشرة مثل «ابحث في بريدي عن رسالة من فلان» أو «اعرض ملفاتي في Drive» أو «راجع مستودعي على GitHub»، وسيعرض Suly ما وجده فقط.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  explainer: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 8 },
  loader: { marginTop: 24 },
  card: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, marginTop: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  state: { color: colors.textSecondary, fontSize: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.14)", borderWidth: 1, borderColor: "rgba(16,185,129,0.4)" },
  badgeText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  connectButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primary, minWidth: 74, alignItems: "center", justifyContent: "center" },
  connectText: { color: colors.background, fontWeight: "800", fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 18 },
});
