import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../src/components/AppFooter";
import { useAuth } from "../src/auth";
import { theme, fmtDateCZ } from "../src/theme";
import { api, getApiErrorMessage } from "../src/api";
import { StatusBadge } from "../src/components/StatusBadge";

export default function EmployeeHome() {
  const { employee, logout, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const r = await api.get("/employee/jobs");
      setItems(r.data);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!loading && !employee) router.replace("/login");
  }, [loading, employee]);

  useFocusEffect(useCallback(() => { load(); }, []));

  if (!employee) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>Pracovní karta</Text>
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.meta}>{employee.id} {employee.phone ? `• ${employee.phone}` : ""}</Text>
        </View>
        <TouchableOpacity onPress={async () => { await logout(); router.replace("/login"); }} hitSlop={10} testID="emp-logout">
          <Ionicons name="log-out-outline" size={26} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.sectionTitle}>Moje zakázky ({items.length})</Text>
        {busy ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.err}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Zatím žádné zakázky</Text>
            <Text style={styles.emptySub}>Vlastník vám zakázky přiřadí, jakmile budou schváleny.</Text>
          </View>
        ) : (
          items.map((j) => (
            <TouchableOpacity
              key={j.id}
              style={styles.card}
              onPress={() => router.push(`/employee/${j.id}`)}
              testID={`emp-job-${j.id}`}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={styles.jobNo}>{j.job_number}</Text>
                <StatusBadge status={j.effective_status} />
              </View>
              <Text style={styles.title} numberOfLines={1}>{j.title || "(bez názvu)"}</Text>
              <Text style={styles.client} numberOfLines={1}>👤 {j.client_name || "—"}</Text>
              {j.address ? <Text style={styles.addr} numberOfLines={1}>📍 {j.address}</Text> : null}
              <Text style={styles.date}>{fmtDateCZ(j.created_at)}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <AppFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: theme.colors.text,
  },
  overline: { color: "#a1a1a1", fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  name: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 },
  meta: { color: "#a1a1a1", fontSize: 13, marginTop: 2 },
  list: { padding: 16, paddingBottom: 60 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: theme.colors.textMuted, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  jobNo: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },
  title: { fontSize: 17, fontWeight: "800", color: theme.colors.text, marginTop: 8 },
  client: { fontSize: 14, color: theme.colors.text, marginTop: 4 },
  addr: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  date: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 8 },
  emptySub: { color: theme.colors.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },
  err: { color: theme.colors.danger, padding: 14, backgroundColor: "#f9e6e3", borderRadius: 10 },
});
