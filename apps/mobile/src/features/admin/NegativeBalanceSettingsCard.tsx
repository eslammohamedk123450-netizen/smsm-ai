import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

export function NegativeBalanceSettingsCard() {
  const [value, setValue] = useState("5000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.from("suly_credit_pricing").select("negative_balance_limit").eq("id", 1).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError("تعذر تحميل حد تنبيه الرصيد السالب.");
        else setValue(String(data?.negative_balance_limit ?? 5000));
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    const limit = Number(value.trim());
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1000000000) {
      setError("أدخل عددًا صحيحًا من صفر إلى مليار Credit."); return;
    }
    setSaving(true); setError(null); setNotice(null);
    const { data, error: rpcError } = await supabase.rpc("suly_admin_update_negative_balance_limit", { p_limit: limit });
    if (rpcError || data?.success !== true) setError("تعذر حفظ حد التنبيه. تأكد من تطبيق ترحيل التسوية الفعلية.");
    else setNotice("تم تحديث حد التنبيه.");
    setSaving(false);
  };
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 14, padding: 14, gap: 9 }}>
    <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "900" }}>حد تنبيه الرصيد السالب</Text>
    <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10, lineHeight: 17 }}>إذا تجاوزت تكلفة تنفيذ مكتمل هذا الحد، تُسجل العملية كحالة تحتاج مراجعة. لا يتم إيقاف المهمة الجارية؛ أما الطلبات الجديدة فتُرفض تلقائيًا عندما لا يكفي الرصيد للحجز.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right" }} />}
    {error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : null}
    {notice ? <Text style={{ color: colors.success, textAlign: "right" }}>{notice}</Text> : null}
    <Pressable disabled={loading || saving} onPress={() => void save()} style={{ alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, opacity: loading || saving ? 0.5 : 1 }}>
      <Text style={{ color: colors.background, fontWeight: "800" }}>{saving ? "جارٍ الحفظ…" : "حفظ حد التنبيه"}</Text>
    </Pressable>
  </View>;
}
