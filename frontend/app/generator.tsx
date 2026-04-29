import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../src/components/AppHeader";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme, fmtCZK } from "../src/theme";
import { api, getApiErrorMessage, pdfUrl } from "../src/api";

const NAROCNOST = [
  { key: "nizka", label: "Nízká" },
  { key: "stredni", label: "Střední" },
  { key: "vysoka", label: "Vysoká" },
];
const URGENCE = [
  { key: "bezna", label: "Běžná" },
  { key: "zvysena", label: "Zvýšená" },
  { key: "expresni", label: "Expresní" },
];
const KLIENT = [
  { key: "bezny", label: "Běžný" },
  { key: "firemni", label: "Firemní" },
  { key: "vip", label: "VIP" },
];

const ICONS = ["🥉", "🥇", "💎"];
const VARIANT_COLORS = ["#a37852", "#c9820a", "#1f3a5f"];

export default function Generator() {
  const [form, setForm] = useState({
    title: "",
    client: "",
    address: "",
    cena_material: "",
    cena_prace: "",
    cena_doprava: "",
    description: "",
    narocnost: "stredni",
    urgence: "bezna",
    typ_klienta: "bezny",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [bundle, setBundle] = useState<any>(null);

  function set(k: keyof typeof form, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function aiEnhance() {
    if (!form.description.trim()) return Alert.alert("Vyplňte popis");
    setBusy("ai-enhance");
    try {
      const r = await api.post("/ai/enhance-description", { text: form.description });
      set("description", r.data.text);
    } catch (e: any) {
      Alert.alert("Chyba AI", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!form.title.trim()) return Alert.alert("Vyplňte název zakázky");
    setBusy("generate");
    try {
      const payload = {
        ...form,
        cena_material: parseFloat(form.cena_material) || 0,
        cena_prace: parseFloat(form.cena_prace) || 0,
        cena_doprava: parseFloat(form.cena_doprava) || 0,
      };
      const r = await api.post("/ai/generate-variants", payload);
      setBundle(r.data);
    } catch (e: any) {
      Alert.alert("Chyba AI", getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!bundle?.id) return;
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const token = await AsyncStorage.getItem("rp_token");
    Linking.openURL(`${pdfUrl(`/api/quote-variants/${bundle.id}/pdf`)}?token=${token || ""}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Generátor nabídek" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Field label="Název zakázky" value={form.title} onChangeText={(v) => set("title", v)} testID="g-title" />
            <Field label="Klient" value={form.client} onChangeText={(v) => set("client", v)} testID="g-client" />
            <Field label="Adresa" value={form.address} onChangeText={(v) => set("address", v)} testID="g-address" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field label="Cena materiálu (Kč)" value={form.cena_material} onChangeText={(v) => set("cena_material", v)} keyboardType="numeric" testID="g-material" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Cena práce (Kč)" value={form.cena_prace} onChangeText={(v) => set("cena_prace", v)} keyboardType="numeric" testID="g-prace" />
              </View>
            </View>
            <Field label="Doprava (Kč)" value={form.cena_doprava} onChangeText={(v) => set("cena_doprava", v)} keyboardType="numeric" testID="g-doprava" />

            <Field
              label="Přesné zadání zakázky"
              value={form.description}
              onChangeText={(v) => set("description", v)}
              multiline
              style={{ minHeight: 100, textAlignVertical: "top" } as any}
              testID="g-desc"
            />
            <PrimaryButton
              variant="secondary"
              compact
              title={busy === "ai-enhance" ? "AI vylepšuje..." : "✨ AI popis"}
              onPress={aiEnhance}
              loading={busy === "ai-enhance"}
              testID="g-ai-enhance"
            />

            <View style={{ height: 12 }} />
            <ChipGroup label="Náročnost" options={NAROCNOST} value={form.narocnost} onChange={(v) => set("narocnost", v)} testIDPrefix="narocnost" />
            <ChipGroup label="Urgence termínu" options={URGENCE} value={form.urgence} onChange={(v) => set("urgence", v)} testIDPrefix="urgence" />
            <ChipGroup label="Typ klienta" options={KLIENT} value={form.typ_klienta} onChange={(v) => set("typ_klienta", v)} testIDPrefix="klient" />
          </View>

          <PrimaryButton
            title="Vygenerovat 3 varianty"
            onPress={generate}
            loading={busy === "generate"}
            testID="generate-btn"
          />

          {bundle?.variants ? (
            <View style={{ marginTop: 18 }}>
              {bundle.variants.map((v: any, i: number) => (
                <View key={i} style={[styles.variant, { borderColor: VARIANT_COLORS[i] }]} testID={`variant-${i}`}>
                  <View style={[styles.variantHeader, { backgroundColor: VARIANT_COLORS[i] }]}>
                    <Text style={styles.variantIcon}>{ICONS[i]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.variantName}>{v.nazev}</Text>
                      <Text style={styles.variantPrice}>{fmtCZK(v.cena_kc || 0)}</Text>
                    </View>
                  </View>
                  <View style={{ padding: 14 }}>
                    {v.popis ? <Text style={styles.popis}>{v.popis}</Text> : null}
                    <View style={styles.metaRow}>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Záruka</Text>
                        <Text style={styles.metaVal}>{v.zaruka || "—"}</Text>
                      </View>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Termín</Text>
                        <Text style={styles.metaVal}>{v.termin || "—"}</Text>
                      </View>
                    </View>
                    {v.rozsah ? (
                      <>
                        <Text style={styles.subTitle}>Rozsah</Text>
                        <Text style={styles.rozsah}>{v.rozsah}</Text>
                      </>
                    ) : null}
                    {Array.isArray(v.included) && v.included.length ? (
                      <>
                        <Text style={styles.subTitle}>Zahrnuto</Text>
                        {v.included.map((it: string, k: number) => (
                          <Text key={k} style={styles.bullet}>✓ {it}</Text>
                        ))}
                      </>
                    ) : null}
                    {Array.isArray(v.excluded) && v.excluded.length ? (
                      <>
                        <Text style={styles.subTitle}>Není zahrnuto</Text>
                        {v.excluded.map((it: string, k: number) => (
                          <Text key={k} style={[styles.bullet, { color: theme.colors.danger }]}>✗ {it}</Text>
                        ))}
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
              <PrimaryButton title="📄 Stáhnout PDF (všechny varianty)" onPress={downloadPdf} testID="variants-pdf" />
            </View>
          ) : null}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => onChange(o.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`${testIDPrefix}-${o.key}`}
            >
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  chipLabel: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 6, fontWeight: "600" },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flex: 1,
    alignItems: "center",
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  variant: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    marginBottom: 12,
    borderWidth: 2,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  variantHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  variantIcon: { fontSize: 28 },
  variantName: { color: "#fff", fontSize: 17, fontWeight: "800" },
  variantPrice: { color: "#fff", fontSize: 22, fontWeight: "800" },
  popis: { color: theme.colors.text, fontSize: 14, marginBottom: 10 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaCell: { flex: 1, backgroundColor: theme.colors.primaryLight, borderRadius: 10, padding: 10 },
  metaLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: "700", marginBottom: 2 },
  metaVal: { color: theme.colors.text, fontWeight: "800" },
  subTitle: { color: theme.colors.primary, fontWeight: "800", marginTop: 8, marginBottom: 4, fontSize: 13 },
  rozsah: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  bullet: { color: theme.colors.text, fontSize: 13, paddingVertical: 2 },
});
