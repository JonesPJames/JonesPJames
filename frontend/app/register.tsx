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
import { useAuth } from "../src/auth";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/theme";
import { getApiErrorMessage } from "../src/api";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [showIco, setShowIco] = useState(false);
  const [showDic, setShowDic] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    if (!email || !password || !name) {
      Alert.alert("Chyba", "Jméno, e-mail a heslo jsou povinné údaje.");
      return;
    }
    setBusy(true);
    try {
      // Tady posíláme komplet všechno, včetně stavů pro PDF přepínače
      await register(email, password, name, company, phone, ico, dic);
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Chyba při registraci", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, justifyContent: "center", flexGrow: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Vytvořit účet</Text>
            <Text style={styles.subtitle}>Začněte spravovat své zakázky profesionálně</Text>
          </View>

          <View style={styles.card}>
            <Field label="Jméno a příjmení" value={name} onChangeText={setName} testID="r-name" />
            <Field label="Název firmy" value={company} onChangeText={setCompany} testID="r-company" />
            <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="r-phone" />
            
            <Field label="IČO" value={ico} onChangeText={setIco} keyboardType="number-pad" testID="r-ico" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Zobrazovat IČO na PDF</Text>
              <Switch
                value={showIco}
                onValueChange={setShowIco}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <Field label="DIČ" value={dic} onChangeText={setDic} testID="r-dic" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Zobrazovat DIČ na PDF</Text>
              <Switch
                value={showDic}
                onValueChange={setShowDic}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="r-email" />
            <Field label="Heslo" value={password} onChangeText={setPassword} secureTextEntry testID="r-password" />
            
            <View style={{ height: 14 }} />
            <PrimaryButton title="Zaregistrovat se" onPress={onRegister} loading={busy} testID="r-submit" />
          </View>

          <PrimaryButton variant="ghost" title="Již mám účet — Přihlásit se" onPress={() => router.replace("/login")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { alignItems: "center", marginBottom: 24, marginTop: 20 },
  title: { fontSize: 28, fontWeight: "900", color: theme.colors.text, textAlign: "center" },
  subtitle: { fontSize: 15, color: theme.colors.textMuted, textAlign: "center", marginTop: 6, paddingHorizontal: 20 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});

