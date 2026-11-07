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
  const [adminState, setAdminState] = useState<AdminState>("checking");
  useEffect(() => {
    let active = true;
    if (status === "loading") return () => { active = false; };
    if (!user || status !== "authenticated") {
      setAdminState("denied");
      return () => { active = false; };
    }
    setAdminState("checking");
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_is_admin");
        if (active) setAdminState(error ? "error" : data === true ? "authorized" : "denied");
      } catch {
        if (active) setAdminState("error");
      }
    })();
    return () => { active = false; };
  }, [user?.id, status]);

  if (status === "loading" || adminState === "checking") return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.text}>جارٍ التحقق من صلاحية المشرف…</Text></View>;
  if (status === "misconfigured") return <Redirect href="/" />;
  if (!user) return <Redirect href="/login" />;
  if (adminState === "denied") return <Redirect href="/chat" />;
  if (adminState === "error") return <View style={styles.center}><Text style={styles.error}>تعذر التحقق من صلاحية المشرف. لم تُفتح أدوات الإدارة.</Text></View>;
  return <AdminShell />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: colors.background }, text: { color: colors.textSecondary }, error: { color: colors.error, textAlign: "center", maxWidth: 480 } });
