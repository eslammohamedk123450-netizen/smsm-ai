import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useNavigation } from "@expo/router";

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);
  [apiKeys, setApiKeys] = useState<Any[]>([]);
  [models, setModels] = useState<Any[]>([]);
  [users, setUsers] = useState<Any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      [setApiKeys, setModels, setUsers] = await Promise.all([
        adminService.getApiKeys(),
        adminService.getModels(),
        adminService.getUsers(),
      ]);
    } catch (err: any) {
      alert(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleKey = async (id: string) => {
    const key = apiKeys.find(k => k.id === id);
    if (key) {
      await adminService.toggleApiKey(id, !key.is_active);
      setApiKeys(apiKeys.map(k => k.id === id ? { ...k, is_active: !k.is_active } : k));
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      
      <View style={styles.stats}>
        <View style={statsItem}>
          <Text>{apiKeys.length}</Text>
          <Text>API Keys</Text>
        </View>
        <View style={statsItem}>
          {models.length}
          <Text>Models</Text>
        </View>
        <View style={statsItem}>
          {users.length}
          <Text>Admins</Text>
        </View>
      </View>
      
      <Text style={styles.section}>API Keys</Text>
      {apiKeys.length === 0 ? (
        <Text style={styles.empty}>No API keys configured</Text>
      ) : (
        apiKeys.map((key) => (
          <View key={key.id} style={keyRow}>
            <Text>{key.provider}</Text>
            <Text>{key.is_active ? "Active" : "Inactive"}</Text>
            <Pressable style={toggleBtn} onPress={() => handleToggleKey(key.id)}>
              <Text>{key.is_active ? "Disable" : "Enable"}</Text>
            </Pressable>
          </View>
        ))
      )}
      
      <Text style={styles.section}>Models</Text>
      {models.length === 0 ? (
        <Text style={styles.empty}>No models available</Text>
      ) : (
        models.map((model) => (
          <View key={model.id} style={modelRow}>
            <Text>{model.display_name}</Text>
            <Text>{model.category}</Text>
          </View>
        ))
      )}
      
      <Text style={styles.section}>Users</Text>
      {users.length === 0 ? (
        <Text style={styles.empty}>No admin users</Text>
      ) : (
        users.map((user) => (
          <View key={user.id} style={userRow}>
            <Text>{user.email}</Text>
            <Text>{user.credit_balance} credits</Text>
          </View>
        ))
      )}
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
  stats: {
    flexDirection: "row",
    marginBottom: 24,
  },
  statsItem: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    minWidth: 100,
    alignItems: "center",
  },
  statsItem Text: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  section: {
    fontSize: 16,
    color: "#555",
    marginBottom: 12,
  },
  empty: {
    color: "#888",
    marginVertical: 20,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 4,
  },
  modelRow: {
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 4,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 4,
  },
  toggleBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});