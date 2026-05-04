import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { theme } from "../src/theme";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { getApiErrorMessage } from "../src/api";

type Mode = "owner" | "employee";

export default function Login() {
  const { login, loginEmployee } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    setBusy(true);
    try {
      if (mode === "owner") {
        await login(email.trim(), password);
        router.replace("/home");
      } else {
        await loginEmployee(pin);
        router.replace("/employee");
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <View style={styles.logo}>
              <Ionicons name="hammer" size={36} color="#fff" />
            </View>
            <Text style={styles.brand}>Řemeslník Pro</Text>
            <Text style={styles.tagline}>Nabídky, deníky, vyúčtování — vše v kapse.</Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "owner" && styles.tabActive]}
              onPress={() => setMode("owner")}
              testID="tab-owner"
            >
              <Ionicons name="person" size={18} color={mode === "owner" ? "#fff" : theme.colors.text} />
              <Text style={[styles.tabText, mode === "owner" && { color: "#fff" }]}>Vlastník</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "employee" && styles.tabActive]}
              onPress={() => setMode("employee")}
              testID="tab-employee"
            >
              <Ionicons name="people" size={18} color={mode === "employee" ? "#fff" : theme.colors.text} />
              <Text style={[styles.tabText, mode === "employee" && { color: "#fff" }]}>Zaměstnanec</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {mode === "owner" ? (
              <>
                <Text style={styles.h2}>Vítejte zpět</Text>
                <Text style={styles.muted}>Přihlaste se ke svému účtu</Text>
                <View style={{ height: 16 }} />
                <Field
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="vas@email.cz"
                  testID="login-email"
                />
                <Field
                  label="Heslo"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  testID="login-password"
                />
              </>
            ) : (
              <>
                <Text style={styles.h2}>Přihlášení zaměstnance</Text>
                <Text style={styles.muted}>Zadejte 4místný PIN, který vám předal vlastník</Text>
                <View style={{ height: 16 }} />
                <Text style={styles.pinLabel}>PIN</Text>
                <TextInput
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={theme.colors.placeholder}
                  style={styles.pinInput}
                  testID="login-pin"
                />
              </>
            )}
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <PrimaryButton title="Přihlásit se" onPress={onSubmit} loading={busy} testID="login-submit" />
            {mode === "owner" ? (
              <>
                <View style={{ height: 12 }} />
                <TouchableOpacity onPress={() => router.push("/register")} testID="goto-register">
                  <Text style={styles.altText}>
                    Nemáte účet?{" "}
                    <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Zaregistrovat se</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  brandWrap: { alignItems: "center", marginTop: 24, marginBottom: 24 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brand: { fontSize: 26, fontWeight: "800", color: theme.colors.text },
  tagline: { fontSize: 14, color: theme.colors.textMuted, marginTop: 6, textAlign: "center", paddingHorizontal: 30 },
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: "700" },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  h2: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  muted: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  pinLabel: { fontSize: 13, color: theme.colors.textMuted, fontWeight: "600", marginBottom: 6 },
  pinInput: {
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontWeight: "800",
    marginBottom: 14,
  },
  altText: { textAlign: "center", color: theme.colors.textMuted, fontSize: 14 },
  err: {
    color: theme.colors.danger,
    fontSize: 13,
    marginBottom: 10,
    backgroundColor: "#f9e6e3",
    padding: 10,
    borderRadius: 10,
  },
});
