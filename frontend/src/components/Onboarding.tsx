import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

const KEY = "rp_onboarding_done_v1";

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: "hammer",
    title: "Vítejte v Řemeslník Pro",
    body: "Profesionální nástroj pro tvorbu cenových nabídek, kalkulací a stavebních deníků. Vše v jedné aplikaci, v kapse, přímo na stavbě.",
  },
  {
    icon: "document-text-outline",
    title: "Nabídka za 2 minuty",
    body: "V sekci Nová zakázka vyplníte klienta, adresu, název — a přidáte řádky prací, materiálu a dopravy. Aplikace čísluje, počítá a generuje PDF za vás.",
  },
  {
    icon: "pricetag-outline",
    title: "Stavy zakázek drží pořádek",
    body: "Každá nabídka má stav: Rozpracováno → Schváleno → Dokončeno. Odložené nabídky běží 30 dní a pak expirují — aplikace hlídá termíny za vás.",
  },
  {
    icon: "construct-outline",
    title: "Kalkulačka podle profese",
    body: "Zedník, Obkladač, Malíř… každá profese má přednastavené ceny. Stačí zadat množství a exportovat rovnou do nové nabídky.",
  },
  {
    icon: "sparkles-outline",
    title: "AI pomocník",
    body: "Generátor nabídek vytvoří 3 varianty (Základní / Střední / Premium) podle vašeho zadání. AI také odhadne cenu libovolného materiálu.",
  },
  {
    icon: "book-outline",
    title: "Stavební deník & vyúčtování",
    body: "Po schválení se automaticky otevře Stavební deník s denními záznamy a tabulkami víceprací. Po dokončení pak Celkové vyúčtování, které můžete finalizovat a uzamknout.",
  },
];

export async function shouldShowOnboarding(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  return v !== "1";
}

export async function markOnboardingDone() {
  await AsyncStorage.setItem(KEY, "1");
}

export async function resetOnboarding() {
  await AsyncStorage.removeItem(KEY);
}

export function OnboardingOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  async function finish() {
    await markOnboardingDone();
    onClose();
  }

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="onboarding-sheet">
          <TouchableOpacity onPress={finish} style={styles.skip} hitSlop={10} testID="onboarding-skip">
            <Text style={styles.skipText}>Přeskočit</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.iconWrap}>
              <Ionicons name={slide.icon} size={52} color={theme.colors.primary} />
            </View>
            <Text style={styles.h1}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </ScrollView>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index ? styles.dotActive : null,
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {index > 0 ? (
              <TouchableOpacity
                onPress={() => setIndex(index - 1)}
                style={[styles.navBtn, styles.navBtnSecondary]}
                testID="onboarding-prev"
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
                <Text style={styles.navBtnTextSecondary}>Zpět</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              onPress={isLast ? finish : () => setIndex(index + 1)}
              style={[styles.navBtn, styles.navBtnPrimary]}
              testID={isLast ? "onboarding-finish" : "onboarding-next"}
            >
              <Text style={styles.navBtnTextPrimary}>
                {isLast ? "Začít používat" : "Dál"}
              </Text>
              {!isLast ? <Ionicons name="chevron-forward" size={20} color="#fff" /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    minHeight: Dimensions.get("window").height * 0.62,
  },
  skip: {
    alignSelf: "flex-end",
    padding: 8,
  },
  skipText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: "600" },
  content: { alignItems: "center", paddingVertical: 18 },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginVertical: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
  },
  dotActive: { backgroundColor: theme.colors.primary, width: 22 },
  actions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  navBtn: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  navBtnSecondary: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navBtnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  navBtnTextPrimary: { color: "#fff", fontSize: 16, fontWeight: "800" },
  navBtnTextSecondary: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
});
