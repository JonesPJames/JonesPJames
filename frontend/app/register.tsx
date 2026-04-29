import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { theme } from "../src/theme";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { getApiErrorMessage } from "../src/api";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    if (!name.trim()) return setError("Zadejte jméno");
    if (!email.trim()) return setError("Zadejte e-mail");
    if (password.length < 4) return setError("Heslo musí mít alespoň 4 znaky");
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim(), company.trim(), phone.trim());
      router.replace("/home");
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
            <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.brandWrap}>
            <View style={styles.logo}>
              <Ionicons name="person-add" size={28} color="#fff" />
            </View>
            <Text style={styles.brand}>Vytvořit účet</Text>
            <Text style={styles.tagline}>Začněte spravovat své zakázky profesionálně</Text>
          </View>

          <View style={styles.card}>
            <Field label="Jméno a příjmení" value={name} onChangeText={setName} placeholder="Jan Novák" testID="reg-name" />
            <Field label="Název firmy" value={company} onChangeText={setCompany} placeholder="Stavby Novák s.r.o." testID="reg-company" />
            <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+420 777 123 456" testID="reg-phone" />
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="vas@email.cz"
              testID="reg-email"
            />
            <Field label="Heslo" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" testID="reg-password" />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <PrimaryButton
              title="Zaregistrovat se"
              onPress={onSubmit}
              loading={busy}
              testID="reg-submit"
            />
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => router.replace("/login")} testID="goto-login">
              <Text style={styles.altText}>
                Již máte účet?{" "}
                <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Přihlásit se</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: "center" },
  brandWrap: { alignItems: "center", marginTop: 8, marginBottom: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...theme.shadow.floating,
  },
  brand: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
  tagline: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
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
