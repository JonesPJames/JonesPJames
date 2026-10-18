import React, { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  useEffect(() => {
    // Release the native splash after the root layout has mounted.
    // An auth/network failure must not leave the user on the launch image.
    void SplashScreen.hideAsync().catch((error) => {
      console.warn("Could not dismiss native splash screen", error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#f4f1eb" },
              animation: "fade",
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
