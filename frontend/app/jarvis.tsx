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

type ClientDraft = { first_name: string; last_name: string; city: string };

function parseClientCreation(text: string): ClientDraft | null {
  const match = text.trim().match(/^(?:založ|vytvoř|přidej)\s+(?:nového\s+|novou\s+)?klienta?\s*[.:,-]?\s*(.+)$/i);
  if (!match) return null;
  const parts = match[1].split(",").map(x => x.trim()).filter(Boolean);
  const name = (parts.shift() || "").replace(/^(?:pana|paní|pan|paního)\s+/i, "").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length !== 2) return null;
  const honorific = /^(?:pana|paní|pan)\s+/i.test(match[1]);
  let first_name = honorific ? words[0] : words[1];
  let last_name = honorific ? words[1] : words[0];
  // Only unambiguous, explicitly supported Czech inflections are normalized.
  if (honorific && first_name.toLocaleLowerCase("cs") === "jiřího") first_name = "Jiří";
  if (honorific && last_name.toLocaleLowerCase("cs") === "bočka") last_name = "Boček";
  return { first_name, last_name, city: parts.join(", ") };
}

function findName(query: string, value: string): boolean {
  const clean = (v: string) => v.toLocaleLowerCase("cs").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
  const q = clean(query).replace(/^(pana|pani|pan)\s+/, "").trim();
  const tokens = clean(value).split(/\s+/).filter(Boolean);
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  return terms.every(term => tokens.some(token => token === term || (term.length >= 5 && token.length >= 5 && term.slice(0, 4) === token.slice(0, 4))));
}

export default function JarvisScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastClientId, setLastClientId] = useState<string | null>(null);
  const [lastJob, setLastJob] = useState<{ id: string; client_name: string; title: string } | null>(null);

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

  async function createClient(client: ClientDraft) {
    setBusy(true);
    try {
      const result = await api.post("/clients", client);
      setLastClientId(result.data.id || null);
      setAnswer("Klient " + client.first_name + " " + client.last_name + " byl založen." +
        (client.city ? " Obec: " + client.city + "." : ""));
    } catch {
      Alert.alert("Chyba", "Založení klienta selhalo. Před opakováním ověřte seznam klientů.");
    } finally { setBusy(false); }
  }

  async function openByName(name: string) {
    setBusy(true);
    try {
      const response = await api.get("/jobs");
      const jobs = Array.isArray(response.data) ? response.data : response.data.jobs || [];
      const found = jobs.filter((job: any) => findName(name, job.client_name || ""));
      if (found.length === 1) {
        setLastJob({ id: found[0].id, client_name: found[0].client_name || "", title: found[0].title || "" });
        router.push(("/zakazka/" + found[0].id) as any);
        setAnswer("Otevírám zakázku pro " + found[0].client_name);
      } else if (found.length > 1) {
        setAnswer("Našel jsem více zakázek: " + found.map((j: any) => j.title || j.client_name).join("; ") + ". Upřesni výběr.");
      } else {
        setAnswer("Nenašel jsem odpovídající zakázku pro " + name + ".");
      }
    } catch {
      setAnswer("Vyhledání zakázky se nezdařilo.");
    } finally { setBusy(false); }
  }

  async function ask() {
    if (!message.trim() || busy) return;
    if (lastJob && /^(?:otevři|ukaž|zobraz)(?:\s+mi)?\s+(?:ji|ho|to|tu zakázku|poslední zakázku)[.!?]?$/i.test(message.trim())) {
      router.push(("/zakazka/" + lastJob.id) as any);
      setAnswer("Otevírám " + (lastJob.title || lastJob.client_name) + ".");
      return;
    }
    const open = message.trim().match(/^(?:otevři|najdi|ukaž|zobraz)(?:\s+mi)?\s+(?:(?:zakázku|pana|paní|u)\s+)*(.+)$/i);
    if (open) { await openByName(open[1]); return; }
    const client = parseClientCreation(message);
    if (client && /(?:ho|mu|ovi)$/i.test(client.first_name) && /(?:a|u|e)$/i.test(client.last_name)) {
      Alert.alert("Upřesnění jména", "Jméno je pravděpodobně ve skloňovaném tvaru. Pro bezpečné založení zadejte jméno a příjmení v 1. pádě. Klient nebyl vytvořen.");
      return;
    }
    if (client) {
      Alert.alert("Založit klienta?", client.first_name + " " + client.last_name +
        (client.city ? "\nObec: " + client.city : ""), [
        { text: "Zrušit", style: "cancel" },
        { text: "Potvrdit", onPress: () => { void createClient(client); } },
      ]);
      return;
    }
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
          placeholder="Například: Otevři zakázku nebo najdi klienta" maxLength={1000} editable={!busy} />
        <TouchableOpacity onPress={ask} disabled={busy || !message.trim()} style={[styles.button, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Odeslat dotaz</Text>}
        </TouchableOpacity>
        {answer ? <View style={styles.answer}><Text style={styles.label}>Odpověď JARVIS</Text><Text style={styles.answerText}>{answer}</Text></View> : null}
        {lastClientId ? <TouchableOpacity style={styles.button} accessibilityRole="button"
          onPress={() => router.push({ pathname: "/klient/[id]", params: { id: lastClientId } })}>
          <Text style={styles.buttonText}>Otevřít kartu založeného klienta</Text>
        </TouchableOpacity> : null}
        <TouchableOpacity onPress={() => router.push("/klienti")} accessibilityRole="button">
          <Text style={styles.back}>Adresář klientů A–Z</Text>
        </TouchableOpacity>
        <Text style={styles.note}>Založení klienta a zakázky vyžaduje potvrzení. Ostatní dotazy pouze čtou ověřená data.</Text>
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
