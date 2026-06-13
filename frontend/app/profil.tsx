import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
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
  const [ico, setIco] = useState(user?.ico || "");
  const [dic, setDic] = useState(user?.dic || "");
  const [showIco, setShowIco] = useState(user?.show_ico ?? false);
  const [showDic, setShowDic] = useState(user?.show_dic ?? false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateProfile({ 
        name, 
        company, 
        phone, 
        ico, 
        dic, 
        show_ico: showIco, 
        show_dic: showDic 
      });
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
            
            <Field label="IČO" value={ico} onChangeText={setIco} keyboardType="number-pad" testID="p-ico" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Zobrazovat IČO na PDF dokumentech</Text>
              <Switch
                value={showIco}
                onValueChange={setShowIco}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <Field label="DIČ" value={dic} onChangeText={setDic} testID="p-dic" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Zobrazovat DIČ na PDF dokumentech</Text>
              <Switch
                value={showDic}
                onValueChange={setShowDic}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={{ height: 14 }} />
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "between",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
});
