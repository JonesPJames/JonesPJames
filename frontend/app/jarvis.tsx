import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { api } from "../src/api";

const JARVIS_URL = process.env.EXPO_PUBLIC_JARVIS_API_URL || "";
type Reply = { answer: string; mode: string; total?: number };

function parseJobCreation(text: string): string | null {
  const prefix = /^(?:vytvoř|založ|přidej)\s+(?:novou\s+)?zakázku\s+pro\s+(?:pana|paní|firmu)\s+/i;
  if (!prefix.test(text.trim())) return null;
  const name = text.trim().replace(prefix, "").replace(/[.!]$/, "").trim();
  return name.length >= 2 && name.length <= 120 ? name : null;
}

export default function JarvisScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  async function createJob(client: string) {
    setBusy(true);
    try {
      const result = await api.post("/jobs", { client_name: client, title: "Nová zakázka – " + client, address: "", prace: [], material: [], doprava: [] });
      setAnswer("Zakázka pro " + client + " byla vytvořena jako rozpracovaná.");
      Alert.alert("Zakázka vytvořena", "Otevřít novou zakázku?", [
        { text: "Později", style: "cancel" },
        { text: "Otevřít", onPress: () => router.push(("/zakazka/" + result.data.id) as any) },
      ]);
    } catch {
      Alert.alert("Chyba", "Vytvoření selhalo. Před opakováním zkontrolujte seznam zakázek.");
    } finally { setBusy(false); }
  }

  async function ask() {
    if (!message.trim() || busy) return;
    const newClient = parseJobCreation(message);
    if (newClient) {
      Alert.alert("Potvrzení nové zakázky", "Založit rozpracovanou zakázku pro " + newClient + "?", [
        { text: "Zrušit", style: "cancel" },
        { text: "Vytvořit", onPress: () => { void createJob(newClient); } },
      ]);
      return;
    }
    if (!JARVIS_URL.startsWith("https://")) {
      Alert.alert("JARVIS není nakonfigurován", "Pro tuto verzi aplikace zatím není dostupné bezpečné připojení.");
      return;
    }
    setBusy(true);
    try {
      // The Pro token never leaves the Pro API. JARVIS receives only a short-lived gateway token.
      const exchanged = await api.post("/integrations/jarvis/token", {});
      const gatewayToken = exchanged.data.access_token as string;
      if (!gatewayToken) throw new Error("Chybí přístupový token JARVIS");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(JARVIS_URL.replace(/\/$/, "") + "/api/v1/jarvis/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + gatewayToken },
          body: JSON.stringify({ message: message.trim() }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("JARVIS není dostupný (" + response.status + ")");
        const data = await response.json() as Reply;
        setAnswer(data.answer || "Nepodařilo se získat odpověď.");
        setConnected(true);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      setConnected(false);
      Alert.alert("Připojení JARVIS", error instanceof Error ? error.message : "Nepodařilo se připojit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹ Zpět</Text></TouchableOpacity>
        <Text style={styles.title}>JARVIS AI</Text>
        <Text style={styles.sub}>Asistent Řemeslník Pro</Text>
        <Text style={styles.status}>{connected ? "Připojeno k zakázkám" : "Připojení se ověří při dotazu"}</Text>
        <Text style={styles.label}>Na co se chcete zeptat?</Text>
        <TextInput style={styles.input} value={message} onChangeText={setMessage} multiline
          placeholder="Například: Kolik mám zakázek?" maxLength={1000} editable={!busy} />
        <TouchableOpacity onPress={ask} disabled={busy || !message.trim()} style={[styles.button, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Odeslat dotaz</Text>}
        </TouchableOpacity>
        {answer ? <View style={styles.answer}><Text style={styles.label}>Odpověď JARVIS</Text><Text style={styles.answerText}>{answer}</Text></View> : null}
        <Text style={styles.note}>Příkaz k vytvoření zakázky vyžaduje potvrzení. Ostatní dotazy pouze čtou ověřená data.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f1eb" },
  content: { padding: 22, paddingBottom: 60, gap: 14 },
  back: { fontSize: 17, color: "#008bc8" },
  title: { fontSize: 32, fontWeight: "800", color: "#182333" },
  sub: { fontSize: 17, color: "#008bc8" },
  status: { color: "#526176", marginBottom: 12 },
  label: { fontSize: 16, fontWeight: "700", color: "#182333" },
  input: { minHeight: 100, borderWidth: 1, borderColor: "#bbc4cf", borderRadius: 12, padding: 14, backgroundColor: "#fff", textAlignVertical: "top", fontSize: 16 },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#00aeef", alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  answer: { backgroundColor: "#fff", padding: 18, borderRadius: 12, gap: 10 },
  answerText: { color: "#182333", fontSize: 16, lineHeight: 24 },
  note: { color: "#667184", fontSize: 13, marginTop: 14 },
});
