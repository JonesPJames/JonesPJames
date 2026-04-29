import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, fmtCZK } from "../theme";

export type LineItem = {
  id: string;
  popis: string;
  mnozstvi: number;
  jednotka: string;
  cena: number;
};

export function newRow(): LineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    popis: "",
    mnozstvi: 1,
    jednotka: "ks",
    cena: 0,
  };
}

export function LineItemEditor({
  rows,
  onChange,
  testIDPrefix,
}: {
  rows: LineItem[];
  onChange: (rows: LineItem[]) => void;
  testIDPrefix: string;
}) {
  const update = (i: number, key: keyof LineItem, val: string) => {
    const copy = rows.slice();
    if (key === "mnozstvi" || key === "cena") {
      const num = parseFloat(val.replace(",", ".")) || 0;
      copy[i] = { ...copy[i], [key]: num } as LineItem;
    } else {
      copy[i] = { ...copy[i], [key]: val } as LineItem;
    }
    onChange(copy);
  };

  const remove = (i: number) => {
    const copy = rows.slice();
    copy.splice(i, 1);
    onChange(copy);
  };

  const total = rows.reduce((s, r) => s + (r.mnozstvi || 0) * (r.cena || 0), 0);

  return (
    <View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Žádné položky. Přidejte první řádek tlačítkem níže.</Text>
      ) : null}
      {rows.map((r, i) => (
        <View key={r.id} style={styles.row} testID={`${testIDPrefix}-row-${i}`}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowIdx}>#{i + 1}</Text>
            <TouchableOpacity onPress={() => remove(i)} testID={`${testIDPrefix}-remove-${i}`} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={r.popis}
            onChangeText={(t) => update(i, "popis", t)}
            placeholder="Popis položky"
            placeholderTextColor={theme.colors.placeholder}
            style={styles.popis}
            testID={`${testIDPrefix}-popis-${i}`}
          />
          <View style={styles.gridLine}>
            <View style={[styles.cell, { flex: 1.1 }]}>
              <Text style={styles.cellLabel}>Množství</Text>
              <TextInput
                value={String(r.mnozstvi)}
                onChangeText={(t) => update(i, "mnozstvi", t)}
                keyboardType="numeric"
                style={styles.cellInput}
                testID={`${testIDPrefix}-mn-${i}`}
              />
            </View>
            <View style={[styles.cell, { flex: 1 }]}>
              <Text style={styles.cellLabel}>Jednotka</Text>
              <TextInput
                value={r.jednotka}
                onChangeText={(t) => update(i, "jednotka", t)}
                style={styles.cellInput}
                testID={`${testIDPrefix}-jed-${i}`}
              />
            </View>
            <View style={[styles.cell, { flex: 1.4 }]}>
              <Text style={styles.cellLabel}>Cena/jedn.</Text>
              <TextInput
                value={String(r.cena)}
                onChangeText={(t) => update(i, "cena", t)}
                keyboardType="numeric"
                style={styles.cellInput}
                testID={`${testIDPrefix}-cena-${i}`}
              />
            </View>
          </View>
          <Text style={styles.lineTotal}>Celkem: {fmtCZK((r.mnozstvi || 0) * (r.cena || 0))}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Mezisoučet</Text>
        <Text style={styles.totalVal}>{fmtCZK(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: theme.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 12,
  },
  row: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.input,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rowIdx: { color: theme.colors.primary, fontWeight: "700" },
  popis: {
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 8,
  },
  gridLine: { flexDirection: "row", gap: 8 },
  cell: {},
  cellLabel: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 4, fontWeight: "600" },
  cellInput: {
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text,
  },
  lineTotal: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "700",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
  },
  totalLabel: { color: theme.colors.textMuted, fontWeight: "700" },
  totalVal: { color: theme.colors.primary, fontWeight: "800", fontSize: 16 },
});
