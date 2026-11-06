import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useRoute } from "@expo/router";

export default function ApiKeysScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);
  [apiKeys, setApiKeys] = useState[]();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getApiKeys();
      setApiKeys(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKey = async (id: string) => {
    const key = apiKeys.find(k => k.id === id);
    if (key) {
      try {
        await adminService.toggleApiKey(id, !key.is_active);
        setApiKeys(apiKeys.map(k => k.id === id ? { ...k, is_active: !k.is_active } : k));
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to toggle API key");
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
      <Text style={styles.title}>API Keys Management</Text>
      {apiKeys.length === 0 ? (
        <Text style={styles.empty}>No API keys configured</Text>
      ) : (
        <FlatList
          data={apiKeys}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <View style={styles.keyItem}>
              <Text style={styles.keyProvider}>{item.provider}</Text>
              <Text style={styles.keyStatus}>{key.is_active ? "Active" : "Inactive"}</Text>
              <Pressable style={styles.toggleBtn} onPress={() => toggleKey(item.id)}>
                <Text style={styles.toggleText}>{key.is_active ? "Disable" : "Enable"}</Text>
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
  keyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 8,
  },
  keyProvider: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  keyStatus: {
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