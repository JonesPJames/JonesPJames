import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { theme } from "../theme";

export function Field({
  label,
  error,
  ...rest
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.placeholder}
        style={[styles.input, error ? { borderColor: theme.colors.danger } : null]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    minHeight: 52,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.colors.text,
  },
  error: { color: theme.colors.danger, fontSize: 12, marginTop: 4 },
});
