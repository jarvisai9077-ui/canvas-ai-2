import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ambient, Card, Row, Section, T } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";

const groups: { title: string; items: [string, string, string, string][] }[] = [
  { title: "Create", items: [["Universal Design Creator", "Any size: social, print, UI, packaging", "color-palette", "/create"], ["Documents & Ebooks", "Multi-page, PDF export", "document-text", "/create?kind=document"], ["Presentations", "Slides, notes, presenter mode", "easel", "/create?kind=presentation"], ["Reference Board", "Moodboards with notes & swatches", "images", "/create?kind=board"]] },
  { title: "Studios", items: [["Image Lab", "Crop, rotate, colour, filters, restore", "aperture", "/image-lab"], ["Drawing & Calligraphy", "Brushes, symmetry, nib angle", "brush", "/create?kind=drawing"], ["Vector Studio", "Pen, nodes, offset, measure, SVG", "git-network", "/create?kind=vector"], ["Video Studio", "Timeline, trim, split, titles", "film", "/create?kind=video"]] },
  { title: "Business & products", items: [["Brand Studio", "Brand kits, consistency, Master Project", "ribbon", "/brand"], ["Business Factory", "Variations, certificates, CSV reports, QR", "construct", "/factory"], ["Assets", "Library, duplicates, licences, dependencies", "folder-open", "/library"]] },
  { title: "Intelligence & automation", items: [["Command Palette", "Search tools & run commands", "terminal", "/palette"], ["Local AI Studio", "On-device model manager", "hardware-chip", "/ai"], ["Export Centre", "History, validation, regression", "share", "/exports"]] },
  { title: "System", items: [["Device Capability Test", "Memory, storage, recommended profile", "speedometer", "/device"], ["Feature Registry", "Honest status of every feature", "list", "/registry"], ["Settings", "Theme, autosave, backup & restore", "settings", "/settings"], ["Privacy Policy", "How your data stays on device", "shield-checkmark", "/legal/privacy"], ["Terms & Conditions", "Usage terms", "document-lock", "/legal/terms"]] },
];

export default function Studios() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="studios-screen">
      <Ambient />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + 24 }}>
        <View style={{ paddingHorizontal: spacing.md }}><T v="h1">Studios</T><T v="muted">Every module runs on this device, offline.</T></View>
        {groups.map((g) => (
          <Section key={g.title} title={g.title}>
            <Card>{g.items.map(([t, s, i, r]) => <Row key={t} icon={i as any} title={t} subtitle={s} onPress={() => router.push(r as any)} testID={`studio-${t.toLowerCase().replace(/[^a-z]+/g, "-")}`} />)}</Card>
          </Section>
        ))}
      </ScrollView>
    </View>
  );
}
