import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppHeader } from "../src/components/AppHeader";
import { AppFooter } from "../src/components/AppFooter";
import { filterClients } from "../src/clientDirectory";
import { useClientDirectory } from "../src/useClientDirectory";
import { theme } from "../src/theme";

export default function Klienti() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { entries, loading, refreshing, error, refresh } = useClientDirectory();
  const visible = useMemo(() => filterClients(entries, query), [entries, query]);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Adresář klientů" back />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Hledat jméno nebo obec" style={styles.input}
          placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Hledat klienta" testID="client-search" />
      </View>
      <Text style={styles.caption}>Klienti A–Z · {visible.length}</Text>
      <FlatList data={visible} keyExtractor={item => item.id} contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={loading ? <ActivityIndicator color={theme.colors.primary} style={styles.empty} /> : (
          <View style={styles.empty}>
            <Text style={error ? styles.error : styles.emptyTitle}>{error || (query ? "Žádný odpovídající klient" : "Zatím žádní klienti")}</Text>
            {error ? <TouchableOpacity onPress={refresh} style={styles.retry} accessibilityRole="button"><Text>Zkusit znovu</Text></TouchableOpacity> :
              <Text style={styles.hint}>{query ? "Zkuste jiné jméno nebo obec." : "Nového klienta můžete založit přes JARVIS."}</Text>}
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/klient/[id]", params: { id: item.id } })}
            accessibilityRole="button" accessibilityLabel={`Otevřít klienta ${item.name}`} testID={`client-${item.id}`}>
            <View style={styles.body}>
              <Text style={styles.name}>{item.legacy ? item.name : item.sortName}</Text>
              {item.city ? <Text style={styles.hint}>{item.city}</Text> : null}
              <Text style={styles.count}>Zakázky: {item.jobs.length}</Text>
              {item.ambiguous ? <Text style={styles.hint}>Zakázky bez jednoznačného přiřazení</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )} />
      <AppFooter />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  search: { margin: 16, paddingHorizontal: 14, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  caption: { paddingHorizontal: 20, paddingBottom: 12, fontSize: 13, color: theme.colors.textMuted, fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  card: { padding: 18, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, gap: 4 }, name: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  hint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },
  count: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  empty: { alignItems: "center", padding: 24, marginTop: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  error: { color: theme.colors.danger, fontSize: 15 },
  retry: { padding: 14, backgroundColor: theme.colors.surfaceMuted, borderRadius: 10 },
});
