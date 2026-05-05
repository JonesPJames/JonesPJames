import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../src/components/AppFooter";
import { AppHeader } from "../src/components/AppHeader";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/theme";
import { api, getApiErrorMessage } from "../src/api";
import { setPrefill } from "../src/prefill";

const SAMPLE = `{
  "cinnost": "Obklad koupelny",
  "parametry": "12 m2 keramický obklad 25x40",
  "material": [
    { "nazev": "Keramický obklad 25x40", "mnozstvi": 12, "jednotka": "m2", "cena": 480 },
    { "nazev": "Lepidlo flexibilní", "mnozstvi": 3, "jednotka": "ks", "cena": 320 }
  ],
  "pracovni_postup": [
    { "krok": "Penetrace", "hodiny": 2, "cena_hodina": 350 },
    { "krok": "Lepení obkladu", "hodiny": 16, "cena_hodina": 450 },
    { "krok": "Spárování", "hodiny": 4, "cena_hodina": 400 }
  ],
  "cas_hodiny": 22
}`;

export default function ImportScreen() {
  const router = useRouter();
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);

  async function onImport() {
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e: any) {
      Alert.alert("Neplatný JSON", e.message);
      return;
    }
    setBusy(true);
    try {
      const r = await api.post("/import/remeslnik-ai", json);
      setPrefill({
        title: r.data.title,
        prace: r.data.prace,
        material: r.data.material,
        description: r.data.description,
      });
      router.replace("/nova-zakazka");
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Import z Řemeslník AI" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Vložte JSON podklad ve formátu <Text style={styles.code}>{`{ cinnost, parametry, material[], pracovni_postup[], cas_hodiny }`}</Text>.
            Po importu se předvyplní tabulky Materiál a Práce v nové zakázce.
          </Text>
          <View style={styles.card}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Vložte JSON…"
              placeholderTextColor={theme.colors.placeholder}
              style={styles.textarea}
              testID="import-json"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <PrimaryButton title="Importovat a vytvořit zakázku" onPress={onImport} loading={busy} testID="import-btn" />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  intro: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    fontSize: 11,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textarea: {
    minHeight: 280,
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlignVertical: "top",
  },
});
