import React, { useState } from "react";
import { TouchableOpacity, Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

/** Small "?" icon next to a field/section. On tap opens a small modal with help text. */
export function HelpIcon({
  title,
  text,
  testID,
}: {
  title: string;
  text: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.btn}
        testID={testID || "help-icon"}
      >
        <Ionicons name="help-circle-outline" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Ionicons name="information-circle" size={22} color={theme.colors.primary} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.body}>{text}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)} testID="help-close">
              <Text style={styles.closeText}>Rozumím</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4, marginLeft: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: theme.colors.text },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.text, marginBottom: 20 },
  closeBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
