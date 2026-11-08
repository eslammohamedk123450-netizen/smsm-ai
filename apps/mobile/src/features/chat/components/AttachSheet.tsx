import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { useToast } from "../../../components/ui/Toast";
import { getThemeColors } from "../../../theme/colors";
import { pickMedia, type PickedMedia, type PickKind } from "../../media/media-service";

type Props = { visible: boolean; onClose(): void; onPicked(media: PickedMedia): void };
const choices: { kind: PickKind; title: string; subtitle: string; icon: string }[] = [
  { kind: "image", title: "صورة", subtitle: "اختر صورة من جهازك", icon: "▧" },
  { kind: "video", title: "فيديو", subtitle: "أرفق مقطعًا مرئيًا", icon: "▷" },
  { kind: "document", title: "ملف", subtitle: "مستندات وملفات أخرى", icon: "▤" },
];
export function AttachSheet({ visible, onClose, onPicked }: Props) {
  const [busy, setBusy] = useState<PickKind | null>(null);
  const { show } = useToast();
  const palette = getThemeColors(useColorScheme() === "light" ? "light" : "dark");
  const choose = async (kind: PickKind) => {
    setBusy(kind);
    try {
      const picked = await pickMedia(kind);
      if (picked) { onPicked(picked); onClose(); }
    } catch (cause) {
      onClose();
      show(cause instanceof Error ? cause.message : "تعذّر اختيار المرفق. حاول مرة أخرى.", "error");
    } finally { setBusy(null); }
  };
  return (
    <BottomSheet visible={visible} title="إضافة مرفق" onClose={onClose}>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>اختر نوع الملف الذي تريد إرفاقه بالمحادثة.</Text>
      <View style={styles.row}>
        {choices.map((choice) => (
          <Pressable
            key={choice.kind}
            onPress={() => void choose(choice.kind)}
            disabled={busy !== null}
            style={({ pressed }) => [styles.card, { backgroundColor: pressed ? palette.surfaceElevated : palette.surface, borderColor: pressed ? palette.primary : palette.divider, shadowColor: palette.primary, opacity: busy && busy !== choice.kind ? 0.5 : 1 }]}
          >
            {busy === choice.kind ? <ActivityIndicator color={palette.primary} /> : <Text style={[styles.icon, { color: palette.primary }]}>{choice.icon}</Text>}
            <Text style={[styles.title, { color: palette.textPrimary }]}>{choice.title}</Text>
            <Text style={[styles.caption, { color: palette.textMuted }]}>{choice.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  subtitle: { textAlign: "right", fontSize: 13, marginBottom: 18, lineHeight: 20 },
  row: { flexDirection: "row-reverse", gap: 10 },
  card: { flex: 1, minHeight: 126, borderWidth: 1, borderRadius: 18, padding: 12, alignItems: "center", justifyContent: "center", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  icon: { fontSize: 25, height: 34, textAlignVertical: "center" },
  title: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  caption: { fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 5 },
});
