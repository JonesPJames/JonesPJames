import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../src/components/AppHeader";
import { StatusBadge } from "../../src/components/StatusBadge";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Field } from "../../src/components/Field";
import { LineItemEditor, newRow, LineItem } from "../../src/components/LineItemEditor";
import { theme, fmtCZK, fmtDateCZ } from "../../src/theme";
import { api, getApiErrorMessage, pdfUrl } from "../../src/api";

export default function ZakazkaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [matSearch, setMatSearch] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<any>(null);

  async function load() {
    try {
      const r = await api.get(`/jobs/${id}`);
      setJob(r.data);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // Debounced auto-save on changes
  function update(patch: any) {
    setJob((j: any) => {
      const next = { ...j, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
      return next;
    });
  }

  async function persist(j: any) {
    setSaving(true);
    try {
      const payload: any = {
        client_name: j.client_name,
        address: j.address,
        title: j.title,
        prace: j.prace,
        material: j.material,
        doprava: j.doprava,
        vicepracovne: j.vicepracovne,
        material_navic: j.material_navic,
        diary_entries: j.diary_entries,
        photo_url: j.photo_url,
        payment_note: j.payment_note,
      };
      const r = await api.put(`/jobs/${j.id}`, payload);
      setJob(r.data);
      setSavedAt(new Date());
    } catch (e: any) {
      // silent for autosave
      console.warn("autosave fail", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(`status-${status}`);
    try {
      const r = await api.put(`/jobs/${id}`, { status });
      setJob(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function renew() {
    setBusy("renew");
    try {
      const r = await api.post(`/jobs/${id}/renew`);
      setJob(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function searchMaterial() {
    if (!matSearch.trim()) return;
    setBusy("ai-mat");
    try {
      const r = await api.post("/ai/material-price", { name: matSearch });
      const row: LineItem = {
        id: `${Date.now()}`,
        popis: matSearch,
        mnozstvi: 1,
        jednotka: r.data.jednotka || "ks",
        cena: r.data.cena || 0,
      };
      update({ material: [...(job.material || []), row] });
      setMatSearch("");
      Alert.alert("AI návrh", `${matSearch}\n${fmtCZK(r.data.cena)} / ${r.data.jednotka}\n\n${r.data.poznamka || ""}`);
    } catch (e: any) {
      Alert.alert("Chyba AI", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    const url = pdfUrl(`/api/jobs/${id}/pdf`);
    try {
      const token = await (await import("@react-native-async-storage/async-storage")).default.getItem("rp_token");
      Linking.openURL(`${url}?token=${token}`);
    } catch {
      Linking.openURL(url);
    }
  }

  async function deleteJob() {
    Alert.alert("Smazat zakázku?", "Tato akce je nevratná.", [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Smazat",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/jobs/${id}`);
            router.replace("/adresar");
          } catch (e: any) {
            Alert.alert("Chyba", getApiErrorMessage(e));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.danger }}>{error || "Zakázka nenalezena"}</Text>
      </View>
    );
  }

  const totals = job.totals || {};
  const status = job.effective_status as string;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title={job.job_number} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Save indicator */}
          <View style={styles.saveBar} testID="save-indicator">
            {saving ? (
              <>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.saveBarText}>Ukládám…</Text>
              </>
            ) : savedAt ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#315942" />
                <Text style={styles.saveBarText}>
                  Uloženo • {savedAt.getHours().toString().padStart(2, "0")}:{savedAt.getMinutes().toString().padStart(2, "0")}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-done-outline" size={16} color={theme.colors.textMuted} />
                <Text style={styles.saveBarText}>Změny se ukládají automaticky</Text>
              </>
            )}
          </View>

          {/* Status & summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.text }]} testID="summary-card">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sumOverline}>Cenová nabídka</Text>
              <StatusBadge status={status} daysLeft={job.days_left} />
            </View>
            <Text style={styles.sumNumber}>{job.job_number}</Text>
            <Text style={styles.sumDate}>{fmtDateCZ(job.created_at)}</Text>
            <View style={styles.sumGrid}>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Práce</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.cena_prace)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Materiál</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.cena_material)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Doprava</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.cena_doprava)}</Text>
              </View>
            </View>
            <View style={styles.sumTotalRow}>
              <Text style={styles.sumTotalLabel}>CELKEM</Text>
              <Text style={styles.sumTotalVal}>{fmtCZK(totals.celkem)}</Text>
            </View>
            {status === "odlozeno" && typeof job.days_left === "number" && job.days_left >= 0 ? (
              <Text style={styles.expiry}>Platná ještě {job.days_left} dní</Text>
            ) : null}
            {status === "expirovano" ? (
              <PrimaryButton title="Obnovit nabídku (30 dní)" onPress={renew} loading={busy === "renew"} testID="renew-btn" style={{ marginTop: 12 }} />
            ) : null}
          </View>

          {/* Header fields */}
          <View style={styles.section}>
            <Field label="Jméno klienta" value={job.client_name} onChangeText={(t) => update({ client_name: t })} testID="f-client" />
            <Field label="Adresa realizace" value={job.address} onChangeText={(t) => update({ address: t })} testID="f-address" />
            <Field label="Název nabídky" value={job.title} onChangeText={(t) => update({ title: t })} testID="f-title" />
          </View>

          {/* Status buttons */}
          <Text style={styles.sectionTitle}>Stav zakázky</Text>
          <View style={styles.statusRow}>
            {[
              { key: "schvaleno", label: "Schváleno", color: theme.colors.status.schvaleno.bg, text: theme.colors.status.schvaleno.text, icon: "checkmark-circle" as const },
              { key: "odlozeno", label: "Odloženo", color: theme.colors.status.odlozeno.bg, text: theme.colors.status.odlozeno.text, icon: "time" as const },
              { key: "dokonceno", label: "Dokončeno", color: theme.colors.status.dokonceno.bg, text: theme.colors.status.dokonceno.text, icon: "trophy" as const },
            ].map((s) => {
              const active = job.status === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setStatus(s.key)}
                  style={[styles.statusBtn, { backgroundColor: active ? s.color : theme.colors.surface }]}
                  testID={`set-status-${s.key}`}
                >
                  <Ionicons name={s.icon} size={20} color={s.text} />
                  <Text style={[styles.statusBtnText, { color: s.text }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Práce */}
          <Text style={styles.sectionTitle}>Práce</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor rows={job.prace || []} onChange={(rows) => update({ prace: rows })} testIDPrefix="prace" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => update({ prace: [...(job.prace || []), newRow()] })} compact testID="add-prace" />
          </View>

          {/* Materiál + AI search */}
          <Text style={styles.sectionTitle}>Materiál</Text>
          <View style={styles.tableWrap}>
            <View style={styles.aiSearchRow}>
              <TextInput
                value={matSearch}
                onChangeText={setMatSearch}
                placeholder="AI: zadejte materiál (např. dlažba 60x60)"
                placeholderTextColor={theme.colors.placeholder}
                style={styles.aiSearchInput}
                testID="ai-mat-input"
              />
              <TouchableOpacity onPress={searchMaterial} style={styles.aiSearchBtn} testID="ai-mat-btn" disabled={busy === "ai-mat"}>
                {busy === "ai-mat" ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
            <LineItemEditor rows={job.material || []} onChange={(rows) => update({ material: rows })} testIDPrefix="material" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => update({ material: [...(job.material || []), newRow()] })} compact testID="add-material" />
          </View>

          {/* Doprava */}
          <Text style={styles.sectionTitle}>Doprava, závoz a manipulace</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor rows={job.doprava || []} onChange={(rows) => update({ doprava: rows })} testIDPrefix="doprava" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => update({ doprava: [...(job.doprava || []), newRow()] })} compact testID="add-doprava" />
          </View>

          {/* Actions */}
          <View style={{ height: 16 }} />
          <PrimaryButton title="📄 Stáhnout jako PDF" onPress={downloadPdf} testID="pdf-btn" />
          <View style={{ height: 8 }} />
          {job.status === "schvaleno" || job.status === "dokonceno" ? (
            <PrimaryButton variant="secondary" title="Stavební deník" onPress={() => router.push(`/denik/${id}`)} testID="open-denik" />
          ) : null}
          {job.status === "dokonceno" ? (
            <>
              <View style={{ height: 8 }} />
              <PrimaryButton variant="secondary" title="Celkové vyúčtování" onPress={() => router.push(`/vyuctovani/${id}`)} testID="open-vyuctovani" />
            </>
          ) : null}
          <View style={{ height: 8 }} />
          <PrimaryButton variant="ghost" title="Smazat zakázku" onPress={deleteJob} testID="delete-job" />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
  container: { padding: 16, paddingBottom: 60 },
  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveBarText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  summaryCard: {
    borderRadius: theme.radius.card,
    padding: 18,
    marginBottom: 16,
  },
  sumOverline: {
    color: "#c9820a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sumNumber: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 },
  sumDate: { color: "#bbb6ad", fontSize: 12, marginTop: 2 },
  sumGrid: { flexDirection: "row", gap: 8, marginTop: 14 },
  sumCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 10,
  },
  sumLabel: { color: "#bbb6ad", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  sumVal: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sumTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 12,
  },
  sumTotalLabel: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 1.2 },
  sumTotalVal: { color: "#fff", fontSize: 22, fontWeight: "800" },
  expiry: { color: "#fcede3", fontSize: 12, marginTop: 8, textAlign: "center" },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
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
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusBtn: {
    flex: 1,
    minHeight: 60,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBtnText: { fontWeight: "800", fontSize: 13 },
  tableWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  aiSearchRow: { flexDirection: "row", marginBottom: 10, gap: 8 },
  aiSearchInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 48,
  },
  aiSearchBtn: {
    width: 56,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
