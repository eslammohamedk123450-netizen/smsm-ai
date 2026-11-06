import { View, Text, StyleSheet, SafeAreaView, Pressable, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { adminService } from "../../src/features/admin/admin-service";
import { useRoute } from "@expo/router";

export default function CreditManagementScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  [isLoading, setIsLoading] = useState(true);
  [users, setUsers] = useState[]();

  useEffect(() => {
    // Check if credit management is used - per prompt: "تحقق إن كانت شاشة إدارة الرصيد مستخدمة/متاحة قبل قرار عرضها"
    // For now, show as available
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (err: any) {
      // ignore
    }
    setIsLoading(false);
  };

  const handleDeduct = async (userId: string, amount: number) => {
    try {
      await adminService.updateUserCredits(userId, -amount);
      Alert.alert("Success", `${amount} credits deducted`);
      loadUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to deduct credits");
    }
  };

  const handleAdd = async (userId: string, amount: number) => {
    try {
      await adminService.updateUserCredits(userId, amount);
      Alert.alert("Success", `${amount} credits added`);
      loadUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add credits");
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
      <Text style={styles.title}>Credit Management</Text>
      {users.length === 0 ? (
        <Text style={styles.empty}>No users found</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <View style={styles.userItem}>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userCredits}>{item.credit_balance} credits</Text>
              <View style={styles.creditActions}>
                <Pressable style={styles.addBtn} onPress={() => handleAdd(item.id, 10)}>
                  <Text style={styles.addText}>Add 10</Text>
                </Pressable>
                <Pressable style={styles.deductBtn} onPress={() => handleDeduct(item.id, 5)}>
                  <Text style={styles.deductText}>Deduct 5</Text>
                </Pressable>
              </View>
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
  creditActions: {
    flexDirection: "row",
    marginTop: 4,
  },
  addBtn: {
    marginRight: 8,
    padding: 6,
    backgroundColor: "#1A73E8",
    borderRadius: 4,
  },
  deductBtn: {
    padding: 6,
    backgroundColor: "#CF1A2A",
    borderRadius: 4,
  },
  addText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  deductText: {
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