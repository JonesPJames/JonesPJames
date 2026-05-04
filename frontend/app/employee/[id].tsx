import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../src/components/AppHeader";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/theme";
import { api, getApiErrorMessage } from "../../src/api";

export default function EmployeeJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDiary, setShowDiary] = useState(false);
  const [showProposal, setShowProposal] = useState(false);

  // diary form
  const [dDate, setDDate] = useState(new Date().toISOString().slice(0, 10));
  const [dWork, setDWork] = useState("");
  const [dWeather, setDWeather] = useState("");
  const [dWorkers, setDWorkers] = useState("");
  const [dNotes, setDNotes] = useState("");

  // proposal form
  const [pPopis, setPPopis] = useState("");
  const [pMnozstvi, setPMnozstvi] = useState("1");
  const [pJednotka, setPJednotka] = useState("ks");
  const [pNote, setPNote] = useState("");

  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get(`/employee/jobs/${id}`);
      setJob(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function submitDiary() {
    if (!dWork.trim()) return Alert.alert("Vyplňte popis prací");
    setSaving(true);
    try {
      await api.post(`/employee/jobs/${id}/diary`, {
        date: dDate,
        work: dWork,
        weather: dWeather,
        workers: dWorkers,
        notes: dNotes,
      });
      setDWork(""); setDWeather(""); setDWorkers(""); setDNotes("");
      setShowDiary(false);
      await load();
      Alert.alert("Uloženo", "Záznam do deníku byl uložen.");
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function submitProposal() {
    if (!pPopis.trim()) return Alert.alert("Vyplňte popis víceprací");
    setSaving(true);
    try {
      await api.post(`/employee/jobs/${id}/propose-vicepracovne`, {
        popis: pPopis,
        mnozstvi: parseFloat(pMnozstvi.replace(",", ".")) || 1,
        jednotka: pJednotka,
        note: pNote,
      });
      setPPopis(""); setPMnozstvi("1"); setPJednotka("ks"); setPNote("");
      setShowProposal(false);
      await load();
      Alert.alert("Návrh odeslán", "Vlastník zakázky návrh schválí nebo zamítne.");
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!job) return null;

  const myProposals = (job.vicepracovne_proposals || []).filter((p: any) => p.proposed_by);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title={job.job_number} back />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Klient</Text>
          <Text style={styles.value}>{job.client_name || "—"}</Text>
          <Text style={styles.label}>Adresa realizace</Text>
          <Text style={styles.value}>{job.address || "—"}</Text>
          <Text style={styles.label}>Název</Text>
          <Text style={styles.value}>{job.title || "—"}</Text>
        </View>

        {(job.material || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📦 Materiál (bez cen)</Text>
            <View style={styles.card}>
              {job.material.map((m: any, i: number) => (
                <View key={m.id || i} style={styles.lineRow}>
                  <Text style={styles.lineText}>{m.popis}</Text>
                  <Text style={styles.lineMeta}>{m.mnozstvi} {m.jednotka}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(job.prace || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🔨 Rozsah prací</Text>
            <View style={styles.card}>
              {job.prace.map((p: any, i: number) => (
                <View key={p.id || i} style={styles.lineRow}>
                  <Text style={styles.lineText}>{p.popis}</Text>
                  <Text style={styles.lineMeta}>{p.mnozstvi} {p.jednotka}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>📓 Stavební deník</Text>
        <View style={styles.card}>
          {(job.diary_entries || []).length === 0 ? (
            <Text style={styles.muted}>Zatím bez záznamů.</Text>
          ) : (
            (job.diary_entries || []).slice().reverse().map((e: any) => (
              <View key={e.id} style={styles.diaryEntry}>
                <Text style={styles.diaryDate}>
                  {e.date}{e.author_name ? ` • ${e.author_name}` : ""}
                </Text>
                <Text style={styles.diaryWork}>{e.work}</Text>
              </View>
            ))
          )}
        </View>
        <PrimaryButton title="+ Nový záznam do deníku" onPress={() => setShowDiary(true)} testID="emp-add-diary" />

        <Text style={styles.sectionTitle}>📝 Návrhy víceprací</Text>
        <View style={styles.card}>
          {myProposals.length === 0 ? (
            <Text style={styles.muted}>Žádné návrhy.</Text>
          ) : (
            myProposals.map((p: any) => (
              <View key={p.id} style={styles.diaryEntry}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.diaryWork}>{p.popis}</Text>
                  <View style={[styles.statusTag, p.status === "approved" ? styles.tagApproved : p.status === "rejected" ? styles.tagRejected : styles.tagPending]}>
                    <Text style={[styles.statusTagText, p.status === "approved" ? { color: "#14532d" } : p.status === "rejected" ? { color: "#7f1d1d" } : { color: "#78350f" }]}>
                      {p.status === "approved" ? "Schváleno" : p.status === "rejected" ? "Zamítnuto" : "Čeká"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.diaryDate}>{p.mnozstvi} {p.jednotka}</Text>
              </View>
            ))
          )}
        </View>
        <PrimaryButton variant="secondary" title="+ Navrhnout vícepráce" onPress={() => setShowProposal(true)} testID="emp-propose" />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Diary modal */}
      <Modal visible={showDiary} transparent animationType="slide" onRequestClose={() => setShowDiary(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Záznam do deníku</Text>
              <Field label="Datum" value={dDate} onChangeText={setDDate} testID="d-date" />
              <Field label="Popis prací" value={dWork} onChangeText={setDWork} multiline testID="d-work" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Počasí" value={dWeather} onChangeText={setDWeather} /></View>
                <View style={{ flex: 1 }}><Field label="Pracovníci" value={dWorkers} onChangeText={setDWorkers} /></View>
              </View>
              <Field label="Poznámka" value={dNotes} onChangeText={setDNotes} multiline />
              <PrimaryButton title="Uložit záznam" onPress={submitDiary} loading={saving} />
              <View style={{ height: 8 }} />
              <PrimaryButton variant="ghost" title="Zrušit" onPress={() => setShowDiary(false)} />
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Proposal modal */}
      <Modal visible={showProposal} transparent animationType="slide" onRequestClose={() => setShowProposal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Navrhnout vícepráce</Text>
              <Text style={styles.muted}>Vlastník návrh schválí a doplní cenu. Bez ceny — vy ji nezadáváte.</Text>
              <View style={{ height: 12 }} />
              <Field label="Popis víceprací" value={pPopis} onChangeText={setPPopis} multiline />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Množství" value={pMnozstvi} onChangeText={setPMnozstvi} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Field label="Jednotka" value={pJednotka} onChangeText={setPJednotka} /></View>
              </View>
              <Field label="Poznámka pro vlastníka" value={pNote} onChangeText={setPNote} multiline />
              <PrimaryButton title="Odeslat návrh" onPress={submitProposal} loading={saving} />
              <View style={{ height: 8 }} />
              <PrimaryButton variant="ghost" title="Zrušit" onPress={() => setShowProposal(false)} />
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
  container: { padding: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  value: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textMuted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
  },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineText: { color: theme.colors.text, flex: 1, fontSize: 15 },
  lineMeta: { color: theme.colors.textMuted, fontWeight: "700", fontSize: 14, marginLeft: 8 },
  diaryEntry: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  diaryDate: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  diaryWork: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  muted: { color: theme.colors.textMuted, fontStyle: "italic" },
  statusTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusTagText: { fontSize: 11, fontWeight: "800" },
  tagPending: { backgroundColor: "#fef3c7" },
  tagApproved: { backgroundColor: "#dcfce7" },
  tagRejected: { backgroundColor: "#fee2e2" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    maxHeight: "92%",
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.text, marginBottom: 14 },
});
