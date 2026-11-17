import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type WelcomeSettings = { enabled: boolean; welcome_credits: number; max_accounts_per_24h: number };

export function WelcomeTrialSettingsCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [enabled, setEnabled] = useState(false);
  const [credits, setCredits] = useState("0");
  const [maxAccounts, setMaxAccounts] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("suly_welcome_trial_settings")
        .select("enabled,welcome_credits,max_accounts_per_24h")
        .eq("id", 1)
        .single();
      if (queryError) throw queryError;
      const row = data as WelcomeSettings;
      setEnabled(row.enabled === true);
      setCredits(String(row.welcome_credits ?? 0));
      setMaxAccounts(String(row.max_accounts_per_24h ?? 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل إعدادات التجربة الترحيبية. تأكد من تطبيق migration والصلاحيات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const parsedCredits = Number(credits);
    const parsedMaxAccounts = Number(maxAccounts);
    if (!Number.isInteger(parsedCredits) || parsedCredits < 0 || parsedCredits > 1_000_000_000) {
      setError("أدخل عدد كريدت صحيحًا بين صفر ومليار.");
      return;
    }
    if (!Number.isInteger(parsedMaxAccounts) || parsedMaxAccounts < 0 || parsedMaxAccounts > 1_000_000) {
      setError("أدخل حدًا صحيحًا لعدد الحسابات خلال 24 ساعة.");
      return;
    }
    if (enabled && (parsedCredits < 1 || parsedMaxAccounts < 1)) {
      setError("لتفعيل الهدية، يجب تحديد كريدت موجب وحد يومي موجب للحسابات الجديدة.");
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("suly_welcome_trial_settings")
        .update({
          enabled,
          welcome_credits: parsedCredits,
          max_accounts_per_24h: parsedMaxAccounts,
          updated_by: authData.user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (updateError) throw updateError;
      setNotice("تم حفظ إعدادات الهدية الترحيبية للحسابات الجديدة. الأرصدة الممنوحة سابقًا لا تتغير.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ إعدادات التجربة الترحيبية.");
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>ميزانية التجربة الترحيبية</Text>
        <Text style={styles.description}>إعداد الهدية للحساب الجديد. القيمة الافتراضية صفر ومتوقفة حتى تحدد ميزانيتك.</Text>
      </View>
      <Ionicons name="gift-outline" size={20} color={colors.primary}/>
    </View>
    {loading ? <ActivityIndicator color={colors.primary}/> : <>
      <View style={styles.toggleRow}>
        <Text style={styles.label}>تفعيل الهدية للحسابات الجديدة</Text>
        <Switch value={enabled} onValueChange={setEnabled} disabled={saving}/>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>كريدت الهدية لكل حساب جديد</Text>
        <TextInput value={credits} onChangeText={setCredits} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={styles.input}/>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>الحد الأقصى للحسابات خلال 24 ساعة</Text>
        <TextInput value={maxAccounts} onChangeText={setMaxAccounts} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={styles.input}/>
      </View>
      <View style={styles.note}>
        <Text style={styles.noteText}>الحماية الحالية: مكافأة واحدة لكل محفظة حساب + سقف عام متحرك لكل 24 ساعة. هذا لا يثبت هوية الشخص ولا يمنع كل الحسابات المتعددة؛ يلزم لاحقًا CAPTCHA/تحقق موثوق وإشارات إساءة استخدام. إيقاف الهدية لا يلغي رصيد Free اليومي.</Text>
      </View>
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>
        <Text style={styles.saveText}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات التجربة"}</Text>
      </Pressable>
    </>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
  </View>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 13, gap: 10 },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: c.textPrimary, fontSize: 13, fontWeight: "900", textAlign: "right" },
  description: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
  toggleRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  label: { color: c.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" },
  field: { gap: 5 },
  input: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, backgroundColor: c.background, color: c.textPrimary, padding: 9, fontSize: 11, textAlign: "right" },
  note: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 9, backgroundColor: c.background },
  noteText: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
  saveButton: { borderRadius: 8, backgroundColor: c.primary, padding: 11, alignItems: "center" },
  saveText: { color: c.onPrimary, fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  error: { color: c.error, fontSize: 9, textAlign: "right" },
  success: { color: c.success, fontSize: 9, textAlign: "right" },
});
