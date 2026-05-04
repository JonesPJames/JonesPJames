import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../src/components/AppHeader";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme, fmtCZK, fmtDateCZ } from "../../src/theme";
import { api, getApiErrorMessage, pdfUrl } from "../../src/api";

export default function Vyuctovani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get(`/jobs/${id}`);
      setJob(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function patch(payload: any) {
    const r = await api.put(`/jobs/${id}`, payload);
    setJob(r.data);
  }

  async function finalize() {
    Alert.alert(
      "Finalizovat a uzamknout",
      "Po finalizaci nebude možné vyúčtování dále upravovat. Pokračovat?",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Finalizovat",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await patch({ finalized: true });
            } catch (e: any) {
              Alert.alert("Chyba", getApiErrorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  async function downloadPdf() {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const token = await AsyncStorage.getItem("rp_token");
    Linking.openURL(`${pdfUrl(`/api/jobs/${id}/billing-pdf`)}?token=${token || ""}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (!job) return null;

  const t = job.totals || {};
  const original = (t.cena_prace || 0) + (t.cena_material || 0) + (t.cena_doprava || 0);
  const extra = t.vicepracovne_total || 0;
  const isFinal = !!job.finalized;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title={`Vyúčtování • ${job.job_number}`} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerCard}>
            <Text style={styles.label}>Klient</Text>
            <Text style={styles.value}>{job.client_name}</Text>
            <Text style={styles.label}>Adresa realizace</Text>
            <Text style={styles.value}>{job.address}</Text>
            <Text style={styles.label}>Datum dokončení</Text>
            <Text style={styles.value}>{fmtDateCZ(new Date())}</Text>
            {isFinal ? (
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800" }}>UZAMČENO</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Sekce 1 — Původní nabídka</Text>
          <View style={styles.card}>
            <Row label="Práce" value={fmtCZK(t.cena_prace)} />
            <Row label="Materiál" value={fmtCZK(t.cena_material)} />
            <Row label="Doprava a manipulace" value={fmtCZK(t.cena_doprava)} />
            <Row label="Mezisoučet" value={fmtCZK(original)} bold />
          </View>

          <Text style={styles.sectionTitle}>Sekce 2 — Vícepráce a materiál navíc</Text>
          <View style={styles.card}>
            <Row label="Vícepráce + materiál navíc" value={fmtCZK(extra)} bold />
            <Text style={styles.hint}>Editujte v sekci Stavební deník — změny se propíší automaticky.</Text>
          </View>

          <Text style={styles.sectionTitle}>Sekce 3 — Výpis ze stavebního deníku</Text>
          <View style={styles.card}>
            {(job.diary_entries || []).length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontStyle: "italic" }}>— bez záznamů —</Text>
            ) : (
              (job.diary_entries || []).map((e: any) => (
                <View key={e.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 13 }}>{e.date}</Text>
                  <Text style={{ color: theme.colors.text, marginTop: 2 }}>{e.work}</Text>
                </View>
              ))
            )}
            <View style={{ height: 12 }} />
            <Field
              label="📷 Odkaz na fotodokumentaci (Google Drive / album)"
              value={photoUrl}
              onChangeText={onChangePhoto}
              editable={!isFinal}
              autoCapitalize="none"
              placeholder="https://..."
              testID="photo-url"
            />
          </View>

          <Text style={styles.sectionTitle}>Sekce 4 — Rekapitulace</Text>
          <View style={styles.recapCard}>
            <Row label="Původní nabídka celkem" value={fmtCZK(original)} />
            <Row label="Vícepráce celkem" value={fmtCZK(extra)} />
            <View style={styles.bigTotal}>
              <Text style={styles.bigTotalLabel}>CELKEM K FAKTURACI</Text>
              <Text style={styles.bigTotalVal}>{fmtCZK(original + extra)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Field
              label="Poznámka / platební podmínky"
              value={paymentNote}
              onChangeText={onChangeNote}
              editable={!isFinal}
              multiline
              placeholder="Např. Splatnost 14 dní od vystavení faktury, číslo účtu, IBAN…"
              testID="payment-note"
            />
          </View>

          <PrimaryButton title="📄 Stáhnout vyúčtování (PDF)" onPress={downloadPdf} testID="billing-pdf" />
          <View style={{ height: 10 }} />
          {!isFinal ? (
            <PrimaryButton
              variant="danger"
              title="🔒 Finalizovat a uzamknout"
              onPress={finalize}
              loading={busy}
              testID="finalize-btn"
            />
          ) : null}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, light }: { label: string; value: string; bold?: boolean; light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: light ? "#fff" : theme.colors.textMuted, fontSize: 14, fontWeight: bold ? "800" : "500" }}>{label}</Text>
      <Text style={{ color: light ? "#fff" : theme.colors.text, fontSize: bold ? 16 : 14, fontWeight: bold ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
  container: { padding: 16 },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  label: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 8 },
  value: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  lockedBadge: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 10,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  hint: { color: theme.colors.textMuted, fontSize: 12, fontStyle: "italic", marginTop: 6 },
  recapCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  bigTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: theme.colors.text,
    marginTop: 4,
  },
  bigTotalLabel: { color: theme.colors.text, fontWeight: "800", fontSize: 14, letterSpacing: 1.4 },
  bigTotalVal: { color: theme.colors.text, fontWeight: "800", fontSize: 28 },
});
