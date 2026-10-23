import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Card, Chip, ChipRow, Header, Input, Row, Section, T } from "@/src/components/ui";
import { newProject, presetGroups } from "@/src/engine/factory";
import { saveProject, toast } from "@/src/engine/store";
import type { Project, ProjectKind } from "@/src/engine/types";
import { projectRoute } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";

const kinds: ProjectKind[] = ["design", "document", "presentation", "drawing", "vector", "video", "board"];
const toPx = (v: number, unit: Project["unit"], dpi: number) => (unit === "px" ? v : unit === "in" ? v * dpi : (v / 25.4) * dpi);

export default function Create() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const params = useLocalSearchParams<{ kind?: ProjectKind }>();
  const [kind, setKind] = useState<ProjectKind>(params.kind ?? "design");
  const [w, setW] = useState("1080"); const [h, setH] = useState("1080"); const [unit, setUnit] = useState<Project["unit"]>("px"); const [dpi, setDpi] = useState("300");
  const make = (name: string, W: number, H: number, k: ProjectKind, u: Project["unit"] = "px", d = 72) => {
    const p = newProject({ name: `Untitled ${name}`, kind: k, width: Math.round(W), height: Math.round(H), unit: u, dpi: d, category: name });
    saveProject(p, { immediate: true }); router.replace(projectRoute(p));
  };
  const custom = () => {
    const d = unit === "px" ? 72 : Number(dpi) || 300;
    const W = toPx(Number(w), unit, d), H = toPx(Number(h), unit, d);
    if (!(W >= 16 && H >= 16 && W <= 12000 && H <= 12000)) { toast("Size must be between 16 and 12000 px", "error"); return; }
    make("Custom", W, H, kind, unit, d);
  };
  const ratio = Number(w) / Number(h) || 1;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="create-screen">
      <Header title="New project" subtitle="Choose a size or preset" onBack={() => router.back()} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Section title="Project type"><ChipRow>{kinds.map((k) => <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} active={kind === k} onPress={() => setKind(k)} testID={`create-kind-${k}`} />)}</ChipRow></Section>
        <Section title="Custom size">
          <Card style={{ padding: spacing.md, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Width" value={w} onChangeText={setW} keyboardType="numeric" testID="create-width-input" /></View>
              <View style={{ flex: 1 }}><Input label="Height" value={h} onChangeText={setH} keyboardType="numeric" testID="create-height-input" /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["px", "mm", "in"] as const).map((u) => <Chip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} testID={`create-unit-${u}`} />)}
              <Chip label="Swap orientation" icon="swap-horizontal" onPress={() => { setW(h); setH(w); }} testID="create-swap-orientation" />
            </View>
            {unit !== "px" ? <Input label="Resolution (dpi)" value={dpi} onChangeText={setDpi} keyboardType="numeric" testID="create-dpi-input" /> : null}
            <T v="muted">Aspect ratio {ratio.toFixed(3)} · {ratio > 1 ? "Landscape" : ratio < 1 ? "Portrait" : "Square"}{unit !== "px" ? ` · ${Math.round(toPx(Number(w), unit, Number(dpi) || 300))}×${Math.round(toPx(Number(h), unit, Number(dpi) || 300))} px` : ""}</T>
            <Btn label="Create" icon="add" onPress={custom} testID="create-custom-button" />
          </Card>
        </Section>
        {presetGroups.map((g) => (
          <Section key={g.group} title={g.group}>
            <Card>
              {g.items.map((p) => <Row key={p.name} title={p.name} subtitle={`${p.w} × ${p.h} px${p.dpi ? ` · ${p.dpi} dpi` : ""}`} onPress={() => make(p.name, p.w, p.h, p.kind ?? (kind === "design" ? "design" : kind), p.unit, p.dpi)} testID={`preset-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} />)}
            </Card>
          </Section>
        ))}
        <ScrollView />
      </KeyboardAwareScrollView>
    </View>
  );
}
