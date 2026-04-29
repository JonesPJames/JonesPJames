import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { theme, STATUS_LABELS } from "../theme";

export function StatusBadge({ status, daysLeft }: { status: string; daysLeft?: number }) {
  const colors = theme.colors.status[status as keyof typeof theme.colors.status] || theme.colors.status.rozpracovano;
  let label = STATUS_LABELS[status] || status;
  if (status === "odlozeno" && typeof daysLeft === "number" && daysLeft >= 0) {
    label = `Odloženo • ${daysLeft} dní`;
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]} testID={`status-badge-${status}`}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: { fontSize: 12, fontWeight: "700" },
});
