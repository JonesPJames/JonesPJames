import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../../src/components/AppFooter";
import * as ImagePicker from "expo-image-picker";
import { AppHeader } from "../../src/components/AppHeader";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { LineItemEditor, newRow } from "../../src/components/LineItemEditor";
import { theme, fmtCZK } from "../../src/theme";
import { api, getApiErrorMessage } from "../../src/api";

export default function Denik() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ date: new Date().toISOString().slice(0, 10), work: "", weather: "", workers: "", notes: "", photo_base64: "" });
  const [saving, setSaving] = useState(false);

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

  async function addEntry() {
    if (!draft.work.trim()) {
      Alert.alert("Vyplňte popis prací");
      return;
    }
    setSaving(true);
    try {
      const newEntry = { id: `${Date.now()}`, ...draft };
      const entries = [...(job.diary_entries || []), newEntry];
      await patch({ diary_entries: entries });
      setDraft({ date: new Date().toISOString().slice(0, 10), work: "", weather: "", workers: "", notes: "", photo_base64: "" });
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(eid: string) {
    const entries = (job.diary_entries || []).filter((e: any) => e.id !== eid);
    await patch({ diary_entries: entries });
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Přístup zamítnut", "Pro výběr fotky povolte přístup ke knihovně.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setDraft({ ...draft, photo_base64: `data:image/jpeg;base64,${r.assets[0].base64}` });
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (!job) return null;

  const vTotal = (job.totals?.vicepracovne_total || 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title={`Stavební deník • ${job.job_number}`} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerCard}>
            <Text style={styles.client}>{job.client_name || "—"}</Text>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.muted}>{job.address}</Text>
          </View>

          <Text style={styles.sectionTitle}>Přidat denní záznam</Text>
          <View style={styles.section}>
            <Field label="Datum (RRRR-MM-DD)" value={draft.date} onChangeText={(t) => setDraft({ ...draft, date: t })} testID="d-date" />
            <Field label="Popis prací" value={draft.work} onChangeText={(t) => setDraft({ ...draft, work: t })} multiline testID="d-work" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Počasí" value={draft.weather} onChangeText={(t) => setDraft({ ...draft, weather: t })} testID="d-weather" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Pracovníci" value={draft.workers} onChangeText={(t) => setDraft({ ...draft, workers: t })} testID="d-workers" />
              </View>
            </View>
            <Field label="Poznámky" value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline testID="d-notes" />
            <TouchableOpacity onPress={pickPhoto} style={styles.photoBtn} testID="pick-photo">
              <Ionicons name="camera" size={18} color={theme.colors.primary} />
              <Text style={styles.photoBtnText}>{draft.photo_base64 ? "Změnit fotku" : "Přidat fotografii"}</Text>
            </TouchableOpacity>
            {draft.photo_base64 ? (
              <Image source={{ uri: draft.photo_base64 }} style={styles.preview} resizeMode="cover" />
            ) : null}
            <View style={{ height: 8 }} />
            <PrimaryButton title="Uložit záznam" onPress={addEntry} loading={saving} testID="save-entry" />
          </View>

          <Text style={styles.sectionTitle}>Záznamy ({(job.diary_entries || []).length})</Text>
          {(job.diary_entries || []).length === 0 ? (
            <Text style={styles.empty}>Žádné záznamy. Vytvořte první výše.</Text>
          ) : (
            (job.diary_entries || []).slice().reverse().map((e: any) => (
              <View key={e.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryDate}>{e.date}</Text>
                  <TouchableOpacity onPress={() => removeEntry(e.id)} testID={`del-entry-${e.id}`} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.entryWork}>{e.work}</Text>
                <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                  {e.weather ? <Text style={styles.metaTxt}><Ionicons name="cloud-outline" size={12} /> {e.weather}</Text> : null}
                  {e.workers ? <Text style={styles.metaTxt}><Ionicons name="people-outline" size={12} /> {e.workers}</Text> : null}
                </View>
                {e.notes ? <Text style={styles.notes}>{e.notes}</Text> : null}
                {e.photo_base64 ? <Image source={{ uri: e.photo_base64 }} style={styles.preview} /> : null}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Vícepráce</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor
              rows={job.vicepracovne || []}
              onChange={(rows) => patch({ vicepracovne: rows })}
              testIDPrefix="vicepracovne"
            />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => patch({ vicepracovne: [...(job.vicepracovne || []), newRow()] })} compact testID="add-vicepracovne" />
          </View>

          <Text style={styles.sectionTitle}>Materiál navíc</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor
              rows={job.material_navic || []}
              onChange={(rows) => patch({ material_navic: rows })}
              testIDPrefix="material-navic"
            />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => patch({ material_navic: [...(job.material_navic || []), newRow()] })} compact testID="add-material-navic" />
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Vícepráce a materiál navíc celkem</Text>
            <Text style={styles.totalVal}>{fmtCZK(vTotal)}</Text>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppFooter />
    </SafeAreaView>
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
  client: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text, marginTop: 2 },
  muted: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
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
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  photoBtnText: { color: theme.colors.primary, fontWeight: "700" },
  preview: { width: "100%", height: 160, borderRadius: 12, marginTop: 8, backgroundColor: theme.colors.surfaceMuted },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryDate: { color: theme.colors.primary, fontWeight: "800" },
  entryWork: { color: theme.colors.text, fontSize: 15, marginTop: 6 },
  metaTxt: { color: theme.colors.textMuted, fontSize: 12 },
  notes: { color: theme.colors.text, fontStyle: "italic", marginTop: 4 },
  empty: { color: theme.colors.textMuted, fontStyle: "italic", padding: 14, textAlign: "center" },
  tableWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  totalLabel: { color: theme.colors.primary, fontWeight: "800", flex: 1 },
  totalVal: { color: theme.colors.primary, fontWeight: "800", fontSize: 16 },
});
