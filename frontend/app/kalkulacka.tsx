import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../src/components/AppHeader";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { LineItemEditor, newRow, LineItem } from "../src/components/LineItemEditor";
import { TRADES, Trade } from "../src/trades";
import { theme, fmtCZK } from "../src/theme";
import { setPrefill } from "../src/prefill";

export default function Kalkulacka() {
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [rows, setRows] = useState<LineItem[]>([]);

  function pickTrade(t: Trade) {
    setTrade(t);
    setRows(
      t.items.map((it, i) => ({
        id: `${Date.now()}-${i}`,
        popis: it.popis,
        mnozstvi: 0,
        jednotka: it.jednotka,
        cena: it.cena,
      }))
    );
  }

  const total = useMemo(() => rows.reduce((s, r) => s + (r.mnozstvi || 0) * (r.cena || 0), 0), [rows]);

  function exportToNova() {
    const filled = rows.filter((r) => (r.mnozstvi || 0) > 0);
    if (filled.length === 0) {
      Alert.alert("Žádné položky", "Vyplňte alespoň jednu položku s množstvím.");
      return;
    }
    setPrefill({
      title: trade ? `${trade.name} — kalkulace` : "Kalkulace",
      prace: filled,
    });
    router.push("/nova-zakazka");
  }

  if (!trade) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <AppHeader title="Kalkulačka prací" back />
        <ScrollView contentContainerStyle={styles.tradeGrid}>
          <Text style={styles.intro}>Vyberte profesi pro načtení předpřipravených cen:</Text>
          <View style={styles.grid}>
            {TRADES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={styles.tradeTile}
                onPress={() => pickTrade(t)}
                testID={`trade-${t.key}`}
                activeOpacity={0.85}
              >
                <View style={styles.tradeIcon}>
                  <Ionicons name={t.icon as any} size={26} color={theme.colors.primary} />
                </View>
                <Text style={styles.tradeName}>{t.name}</Text>
                <Text style={styles.tradeSub}>{t.items.length} položek</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title={`Kalkulačka • ${trade.name}`} back />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setTrade(null)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }} testID="change-trade">
          <Ionicons name="swap-horizontal" size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.primary, fontWeight: "700", marginLeft: 6 }}>Změnit profesi</Text>
        </TouchableOpacity>
        <View style={styles.calcCard}>
          <LineItemEditor rows={rows} onChange={setRows} testIDPrefix="calc" />
          <PrimaryButton variant="secondary" title="+ Přidat vlastní řádek" onPress={() => setRows([...rows, newRow()])} compact testID="add-custom" />
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>CELKEM</Text>
          <Text style={styles.totalVal}>{fmtCZK(total)}</Text>
        </View>
        <PrimaryButton title="Vytvořit nabídku z kalkulace" onPress={exportToNova} testID="export-to-nova" />
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  tradeGrid: { padding: 16 },
  intro: { color: theme.colors.textMuted, fontSize: 14, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tradeTile: {
    width: "48.5%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 120,
    ...theme.shadow.card,
  },
  tradeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tradeName: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  tradeSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  calcCard: {
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
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  totalLabel: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1.2 },
  totalVal: { color: "#fff", fontWeight: "800", fontSize: 24 },
});
