import React, { useEffect } from "react";
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

const TILES: { key: string; title: string; subtitle: string; icon: any; href: string; color?: string }[] = [
  { key: "adresar", title: "Adresář zakázek", subtitle: "Všechny vaše zakázky a stavy", icon: "folder-open", href: "/adresar" },
  { key: "nova", title: "Nová zakázka", subtitle: "Vytvořit cenovou nabídku", icon: "add-circle", href: "/nova-zakazka", color: theme.colors.primary },
  { key: "kalkulacka", title: "Kalkulačka prací", subtitle: "Předpřipravené ceny dle profese", icon: "calculator", href: "/kalkulacka" },
  { key: "generator", title: "Generátor nabídek", subtitle: "AI vytvoří 3 varianty", icon: "sparkles", href: "/generator" },
  { key: "import", title: "Import z Řemeslník AI", subtitle: "Načíst JSON podklady", icon: "cloud-download", href: "/import" },
  { key: "profil", title: "Můj profil", subtitle: "Jméno, firma, telefon", icon: "person-circle", href: "/profil" },
];

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading]);

  if (!user) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard} testID="hero-card">
          <Text style={styles.heroOverline}>Vítejte zpět</Text>
          <Text style={styles.heroTitle}>{user.name}</Text>
          {user.company ? <Text style={styles.heroSub}>{user.company}</Text> : null}
          <View style={styles.heroRow}>
            <View style={styles.heroChip}>
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.heroChipText}>{user.phone || "—"}</Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="mail" size={14} color="#fff" />
              <Text style={styles.heroChipText} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Hlavní menu</Text>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              onPress={() => router.push(t.href as any)}
              style={[styles.tile, t.color ? { backgroundColor: t.color, borderColor: t.color } : null]}
              testID={`tile-${t.key}`}
            >
              <View style={[styles.tileIcon, t.color ? { backgroundColor: "rgba(255,255,255,0.18)" } : null]}>
                <Ionicons name={t.icon} size={26} color={t.color ? "#fff" : theme.colors.primary} />
              </View>
              <Text style={[styles.tileTitle, t.color ? { color: "#fff" } : null]}>{t.title}</Text>
              <Text style={[styles.tileSub, t.color ? { color: "rgba(255,255,255,0.85)" } : null]}>
                {t.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 16, paddingBottom: 32 },
  heroCard: {
    backgroundColor: theme.colors.text,
    padding: 20,
    borderRadius: theme.radius.card,
    marginBottom: 22,
  },
  heroOverline: {
    color: "#c9820a",
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  heroSub: { color: "#bbb6ad", fontSize: 14, marginTop: 2 },
  heroRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroChipText: { color: "#fff", fontSize: 12, maxWidth: 160 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "48.5%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tileTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text, marginBottom: 2 },
  tileSub: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 16 },
});
