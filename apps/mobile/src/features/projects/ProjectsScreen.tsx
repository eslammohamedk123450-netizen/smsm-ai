import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { useToast } from "../../src/components/ui/Toast";
import { projectService, type SulyProject } from "../../src/features/projects/project-service";
import { colors } from "../../src/theme/colors";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  folder: "folder-outline",
  code: "code-slash-outline",
  briefcase: "briefcase-outline",
  book: "book-outline",
  lightbulb: "bulb-outline",
  palette: "color-palette-outline",
  rocket: "rocket-outline",
  database: "server-outline",
  globe: "globe-outline",
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { show } = useToast();
  const [projects, setProjects] = useState<SulyProject[]>([]);
  const [archived, setArchived] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await projectService.listProjects(archived));
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذر تحميل المشاريع.", "error");
    } finally {
      setLoading(false);
    }
  }, [archived, show]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await projectService.createProject({ name, description, iconKey: "folder" });
      setName("");
      setDescription("");
      await load();
      show("تم إنشاء المشروع.", "success");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذر إنشاء المشروع.", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleArchive = async (project: SulyProject) => {
    try {
      await projectService.setArchived(project.id, !project.archived_at);
      await load();
      show(project.archived_at ? "تمت استعادة المشروع." : "تمت أرشفة المشروع.", "success");
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذر تحديث المشروع.", "error");
    }
  };

  const openProject = (project: SulyProject) => {
    router.push({ pathname: "/(protected)/chat", params: { projectId: project.id } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
            <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>مشاريعي</Text>
            <Text style={styles.subtitle}>اجمع محادثاتك ومهامك في مساحات عمل منظمة.</Text>
          </View>
          <Ionicons name="folder-open-outline" size={27} color={colors.primary} />
        </View>

        {!archived ? (
          <View style={styles.createCard}>
            <Text style={styles.sectionTitle}>إنشاء مشروع جديد</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="اسم المشروع"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              style={styles.input}
              textAlign="right"
              accessibilityLabel="اسم المشروع"
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="وصف مختصر (اختياري)"
              placeholderTextColor={colors.textMuted}
              maxLength={2000}
              multiline
              style={[styles.input, styles.descriptionInput]}
              textAlign="right"
              accessibilityLabel="وصف المشروع"
            />
            <Pressable disabled={creating || !name.trim()} onPress={() => void create()} style={[styles.createButton, (creating || !name.trim()) && styles.disabled]}>
              {creating ? <ActivityIndicator size="small" color={colors.background} /> : <Ionicons name="add" size={19} color={colors.background} />}
              <Text style={styles.createButtonText}>إنشاء المشروع</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>{archived ? "المشاريع المؤرشفة" : "المشاريع النشطة"}</Text>
          <Pressable onPress={() => setArchived((value) => !value)} style={styles.archiveToggle}>
            <Ionicons name={archived ? "folder-open-outline" : "archive-outline"} size={16} color={colors.primary} />
            <Text style={styles.archiveToggleText}>{archived ? "عرض النشطة" : "الأرشيف"}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : projects.length ? projects.map((project) => (
          <View key={project.id} style={styles.projectCard}>
            <View style={[styles.projectIcon, { borderColor: project.color }]}>
              <Ionicons name={ICONS[project.icon_key] ?? "folder-outline"} size={23} color={project.color} />
            </View>
            <View style={styles.projectCopy}>
              <Text style={styles.projectName}>{project.name}</Text>
              {project.description ? <Text style={styles.projectDescription}>{project.description}</Text> : <Text style={styles.projectDescription}>لا يوجد وصف للمشروع</Text>}
              <Text style={styles.projectDate}>آخر تحديث: {new Date(project.updated_at).toLocaleDateString("ar-EG")}</Text>
            </View>
            <View style={styles.projectActions}>
              {!archived ? (
                <Pressable onPress={() => openProject(project)} style={styles.openButton}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.background} />
                  <Text style={styles.openButtonText}>افتح</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => void toggleArchive(project)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={archived ? "استعادة المشروع" : "أرشفة المشروع"}>
                <Ionicons name={archived ? "refresh-outline" : "archive-outline"} size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )) : (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{archived ? "لا توجد مشاريع مؤرشفة" : "لسه مفيش مشاريع"}</Text>
            <Text style={styles.emptyText}>{archived ? "ستظهر المشاريع التي تقوم بأرشفتها هنا." : "أنشئ مشروعك الأول وابدأ محادثة مرتبطة به."}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 16, paddingBottom: 36, maxWidth: 900, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  headerCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 12, textAlign: "right", lineHeight: 19 },
  createCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.textPrimary, paddingHorizontal: 13, paddingVertical: 12, minHeight: 46 },
  descriptionInput: { minHeight: 76, textAlignVertical: "top" },
  createButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 12, backgroundColor: colors.primary },
  createButtonText: { color: colors.background, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  listHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  archiveToggle: { flexDirection: "row-reverse", alignItems: "center", gap: 5, padding: 8 },
  archiveToggleText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  loader: { marginTop: 24 },
  projectCard: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13 },
  projectIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  projectCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  projectName: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: "right" },
  projectDescription: { color: colors.textSecondary, fontSize: 11, textAlign: "right", lineHeight: 17 },
  projectDate: { color: colors.textMuted, fontSize: 10 },
  projectActions: { alignItems: "center", gap: 8 },
  openButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.primary },
  openButtonText: { color: colors.background, fontSize: 11, fontWeight: "800" },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptyText: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
});
