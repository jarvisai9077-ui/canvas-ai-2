import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf="house.fill" /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="projects"><NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" /><NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="templates"><NativeTabs.Trigger.Icon sf="rectangle.stack.fill" /><NativeTabs.Trigger.Label>Templates</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="studios"><NativeTabs.Trigger.Icon sf="sparkles" /><NativeTabs.Trigger.Label>Studios</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  const icon = (n: React.ComponentProps<typeof Ionicons>["name"]) => ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? n : (`${n}-outline` as any)} size={23} color={color} />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandPrimary,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      tabBarStyle: { backgroundColor: colors.glassStrong, borderTopColor: colors.divider, ...(Platform.OS === "web" ? { height: 64 } : {}) },
      tabBarItemStyle: { alignSelf: "center" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home"), tabBarButtonTestID: "tab-home" } as any} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: icon("grid"), tabBarButtonTestID: "tab-projects" } as any} />
      <Tabs.Screen name="templates" options={{ title: "Templates", tabBarIcon: icon("albums"), tabBarButtonTestID: "tab-templates" } as any} />
      <Tabs.Screen name="studios" options={{ title: "Studios", tabBarIcon: icon("sparkles"), tabBarButtonTestID: "tab-studios" } as any} />
    </Tabs>
  );
}
