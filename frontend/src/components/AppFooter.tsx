import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme";

/**
 * Global copyright footer rendered at the bottom of every screen.
 * Compact, non-intrusive, never overlaps content (used outside ScrollView).
 */
export function AppFooter() {
  return (
    <View style={styles.wrap} testID="app-footer">
      <Text style={styles.text}>Vytvořil © James P. Jones 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  text: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
