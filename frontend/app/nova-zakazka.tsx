import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../src/components/AppHeader";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { LineItemEditor, newRow, LineItem } from "../src/components/LineItemEditor";
import { theme, fmtCZK, fmtDateCZ } from "../src/theme";
import { api, getApiErrorMessage } from "../src/api";
import { consumePrefill } from "../src/prefill";

export default function NovaZakazka() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [title, setTitle] = useState("");
  const [prace, setPrace] = useState<LineItem[]>([]);
  const [material, setMaterial] = useState<LineItem[]>([]);
  const [doprava, setDoprava] = useState<LineItem[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // consume prefill once on mount (from kalkulačka or import)
  useEffect(() => {
    const pf = consumePrefill();
    if (pf) {
      if (pf.title) setTitle(pf.title);
      if (pf.prace?.length) setPrace(pf.prace);
      if (pf.material?.length) setMaterial(pf.material);
      if (pf.doprava?.length) setDoprava(pf.doprava);
    }
  }, []);

  const totals = useMemo(() => {
    const sum = (rows: LineItem[]) =>
      rows.reduce((s, r) => s + (r.mnozstvi || 0) * (r.cena || 0), 0);
    const p = sum(prace);
    const m = sum(material);
    const d = sum(doprava);
    return { p, m, d, total: p + m + d };
  }, [prace, material, doprava]);

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
      setMaterial([...material, row]);
      setMatSearch("");
      Alert.alert("AI návrh", `${r.data.poznamka || ""}\n\n${fmtCZK(r.data.cena)} / ${r.data.jednotka}`);
    } catch (e: any) {
      Alert.alert("Chyba AI", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!client.trim() && !title.trim() && prace.length === 0 && material.length === 0 && doprava.length === 0) {
      Alert.alert("Prázdná nabídka", "Vyplňte alespoň jméno klienta, název nabídky nebo přidejte položku.");
      return;
    }
    setBusy("save");
    try {
      const r = await api.post("/jobs", {
        client_name: client,
        address,
        title,
        prace,
        material,
        doprava,
      });
      router.replace(`/zakazka/${r.data.id}`);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function discard() {
    if (!client && !address && !title && prace.length === 0 && material.length === 0 && doprava.length === 0) {
      router.back();
      return;
    }
    Alert.alert("Zahodit nabídku?", "Vyplněné údaje nebudou uloženy.", [
      { text: "Zrušit", style: "cancel" },
      { text: "Zahodit", style: "destructive", onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Nová zakázka" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Banner: not saved yet */}
          <View style={styles.banner} testID="draft-banner">
            <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
            <Text style={styles.bannerText}>
              Nabídka ještě není uložena. Vyplňte údaje a stiskněte <Text style={{ fontWeight: "800" }}>Uložit</Text>.
            </Text>
          </View>

          {/* Live summary */}
          <View style={styles.summaryCard} testID="summary-card">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sumOverline}>Návrh nabídky</Text>
              <Text style={styles.sumDate}>{fmtDateCZ(new Date())}</Text>
            </View>
            <Text style={styles.sumTitle} numberOfLines={1}>
              {title || "(bez názvu)"}
            </Text>
            <View style={styles.sumGrid}>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Práce</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.p)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Materiál</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.m)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.sumLabel}>Doprava</Text>
                <Text style={styles.sumVal}>{fmtCZK(totals.d)}</Text>
              </View>
            </View>
            <View style={styles.sumTotalRow}>
              <Text style={styles.sumTotalLabel}>CELKEM</Text>
              <Text style={styles.sumTotalVal}>{fmtCZK(totals.total)}</Text>
            </View>
          </View>

          {/* Fields */}
          <View style={styles.section}>
            <Field label="Jméno klienta" value={client} onChangeText={setClient} testID="f-client" />
            <Field label="Adresa realizace" value={address} onChangeText={setAddress} testID="f-address" />
            <Field label="Název nabídky" value={title} onChangeText={setTitle} testID="f-title" />
            <Text style={styles.helpHint}>
              Číslo nabídky se přidělí automaticky (ve formátu RRRR-NNN) při uložení.
            </Text>
          </View>

          {/* Práce */}
          <Text style={styles.sectionTitle}>Práce</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor rows={prace} onChange={setPrace} testIDPrefix="prace" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => setPrace([...prace, newRow()])} compact testID="add-prace" />
          </View>

          {/* Materiál + AI */}
          <Text style={styles.sectionTitle}>Materiál</Text>
          <View style={styles.tableWrap}>
            <View style={styles.aiSearchRow}>
              <TextInput
                value={matSearch}
                onChangeText={setMatSearch}
                placeholder="AI: zadejte materiál (např. dlažba 60×60)"
                placeholderTextColor={theme.colors.placeholder}
                style={styles.aiSearchInput}
                testID="ai-mat-input"
              />
              <TouchableOpacity onPress={searchMaterial} style={styles.aiSearchBtn} testID="ai-mat-btn" disabled={busy === "ai-mat"}>
                {busy === "ai-mat" ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
            <LineItemEditor rows={material} onChange={setMaterial} testIDPrefix="material" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => setMaterial([...material, newRow()])} compact testID="add-material" />
          </View>

          {/* Doprava */}
          <Text style={styles.sectionTitle}>Doprava, závoz a manipulace</Text>
          <View style={styles.tableWrap}>
            <LineItemEditor rows={doprava} onChange={setDoprava} testIDPrefix="doprava" />
            <PrimaryButton variant="secondary" title="+ Přidat řádek" onPress={() => setDoprava([...doprava, newRow()])} compact testID="add-doprava" />
          </View>

          <View style={{ height: 8 }} />
          <PrimaryButton title="💾 Uložit nabídku (Rozpracováno)" onPress={save} loading={busy === "save"} testID="save-draft" />
          <View style={{ height: 8 }} />
          <PrimaryButton variant="ghost" title="Zahodit a zpět" onPress={discard} testID="discard" />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 16, paddingBottom: 60 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  bannerText: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  summaryCard: {
    backgroundColor: theme.colors.text,
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
  sumDate: { color: "#bbb6ad", fontSize: 12 },
  sumTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 6 },
  sumGrid: { flexDirection: "row", gap: 8, marginTop: 14 },
  sumCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 10 },
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
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  helpHint: { color: theme.colors.textMuted, fontSize: 12, fontStyle: "italic" },
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
