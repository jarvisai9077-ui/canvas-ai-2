import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Btn, Card, Chip, ChipRow, Empty, Header, Input, Row, Section, T } from "@/src/components/ui";
import { colorDistance, hexToRgb, isHex, nearest } from "@/src/engine/color";
import { pickFromGallery } from "@/src/engine/media";
import { confirmAsk, getProject, saveBrands, saveProject, toast, uid, useStore } from "@/src/engine/store";
import type { Brand, Project } from "@/src/engine/types";
import { radius, spacing, useTheme } from "@/src/theme";

const fonts = ["Jakarta-800", "Jakarta-600", "Jakarta-400", "Playfair-700", "Bebas-400", "SpaceMono"];

export function brandify(p: Project, b: Brand): { project: Project; changes: string[] } {
  const changes: string[] = []; const pal = [...b.colors, "#FFFFFF", "#1C1C1E", "#000000"];
  const map = (c: string | undefined, where: string) => { if (!c || !hexToRgb(c)) return c; const n = nearest(c, pal); if (n.toUpperCase() !== c.toUpperCase()) changes.push(`${where}: ${c} → ${n}`); return n; };
  const pages = p.pages.map((pg) => ({ ...pg, background: map(pg.background, `${pg.name} background`)!, layers: pg.layers.map((l) => {
    const n = { ...l, fill: l.type === "image" ? l.fill : map(l.fill, `${pg.name}/${l.name} fill`), stroke: map(l.stroke, `${pg.name}/${l.name} stroke`) };
    if (l.type === "text") { const heading = (l.fontSize ?? 0) >= p.width * 0.045; const f = heading ? b.headingFont : b.bodyFont; if (l.fontFamily !== f) { changes.push(`${pg.name}/${l.name} font → ${f}`); n.fontFamily = f; } }
    return n;
  }) }));
  return { project: { ...p, pages, brandId: b.id, snapshots: [{ id: uid(), name: `Before brand “${b.name}”`, createdAt: Date.now(), pages: p.pages, width: p.width, height: p.height }, ...p.snapshots] }, changes };
}

export default function BrandStudio() {
  const { project } = useLocalSearchParams<{ project?: string }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const { brands, projects } = useStore(); const [edit, setEdit] = useState<Brand | null>(null); const [hex, setHex] = useState("");
  const target = project ? getProject(project) : undefined;
  const save = (b: Brand) => { saveBrands(brands.some((x) => x.id === b.id) ? brands.map((x) => (x.id === b.id ? b : x)) : [b, ...brands]); setEdit(b); };
  const apply = async (b: Brand, p: Project) => {
    const { project: np, changes } = brandify(p, b);
    if (!changes.length) { saveProject({ ...p, brandId: b.id }); return toast(`“${p.name}” already follows ${b.name}`, "success"); }
    if (!(await confirmAsk({ title: `Apply ${b.name} to “${p.name}”?`, message: `${changes.length} change(s). A snapshot is saved for rollback.`, items: changes.slice(0, 40), confirmLabel: "Apply" }))) return;
    saveProject(np); toast(`Applied ${changes.length} brand changes`, "success");
  };
  const propagate = async (b: Brand) => {
    const linked = projects.filter((p) => p.brandId === b.id && !p.trashed); if (!linked.length) return toast("No projects are linked to this brand yet");
    const results = linked.map((p) => ({ p, ...brandify(p, b) })).filter((r) => r.changes.length);
    if (!results.length) return toast("All linked projects already match", "success");
    if (!(await confirmAsk({ title: "Update linked projects?", message: "Each project gets a rollback snapshot first.", items: results.map((r) => `${r.p.name}: ${r.changes.length} change(s)`), confirmLabel: `Update ${results.length}` }))) return;
    results.forEach((r) => saveProject(r.project)); toast(`Updated ${results.length} projects`, "success");
  };
  if (edit) {
    const linked = projects.filter((p) => p.brandId === edit.id && !p.trashed);
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }} testID="brand-edit-screen">
        <Header title={edit.name || "New brand"} subtitle="Brand kit" onBack={() => setEdit(null)} />
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={{ padding: spacing.md, gap: 12 }}>
            <Input label="Brand name" value={edit.name} onChangeText={(name) => setEdit({ ...edit, name })} onEndEditing={() => save(edit)} testID="brand-name-input" />
            <Input label="Tagline" value={edit.tagline ?? ""} onChangeText={(tagline) => setEdit({ ...edit, tagline })} onEndEditing={() => save(edit)} testID="brand-tagline-input" />
          </View>
          <Section title="Colours">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: spacing.md }}>
              {edit.colors.map((c) => <Pressable key={c} onLongPress={() => save({ ...edit, colors: edit.colors.filter((x) => x !== c) })} testID={`brand-color-${c.replace("#", "")}`} style={{ alignItems: "center", gap: 4 }}><View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c, borderWidth: 1, borderColor: colors.border }} /><T v="muted" style={{ fontSize: 11 }}>{c}</T></Pressable>)}
            </View>
            <View style={{ flexDirection: "row", gap: 8, padding: spacing.md, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}><Input value={hex} onChangeText={setHex} placeholder="#FF5E00" testID="brand-color-input" /></View>
              <Btn label="Add" onPress={() => { if (!isHex(hex)) return toast("Enter a hex colour like #FF5E00", "error"); save({ ...edit, colors: [...new Set([...edit.colors, hex.toUpperCase()])] }); setHex(""); }} testID="brand-color-add" />
            </View>
            <T v="muted" style={{ paddingHorizontal: spacing.md }}>Long-press a swatch to remove it.</T>
          </Section>
          <Section title="Heading font"><ChipRow>{fonts.map((f) => <Chip key={f} label={f} active={edit.headingFont === f} onPress={() => save({ ...edit, headingFont: f })} testID={`brand-heading-${f}`} />)}</ChipRow></Section>
          <Section title="Body font"><ChipRow>{fonts.map((f) => <Chip key={f} label={f} active={edit.bodyFont === f} onPress={() => save({ ...edit, bodyFont: f })} testID={`brand-body-${f}`} />)}</ChipRow></Section>
          <Section title="Logo">
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: spacing.md }}>
              {edit.logoUri ? <Image source={{ uri: edit.logoUri }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="contain" /> : null}
              <Btn small kind="secondary" label={edit.logoUri ? "Replace logo" : "Add logo"} icon="image" onPress={async () => { const a = (await pickFromGallery("image", false))[0]; if (a) { save({ ...edit, logoUri: a.uri }); if ((a.width ?? 0) < edit.minLogoSize) toast(`Logo is ${a.width}px, below the ${edit.minLogoSize}px minimum`, "error"); } }} testID="brand-logo-button" />
            </View>
          </Section>
          <Section title={`Master Project · ${linked.length} linked`}>
            <Card>{linked.map((p) => <Row key={p.id} icon="link" title={p.name} subtitle={`${consistency(p, edit)} off-brand colours`} />)}{!linked.length ? <Row title="Apply this brand to a project to link it" /> : null}</Card>
            <View style={{ padding: spacing.md }}><Btn label="Propagate brand to linked projects" icon="sync" onPress={() => propagate(edit)} testID="brand-propagate-button" /></View>
          </Section>
          {target ? <View style={{ paddingHorizontal: spacing.md }}><Btn label={`Apply to “${target.name}”`} icon="color-wand" onPress={() => apply(edit, target)} testID="brand-apply-target" /></View> : null}
        </KeyboardAwareScrollView>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="brand-screen">
      <Header title="Brand Studio" subtitle={target ? `Apply a brand to “${target.name}”` : "Brand kits stored on device"} onBack={() => router.back()} right={<Btn small label="New" icon="add" onPress={() => { const b: Brand = { id: uid(), name: "My brand", colors: ["#FF5E00", "#FFF0E6", "#1C1C1E"], headingFont: "Jakarta-800", bodyFont: "Jakarta-400", minLogoSize: 256, createdAt: Date.now() }; save(b); }} testID="brand-new-button" style={{ marginRight: 8 }} />} />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: spacing.md, gap: 12 }}>
        {!brands.length ? <Empty icon="ribbon" title="No brand kits" text="Create a brand kit with colours, fonts and a logo, then apply it to any design." /> : null}
        {brands.map((b) => (
          <Card key={b.id} style={{ padding: spacing.md, gap: 10 }} testID={`brand-card-${b.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center" }}><T v="h3" style={{ flex: 1 }}>{b.name}</T><Badge text={`${projects.filter((p) => p.brandId === b.id).length} linked`} tone="muted" /></View>
            <View style={{ flexDirection: "row", gap: 6 }}>{b.colors.map((c) => <View key={c} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: colors.border }} />)}</View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn small kind="secondary" label="Edit" onPress={() => setEdit(b)} testID={`brand-edit-${b.id}`} />
              {target ? <Btn small label="Apply to project" onPress={() => apply(b, target)} testID={`brand-apply-${b.id}`} /> : null}
              <Btn small kind="ghost" label="Delete" onPress={async () => { if (await confirmAsk({ title: `Delete ${b.name}?`, message: "Linked projects keep their current colours.", destructive: true, confirmLabel: "Delete" })) saveBrands(brands.filter((x) => x.id !== b.id)); }} testID={`brand-delete-${b.id}`} />
            </View>
          </Card>
        ))}
        <View style={{ height: 1, borderRadius: radius.sm }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function consistency(p: Project, b: Brand) {
  return p.pages.flatMap((pg) => pg.layers).filter((l) => l.fill && hexToRgb(l.fill) && l.type !== "image" && colorDistance(l.fill, nearest(l.fill, [...b.colors, "#FFFFFF", "#1C1C1E", "#000000"])) > 40).length;
}
