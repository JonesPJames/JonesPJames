import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { theme } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  textStyle,
  testID,
  compact,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  testID?: string;
  compact?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";
  return (
    <TouchableOpacity
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.base,
        compact && styles.compact,
        isPrimary && { backgroundColor: theme.colors.primary },
        isSecondary && {
          backgroundColor: theme.colors.surface,
          borderWidth: 2,
          borderColor: theme.colors.border,
        },
        isGhost && { backgroundColor: "transparent" },
        isDanger && { backgroundColor: theme.colors.danger },
        (disabled || loading) && { opacity: 0.5 },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? "#fff" : theme.colors.primary} />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && { color: "#fff" },
            isSecondary && { color: theme.colors.text },
            isGhost && { color: theme.colors.primary },
            isDanger && { color: "#fff" },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  compact: { minHeight: 44, paddingHorizontal: 12 },
  text: { fontSize: 16, fontWeight: "700" },
});
