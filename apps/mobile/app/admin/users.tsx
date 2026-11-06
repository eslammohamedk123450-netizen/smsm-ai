import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useRoute } from "@expo/router";

export default function UsersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);
  [users, setUsers] = useState[]();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCredits = async (userId: string, amount: number) => {
    try {
      const result = await adminService.updateUserCredits(userId, amount);
      Alert.alert("Success", `${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} credits`);
      loadData(); // Refresh
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update credits");
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
      <Text style={styles.title}>Users Management</Text>
      {users.length === 0 ? (
        <Text style={styles.empty}>No admin users found</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <View style={styles.userItem}>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userCredits}>{item.credit_balance} credits</Text>
              <Pressable style={styles.creditBtn} onPress={() => handleUpdateCredits(item.id, 10)}>
                <Text style={styles.creditText}>+10 Credits</Text>
              </Pressable>
              <Pressable style={styles.creditBtn2} onPress={() => handleUpdateCredits(item.id, -5)}>
                <Text style={styles.creditText2}>-5 Credits</Text>
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
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  userCredits: {
    fontSize: 14,
    color: "#666",
  },
  creditBtn: {
    marginTop: 4,
    padding: 6,
    backgroundColor: "#1A73E8",
    borderRadius: 4,
  },
  creditText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  creditBtn2: {
    marginTop: 4,
    padding: 6,
    backgroundColor: "#CF1A2A",
    borderRadius: 4,
    marginLeft: 8,
  },
  creditText2: {
    color: "#FFFFFF",
    fontSize: 12,
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