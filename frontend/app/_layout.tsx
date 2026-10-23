import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { RootOverlays } from "@/src/components/ui";
import { initStore } from "@/src/engine/store";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const [loaded] = useFonts({
    "Jakarta-400": require("../assets/fonts/Jakarta-400.ttf"),
    "Jakarta-600": require("../assets/fonts/Jakarta-600.ttf"),
    "Jakarta-800": require("../assets/fonts/Jakarta-800.ttf"),
    "Playfair-700": require("../assets/fonts/Playfair-700.ttf"),
    "Bebas-400": require("../assets/fonts/Bebas-400.ttf"),
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [ready, setReady] = useState(false);
  const { colors } = useTheme();
  useEffect(() => { initStore().finally(() => setReady(true)); }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <View style={[styles.root, { backgroundColor: colors.surface }]}>
              {loaded && ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} /> : null}
              <RootOverlays />
            </View>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
