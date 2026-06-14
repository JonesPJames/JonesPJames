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
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { theme } from "../src/theme";
import { getApiErrorMessage } from "../src/api";
import { Ionicons } from "@expo/vector-icons"; // Výchozí ikony v Expu

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
  const [hidePassword, setHidePassword] = useState(true); // Stav pro očko
  const [busy, setBusy] = useState(false);

  // Funkce pro kontrolu síly hesla
  function isPasswordStrong(pass: string) {
    const hasMinLength = pass.length >= 8;
    const hasNumber = /\d/.test(pass);
    const hasUpperCase = /[A-Z]/.test(pass);
    return {
      isValid: hasMinLength && hasNumber && hasUpperCase,
      hasMinLength,
      hasNumber,
      hasUpperCase
    };
  }

  const passwordStatus = isPasswordStrong(password);

  async function onRegister() {
    if (!email || !password || !name) {
      Alert.alert("Chyba", "Jméno, e-mail a heslo jsou povinné údaje.");
      return;
    }

    if (!passwordStatus.isValid) {
      Alert.alert("Slabé heslo", "Heslo nesplňuje bezpečnostní požadavky.");
      return;
    }

    setBusy(true);
    try {
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
            
            {/* Vlastní pole pro Heslo s Očkem */}
            <View style={styles.passwordContainer}>
              <Text style={styles.passwordLabel}>Heslo</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={hidePassword}
                  autoCapitalize="none"
                  testID="r-password"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setHidePassword(!hidePassword)}>
                  <Ionicons 
                    name={hidePassword ? "eye-off-outline" : "eye-outline"} 
                    size={22} 
                    color={theme.colors.textMuted} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dynamická nápověda pro silné heslo */}
            {password.length > 0 && (
              <View style={styles.validationBox}>
                <Text style={[styles.valText, passwordStatus.hasMinLength ? styles.valOk : styles.valErr]}>
                  {passwordStatus.hasMinLength ? "✓" : "✗"} Minimálně 8 znaků
                </Text>
                <Text style={[styles.valText, passwordStatus.hasUpperCase ? styles.valOk : styles.valErr]}>
                  {passwordStatus.hasUpperCase ? "✓" : "✗"} Alespoň jedno velké písmeno
                </Text>
                <Text style={[styles.valText, passwordStatus.hasNumber ? styles.valOk : styles.valErr]}>
                  {passwordStatus.hasNumber ? "✓" : "✗"} Alespoň jedno číslo
                </Text>
              </View>
            )}
            
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
  passwordContainer: {
    marginBottom: 12,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    color: theme.colors.text,
  },
  eyeButton: {
    padding: 12,
  },
  validationBox: {
    backgroundColor: theme.colors.bg,
    padding: 10,
    borderRadius: theme.radius.input,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  valText: {
    fontSize: 12,
    marginVertical: 2,
  },
  valOk: {
    color: "#2e7d32",
  },
  valErr: {
    color: "#c62828",
  },
});