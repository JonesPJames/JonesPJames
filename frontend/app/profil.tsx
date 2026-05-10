import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFooter } from "../src/components/AppFooter";
import { useAuth } from "../src/auth";
import { AppHeader } from "../src/components/AppHeader";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/theme";
import { getApiErrorMessage } from "../src/api";

export default function Profil() {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [company, setCompany] = useState(user?.company || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateProfile({ name, company, phone });
      Alert.alert("Hotovo", "Profil byl aktualizován");
    } catch (e: any) {
      Alert.alert("Chyba", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader title="Můj profil" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.company_code ? (
              <View style={styles.codeStrip}>
                <Text style={styles.codeStripLabel}>Identifikátor firmy</Text>
                <Text style={styles.codeStripValue} selectable>{user.company_code}</Text>
              </View>
            ) : null}
            <View style={{ height: 14 }} />
            <Field label="Jméno a příjmení" value={name} onChangeText={setName} testID="p-name" />
            <Field label="Název firmy" value={company} onChangeText={setCompany} testID="p-company" />
            <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="p-phone" />
            <PrimaryButton title="Uložit změny" onPress={save} loading={busy} testID="p-save" />
          </View>
          <PrimaryButton variant="ghost" title="Odhlásit se" onPress={onLogout} testID="p-logout" />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppFooter />
    </SafeAreaView>
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
  email: { color: theme.colors.textMuted, fontSize: 14, fontStyle: "italic" },
  codeStrip: {
    marginTop: 10,
    padding: 12,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  codeStripLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: "700", letterSpacing: 1.4 },
  codeStripValue: { fontSize: 22, fontWeight: "900", letterSpacing: 6, color: theme.colors.text, marginTop: 2 },
});
