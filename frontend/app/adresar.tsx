import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { JobCard } from "../src/components/JobCard";
import { DirectoryJob, readJobs, recentJobs } from "../src/clientDirectory";
import { theme } from "../src/theme";
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
  const [items, setItems] = useState<DirectoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const r = await api.get("/jobs", { signal: controller.signal });
      if (!controller.signal.aborted) { setItems(readJobs(r.data)); setError(""); }
    } catch (e: any) {
      if (!controller.signal.aborted) { setItems([]); setError(getApiErrorMessage(e)); }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => request.current?.abort();
    }, [load])
  );

  const visible = useMemo(() => recentJobs(items, q, filter), [items, q, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Adresář zakázek" back />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Hledat v posledních 10 zakázkách"
          accessibilityLabel="Hledat v posledních deseti zakázkách"
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

      <View style={styles.archive}>
        <Text style={styles.caption}>Posledních 10 zakázek</Text>
        <TouchableOpacity onPress={() => router.push("/klienti")} accessibilityRole="button" testID="open-client-directory" style={styles.archiveLink}>
          <Text style={styles.archiveText}>Všechny zakázky podle klientů</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.jobsArea} testID="jobs-content-area">
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={styles.err}>{error}</Text>
          ) : visible.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>{items.length ? "Žádná odpovídající nedávná zakázka" : "Zatím žádné zakázky"}</Text>
              <Text style={styles.emptySub}>{items.length ? "Starší zakázky najdete v adresáři klientů." : "Vytvořte první nabídku tlačítkem níže."}</Text>
            </View>
          ) : (
            visible.map(job => <JobCard key={job.id} job={job} />)
          )}
        </ScrollView>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/nova-zakazka")}
          testID="fab-new"
          accessibilityRole="button"
          accessibilityLabel="Vytvořit novou zakázku"
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
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
  jobsArea: { flex: 1 },
  archive: { paddingHorizontal: 20, paddingBottom: 8, gap: 4 },
  caption: { fontSize: 13, color: theme.colors.textMuted, fontWeight: "700" },
  archiveLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10 },
  archiveText: { color: theme.colors.primary, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 100 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
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
