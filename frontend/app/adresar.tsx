import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../src/components/AppFooter";
import { AppHeader } from "../src/components/AppHeader";
import { StatusBadge } from "../src/components/StatusBadge";
import { theme, fmtCZK, fmtDateCZ } from "../src/theme";
import { api, getApiErrorMessage } from "../src/api";

const FILTERS = [
  { key: "vse", label: "Vše" },
  { key: "rozpracovano", label: "Rozpracováno" },
  { key: "schvaleno", label: "Schváleno" },
  { key: "odlozeno", label: "Odloženo" },
  { key: "dokonceno", label: "Dokončeno" },
  { key: "expirovano", label: "Expirováno" },
];

export default function Adresar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("vse");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const r = await api.get("/jobs", { params: { q, status: filter } });
      setItems(r.data);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [q, filter])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Adresář zakázek" back />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Hledat klienta nebo číslo zakázky"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.search}
          testID="search-input"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filtersWrap}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`filter-${f.key}`}
            >
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.err}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Zatím žádné zakázky</Text>
            <Text style={styles.emptySub}>Vytvořte první nabídku tlačítkem níže.</Text>
          </View>
        ) : (
          items.map((j) => (
            <TouchableOpacity
              key={j.id}
              style={styles.card}
              onPress={() => router.push(`/zakazka/${j.id}`)}
              testID={`job-${j.id}`}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={styles.jobNo}>{j.job_number}</Text>
                <StatusBadge status={j.effective_status} daysLeft={j.days_left} />
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {j.title || "(bez názvu)"}
              </Text>
              <Text style={styles.client} numberOfLines={1}>
                {j.client_name || "—"}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.date}>{fmtDateCZ(j.created_at)}</Text>
                <Text style={styles.total}>{fmtCZK(j.totals?.celkem || 0)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/nova-zakazka")}
        testID="fab-new"
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <AppFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    margin: 16,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  search: { flex: 1, marginLeft: 8, fontSize: 15, color: theme.colors.text },
  filtersWrap: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 100 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  jobNo: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginTop: 8 },
  client: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  date: { fontSize: 12, color: theme.colors.textMuted },
  total: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.floating,
  },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 8 },
  emptySub: { color: theme.colors.textMuted, fontSize: 13 },
  err: { color: theme.colors.danger, padding: 14, backgroundColor: "#f9e6e3", borderRadius: 10 },
});
