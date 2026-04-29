import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { api, getApiErrorMessage } from "../src/api";
import { theme } from "../src/theme";
import { consumePrefill } from "../src/prefill";

/** Creates a new job (optionally prefilled) and immediately routes to its edit page. */
export default function NovaZakazka() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const pf = consumePrefill();
        const payload = {
          client_name: "",
          address: "",
          title: pf?.title || "",
          prace: pf?.prace || [],
          material: pf?.material || [],
          doprava: pf?.doprava || [],
        };
        const r = await api.post("/jobs", payload);
        router.replace(`/zakazka/${r.data.id}`);
      } catch (e: any) {
        const msg = getApiErrorMessage(e);
        setError(msg);
        Alert.alert("Chyba", msg, [{ text: "OK", onPress: () => router.back() }]);
      }
    })();
  }, []);

  return (
    <View style={styles.c}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" },
});
