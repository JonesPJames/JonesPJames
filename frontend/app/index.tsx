import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { theme } from "../src/theme";

export default function Index() {
  const { actor, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!actor) router.replace("/login");
    else if (actor.role === "owner") router.replace("/home");
    else router.replace("/employee");
  }, [loading, actor]);

  return (
    <View style={styles.c} testID="splash-loader">
      <ActivityIndicator color={theme.colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
