import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { theme } from "../src/theme";
import { AppHeader } from "../src/components/AppHeader";
import { HelpIcon } from "../src/components/HelpIcon";
import {
  OnboardingOverlay,
  shouldShowOnboarding,
  resetOnboarding,
} from "../src/components/Onboarding";

const TILES: { key: string; title: string; subtitle: string; icon: any; href: string; primary?: boolean }[] = [
  { key: "nova", title: "Nová zakázka", subtitle: "Vytvořit cenovou nabídku", icon: "add-outline", href: "/nova-zakazka", primary: true },
  { key: "adresar", title: "Adresář zakázek", subtitle: "Všechny nabídky a stavy", icon: "folder-outline", href: "/adresar" },
  { key: "kalkulacka", title: "Kalkulačka prací", subtitle: "Ceny dle profese", icon: "calculator-outline", href: "/kalkulacka" },
  { key: "generator", title: "Generátor nabídek", subtitle: "AI vytvoří 3 varianty", icon: "sparkles-outline", href: "/generator" },
  { key: "import", title: "Import z Řemeslník AI", subtitle: "Načíst JSON podklady", icon: "cloud-download-outline", href: "/import" },
  { key: "zamestnanci", title: "Zaměstnanci", subtitle: "Správa týmu a PIN přístupů", icon: "people-outline", href: "/zamestnanci" },
  { key: "profil", title: "Můj profil", subtitle: "Jméno, firma, telefon", icon: "person-outline", href: "/profil" },
];

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [onboardOpen, setOnboardOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading]);

  useEffect(() => {
    (async () => {
      if (user && (await shouldShowOnboarding())) {
        setOnboardOpen(true);
      }
    })();
  }, [user]);

  if (!user) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Clean white hero */}
        <View style={styles.hero} testID="hero-card">
          <Text style={styles.heroOverline}>Přihlášen</Text>
          <Text style={styles.heroName}>{user.name}</Text>
          {user.company ? <Text style={styles.heroSub}>{user.company}</Text> : null}
          <View style={styles.heroMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metaText}>{user.phone || "—"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="mail-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Co chcete dělat?</Text>
          <TouchableOpacity
            onPress={async () => {
              await resetOnboarding();
              setOnboardOpen(true);
            }}
            testID="replay-onboarding"
            hitSlop={8}
            style={styles.helpBtn}
          >
            <Ionicons name="help-circle-outline" size={22} color={theme.colors.textMuted} />
            <Text style={styles.helpBtnText}>Nápověda</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.list}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.7}
              onPress={() => router.push(t.href as any)}
              style={[styles.tile, t.primary ? styles.tilePrimary : null]}
              testID={`tile-${t.key}`}
            >
              <View style={[styles.tileIcon, t.primary ? styles.tileIconPrimary : null]}>
                <Ionicons
                  name={t.icon}
                  size={28}
                  color={t.primary ? "#fff" : theme.colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tileTitle, t.primary ? { color: "#fff" } : null]}>
                  {t.title}
                </Text>
                <Text
                  style={[
                    styles.tileSub,
                    t.primary ? { color: "rgba(255,255,255,0.75)" } : null,
                  ]}
                >
                  {t.subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={t.primary ? "rgba(255,255,255,0.75)" : theme.colors.textMuted}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <OnboardingOverlay
        visible={onboardOpen}
        onClose={() => setOnboardOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: theme.radius.card,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroOverline: {
    color: theme.colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroName: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  heroSub: { color: theme.colors.textMuted, fontSize: 15, marginTop: 2 },
  heroMeta: { marginTop: 16, gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { color: theme.colors.textMuted, fontSize: 14 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textMuted,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  helpBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  helpBtnText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  list: { gap: 10 },
  tile: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 76,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tilePrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIconPrimary: { backgroundColor: "rgba(255,255,255,0.12)" },
  tileTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  tileSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});
