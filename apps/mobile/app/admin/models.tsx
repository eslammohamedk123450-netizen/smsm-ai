import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useRoute } from "@expo/router";

export default function ModelsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);
  [models, setModels] = useState[]();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getModels();
      setModels(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (id: string) => {
    const model = models.find(m => m.id === id);
    if (model) {
      try {
        // Update enabled status by updating the model
        const { error } = await adminService.getSupabase()
          .from('ai_models')
          .update({ enabled: !model.enabled })
          .eq('id', id);
        if (error) throw error;
        setModels(models.map(m => m.id === id ? { ...model, enabled: !m.enabled } : m));
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to update model status");
      }
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Models Management</Text>
      {models.length === 0 ? (
        <Text style={styles.empty}>No models available</Text>
      ) : (
        <FlatList
          data={models}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <View style={styles.modelItem}>
              <Text style={styles.modelName}>{item.display_name}</Text>
              <Text style={styles.modelCategory}>{item.category}</Text>
              <Pressable style={styles.toggleBtn} onPress={() => handleToggleEnabled(item.id)}>
                <Text style={styles.toggleText}>{model.enabled ? "Disable" : "Enable"}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      <Pressable style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F5F8FF",
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 24,
  },
  empty: {
    color: "#888",
    marginVertical: 20,
    textAlign: "center",
  },
  modelItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 8,
  },
  modelName: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  modelCategory: {
    fontSize: 14,
    color: "#666",
  },
  toggleBtn: {
    padding: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  back: {
    marginTop: 24,
    alignSelf: "flex-end",
  },
  backText: {
    color: "#1A73E8",
    fontWeight: 500,
  },
});