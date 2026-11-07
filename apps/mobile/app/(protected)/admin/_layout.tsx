import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../../src/features/auth/auth-provider";
import { AdminShell } from "../../../src/features/admin/AdminShell";
import { supabase } from "../../../src/lib/supabase/client";
import { colors } from "../../../src/theme/colors";

type AdminState = "checking" | "authorized" | "denied" | "error";

export default function AdminLayout() {
  const { user, status } = useAuth();
  const [access, setAccess] = useState<{ userId: string | null; state: AdminState }>({ userId: null, state: "checking" });
  const adminState = access.userId === user?.id ? access.state : "checking";
  useEffect(() => {
    let active = true;
    if (status === "loading") return () => { active = false; };
    if (!user || status !== "authenticated") {
      setAccess({ userId: user?.id ?? null, state: "denied" });
      return () => { active = false; };
    }
    setAccess({ userId: user.id, state: "checking" });
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_is_admin");
        if (active) setAccess({ userId: user.id, state: error ? "error" : data === true ? "authorized" : "denied" });
      } catch {
        if (active) setAccess({ userId: user.id, state: "error" });
      }
    })();
    return () => { active = false; };
  }, [user?.id, status]);

  if (status === "misconfigured") return <Redirect href="/" />;
  if (status === "loading" || adminState === "checking") return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.text}>جارٍ التحقق من صلاحية المشرف…</Text></View>;
  if (!user) return <Redirect href="/login" />;
  if (adminState === "denied") return <Redirect href="/chat" />;
  if (adminState === "error") return <View style={styles.center}><Text style={styles.error}>تعذر التحقق من صلاحية المشرف. لم تُفتح أدوات الإدارة.</Text></View>;
  return <AdminShell />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: colors.background }, text: { color: colors.textSecondary }, error: { color: colors.error, textAlign: "center", maxWidth: 480 } });
