import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../src/components/AppFooter";
import { AppHeader } from "../src/components/AppHeader";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/theme";
import { api, getApiErrorMessage } from "../src/api";
import { TRADES } from "../src/trades";

type Employee = { id: string; name: string; phone: string; pin: string; active: boolean; trade?: string };

export default function ZamestnanciScreen() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get("/employees");
      setItems(r.data);
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return Alert.alert("Zadejte jméno");
    setBusy(true);
    try {
      await api.post("/employees", { name: name.trim(), phone: phone.trim(), trade });
      setName("");
      setPhone("");
      setTrade("");
      setShowAdd(false);
      await load();
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(emp: Employee) {
    Alert.alert("Smazat zaměstnance?", `${emp.name} (${emp.id})`, [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Smazat",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/employees/${emp.id}`);
            await load();
          } catch (e: any) {
            Alert.alert("Chyba", getApiErrorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Zaměstnanci" back />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Zaměstnanci se přihlašují svým 4místným PIN. Mohou vidět pouze přiřazené zakázky bez cen.
        </Text>

        {loading ? null : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Žádní zaměstnanci</Text>
            <Text style={styles.emptySub}>Přidejte prvního pomocí tlačítka níže.</Text>
          </View>
        ) : (
          items.map((e) => (
            <View key={e.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(e.name || "?").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.empName}>{e.name}</Text>
                  <Text style={styles.empMeta}>
                    {e.id} {e.phone ? `• ${e.phone}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(e)} hitSlop={10} testID={`del-${e.id}`}>
                  <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={styles.pinBadge}>
                <Text style={styles.pinLabel}>PIN</Text>
                <Text style={styles.pinValue}>{e.pin}</Text>
              </View>
            </View>
          ))
        )}

        <PrimaryButton title="+ Přidat zaměstnance" onPress={() => setShowAdd(true)} testID="add-emp" />
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Nový zaměstnanec</Text>
              <Field label="Jméno a příjmení" value={name} onChangeText={setName} testID="emp-name" />
              <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="emp-phone" />
              <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>Profese (určuje výchozí nářadí)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {TRADES.map((t) => {
                  const active = trade === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setTrade(t.key)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      }}
                      testID={`emp-trade-${t.key}`}
                    >
                      <Text style={{ color: active ? "#fff" : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <PrimaryButton title="Vytvořit (PIN se vygeneruje)" onPress={add} loading={busy} testID="emp-save" />
              <View style={{ height: 8 }} />
              <PrimaryButton variant="ghost" title="Zrušit" onPress={() => setShowAdd(false)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <AppFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 16, paddingBottom: 60 },
  intro: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  empName: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  empMeta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  pinLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: "700", letterSpacing: 1.4 },
  pinValue: { fontSize: 22, fontWeight: "800", letterSpacing: 6, color: theme.colors.text },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 8 },
  emptySub: { color: theme.colors.textMuted, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: 14 },
});
