import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../auth";
import { theme } from "../theme";

export function AppHeader({ title, back = false }: { title?: string; back?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  return (
    <View style={styles.wrap} testID="app-header">
      <View style={styles.left}>
        {back ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} testID="back-btn">
            <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logo}>
            <Ionicons name="hammer" size={20} color="#fff" />
          </View>
        )}
        <View style={{ marginLeft: 10, flex: 1 }}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <>
              <Text style={styles.appName}>Řemeslník Pro</Text>
              {user ? (
                <Text style={styles.userMeta} numberOfLines={1}>
                  {user.name} • {user.phone || user.email}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
      {!back && user ? (
        <TouchableOpacity
          onPress={() => router.push("/profil")}
          style={styles.profileBtn}
          testID="profile-btn"
          hitSlop={8}
        >
          <Ionicons name="person-circle-outline" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : null}
      {back && user ? (
        <TouchableOpacity onPress={logout} hitSlop={8} testID="logout-btn">
          <Ionicons name="log-out-outline" size={24} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center" },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  userMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  title: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  profileBtn: { padding: 4 },
});
