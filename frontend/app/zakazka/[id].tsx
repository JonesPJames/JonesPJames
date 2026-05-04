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
  const [employees, setEmployees] = useState<any[]>([]);

  async function loadEmployees() {
    try {
      const r = await api.get("/employees");
      setEmployees(r.data);
    } catch {}
  }
  useEffect(() => { loadEmployees(); }, []);

  async function toggleAssign(empId: string) {
    if (!job) return;
    const cur: string[] = job.assigned_employee_ids || [];
    const next = cur.includes(empId) ? cur.filter((x) => x !== empId) : [...cur, empId];
    try {
      const r = await api.put(`/jobs/${id}/assign`, { employee_ids: next });
      setJob(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    }
  }

  async function resolveProposal(propId: string, action: "approve" | "reject") {
    if (action === "approve") {
      Alert.prompt
        ? Alert.prompt("Cena za jednotku", "Zadejte cenu (Kč)", async (price) => {
            try {
              const r = await api.post(`/jobs/${id}/proposals/${propId}/resolve`, { action, cena: parseFloat(price || "0") || 0 });
              setJob(r.data);
            } catch (e: any) { Alert.alert("Chyba", getApiErrorMessage(e)); }
          }, "plain-text", "0", "numeric")
        : (async () => {
            try {
              const r = await api.post(`/jobs/${id}/proposals/${propId}/resolve`, { action, cena: 0 });
              setJob(r.data);
              Alert.alert("Návrh schválen", "Cenu nastavte v tabulce Vícepráce v deníku.");
            } catch (e: any) { Alert.alert("Chyba", getApiErrorMessage(e)); }
          })();
    } else {
      try {
        const r = await api.post(`/jobs/${id}/proposals/${propId}/resolve`, { action, cena: 0 });
        setJob(r.data);
      } catch (e: any) { Alert.alert("Chyba", getApiErrorMessage(e)); }
    }
  }

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
          <View style={styles.summaryCard} testID="summary-card">
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.sumOverline}>Cenová nabídka</Text>
                <Text style={styles.sumNumber}>{job.job_number}</Text>
                <Text style={styles.sumDate}>{fmtDateCZ(job.created_at)}</Text>
              </View>
              <StatusBadge status={status} daysLeft={job.days_left} />
            </View>

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
  empRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  empRowOn: { backgroundColor: theme.colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 8 },
  proposal: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sumOverline: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sumNumber: { color: theme.colors.text, fontSize: 26, fontWeight: "800", marginTop: 4 },
  sumDate: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  sumGrid: { flexDirection: "row", gap: 8, marginTop: 18 },
  sumCell: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
  },
  sumLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  sumVal: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  sumTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: theme.colors.text,
  },
  sumTotalLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "800", letterSpacing: 1.4 },
  sumTotalVal: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  expiry: { color: theme.colors.textMuted, fontSize: 13, marginTop: 10, textAlign: "center" },
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
