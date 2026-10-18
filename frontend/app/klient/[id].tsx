import React from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppHeader } from "../../src/components/AppHeader";
import { AppFooter } from "../../src/components/AppFooter";
import { JobCard } from "../../src/components/JobCard";
import { useClientDirectory } from "../../src/useClientDirectory";
import { setPrefill } from "../../src/prefill";
import { theme } from "../../src/theme";

export default function KlientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { entries, loading, refreshing, error, refresh } = useClientDirectory();
  const client = entries.find(entry => entry.id === id);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Karta klienta" back />
      {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.empty} /> : !client || error ? (
        <View style={styles.empty}>
          <Text style={error ? styles.error : styles.title}>{error || "Klient nebyl nalezen"}</Text>
          <TouchableOpacity onPress={refresh} style={styles.secondary} accessibilityRole="button"><Text>Zkusit znovu</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/klienti")} style={styles.secondary} accessibilityRole="button"><Text>Adresář klientů</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList data={client.jobs} keyExtractor={job => job.id} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={(
            <View>
              <View style={styles.card}>
                <Text style={styles.title}>{client.name}</Text>
                {client.city ? <Text style={styles.meta}>Obec: {client.city}</Text> : null}
                <Text style={styles.meta}>Počet zakázek: {client.jobs.length}</Text>
                {client.ambiguous ? <Text style={styles.notice}>Stejné jméno má více klientů. Tyto zakázky proto zůstávají vedené zvlášť.</Text> : null}
                {client.id !== "legacy:" && !client.ambiguous ? (
                  <TouchableOpacity style={styles.primary} accessibilityRole="button" testID="client-new-job"
                    onPress={() => { setPrefill({ client_name: client.name }); router.push("/nova-zakazka"); }}>
                    <Text style={styles.buttonText}>+ Nová zakázka pro klienta</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.heading}>Všechny zakázky · od nejnovější</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.noJobs}>Klient zatím nemá žádné zakázky.</Text>}
          renderItem={({ item }) => <JobCard job={item} />} />
      )}
      <AppFooter />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: 16, paddingBottom: 32 },
  card: { padding: 20, borderRadius: theme.radius.card, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, gap: 10, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
  meta: { fontSize: 15, color: theme.colors.textMuted },
  heading: { fontSize: 14, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 16 },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.button, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" },
  notice: { color: theme.colors.danger, lineHeight: 21 },
  noJobs: { padding: 20, textAlign: "center", color: theme.colors.textMuted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  error: { color: theme.colors.danger, fontSize: 15 },
  secondary: { padding: 14, borderRadius: 10, backgroundColor: theme.colors.surfaceMuted },
});
