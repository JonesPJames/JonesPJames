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
});
