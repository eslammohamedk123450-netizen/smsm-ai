import { Redirect, Drawer } from "expo-router/drawer";
import { ActivityIndicator, StyleSheet, View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useEffect, useState } from "react";
import { useAuth } from "../../src/features/auth/auth-provider";
import { supabase } from "../../src/lib/supabase/client";
import { colors } from "../../src/theme/colors";

function CustomDrawerContent() {
  const [chats, setChats] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
    supabase.from("suly_conversations")
      .select("id, title")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setChats(data.map(c => ({ id: c.id, title: c.title.substring(0, 30) })));
      });
  }, []);

  return (
    <View style={styles.drawerContainer}>
      <Pressable style={styles.newChatButton}><Text style={styles.newChatText}>＋ محادثة جديدة</Text></Pressable>
      <TextInput placeholder="بحث في المحادثات…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
      
      <FlatList 
        data={chats}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
            <Pressable style={styles.chatItem}><Text style={styles.chatItemText}>{item.title}</Text></Pressable>
        )}
      />

      <View style={styles.drawerFooter}>
        <Pressable><Text style={styles.footerText}>الإعدادات</Text></Pressable>
        <Text style={styles.userName}>اسم المستخدم</Text>
      </View>
    </View>
  );
}

export default function ProtectedLayout() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Drawer 
        drawerContent={() => <CustomDrawerContent />} 
        screenOptions={{ 
            headerShown: false, 
            drawerPosition: 'right', // Sidebar to the Right
            drawerStyle: { backgroundColor: colors.background } 
        }} 
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  drawerContainer: { flex: 1, padding: 16, backgroundColor: colors.background },
  newChatButton: { padding: 16, borderRadius: 12, backgroundColor: colors.primary, marginBottom: 16 },
  newChatText: { color: "#FFFFFF", fontWeight: "700", textAlign: "center" },
  searchInput: { padding: 12, borderRadius: 8, backgroundColor: colors.surface, color: colors.textPrimary, marginBottom: 16 },
  chatItem: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: colors.surface },
  chatItemText: { color: colors.textPrimary },
  drawerFooter: { marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 },
  footerText: { color: colors.textPrimary, marginBottom: 8 },
  userName: { color: colors.textSecondary }
});
