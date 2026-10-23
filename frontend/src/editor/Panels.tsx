import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Btn, Chip, IconBtn, Input, Row, Slider, T, Tool } from "@/src/components/ui";
import { isHex, swatches } from "@/src/engine/color";
import { newLayer, newPage } from "@/src/engine/factory";
import { align, distribute, smartResize } from "@/src/engine/geometry";
import { captureWithCamera, pickFromGallery } from "@/src/engine/media";
import { getState, promptText, toast, uid, updateSettings, useStore } from "@/src/engine/store";
import type { Layer } from "@/src/engine/types";
import { presetGroups } from "@/src/engine/factory";
import { radius, spacing, useTheme } from "@/src/theme";
import type { Editor } from "./useEditor";

const fontsList = [["Jakarta-400", "Jakarta"], ["Jakarta-600", "Jakarta Semi"], ["Jakarta-800", "Jakarta Bold"], ["Playfair-700", "Playfair"], ["Bebas-400", "Bebas"], ["SpaceMono", "Mono"]];

function Swatches({ value, onPick, testID }: { value?: string; onPick: (c: string) => void; testID: string }) {
  const { colors } = useTheme(); const { brands } = useStore(); const [hex, setHex] = useState(value ?? "");
  useEffect(() => setHex(value ?? ""), [value]);
  const all = [...new Set([...brands.flatMap((b) => b.colors), ...swatches])];
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {all.map((c) => (
          <Pressable key={c} onPress={() => onPick(c)} testID={`${testID}-${c.replace("#", "")}`} accessibilityLabel={`Colour ${c}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: value?.toUpperCase() === c.toUpperCase() ? 3 : 1, borderColor: value?.toUpperCase() === c.toUpperCase() ? colors.brandPrimary : colors.borderStrong }} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.md }}><Input value={hex} onChangeText={setHex} onEndEditing={() => (isHex(hex) ? onPick(hex.toUpperCase()) : setHex(value ?? ""))} placeholder="#FF5E00" testID={`${testID}-hex-input`} /></View>
    </View>
  );
}

function Num({ label, value, onCommit, testID }: { label: string; value: number; onCommit: (v: number) => void; testID: string }) {
  const [v, setV] = useState(String(Math.round(value)));
  useEffect(() => setV(String(Math.round(value))), [value]);
  return <View style={{ flex: 1 }}><Input label={label} value={v} keyboardType="numeric" onChangeText={setV} onEndEditing={() => { const n = Number(v); if (Number.isFinite(n)) onCommit(n); else setV(String(Math.round(value))); }} testID={testID} /></View>;
}

export function AddPanel({ ed, center }: { ed: Editor; center: () => { x: number; y: number } }) {
  const router = useRouter(); const p = ed.project!;
  const add = (l: Layer, label: string) => { ed.commit(label, (ls) => [...ls, l]); ed.setSelected([l.id]); };
  const at = (type: Layer["type"], patch: Partial<Layer> = {}) => {
    const base = newLayer(type, patch); const s = Math.min(p.width, p.height) / 1080;
    const w = base.w * s, h = base.h * s; const c = center();
    return { ...base, w, h, x: c.x - w / 2, y: c.y - h / 2, fontSize: base.fontSize ? Math.round(base.fontSize * s) : undefined, strokeWidth: base.strokeWidth ? base.strokeWidth * s : undefined };
  };
  const image = async (camera: boolean) => {
    const assets = camera ? await captureWithCamera() : await pickFromGallery("image", true);
    assets.forEach((a, i) => {
      const ar = (a.width ?? 4) / (a.height ?? 3); const w = Math.min(p.width * 0.7, (a.width ?? 800)); const l = at("image", { uri: a.uri, assetId: a.id, naturalW: a.width, naturalH: a.height, name: a.name.slice(0, 24) });
      add({ ...l, w, h: w / ar, x: (p.width - w) / 2 + i * 20, y: (p.height - w / ar) / 2 + i * 20 }, "Add image");
    });
  };
  const items: [string, any, () => void][] = [
    ["Heading", "text", () => add(at("text", { text: "Headline", fontSize: 72, fontFamily: "Jakarta-800" }), "Add heading")],
    ["Body", "reorder-four", () => add(at("text", { text: "Add body text here", fontSize: 32, fontFamily: "Jakarta-400", w: 600 }), "Add text")],
    ["Image", "image", () => image(false)],
    ["Camera", "camera", () => image(true)],
    ["Rectangle", "square", () => add(at("rect", { radius: 24 }), "Add rectangle")],
    ["Ellipse", "ellipse", () => add(at("ellipse"), "Add ellipse")],
    ["Polygon", "shapes", () => add(at("polygon"), "Add polygon")],
    ["Star", "star", () => add(at("star"), "Add star")],
    ["Line", "remove", () => add(at("line"), "Add line")],
    ["QR code", "qr-code", async () => { const v = await promptText("QR code content", "https://"); if (v) add(at("qr", { value: v, name: "QR " + v.slice(0, 12) }), "Add QR"); }],
    ["Chart", "bar-chart", () => add(at("chart"), "Add chart")],
    ["Table", "grid", () => add(at("table"), "Add table")],
    ["Note", "document", () => add(at("note"), "Add note")],
    ["Measure", "resize", () => add(at("measure", { w: p.width * 0.4 }), "Add measurement")],
    ["Draw", "brush", () => router.push(`/draw/${p.id}?page=${ed.pageIndex}`)],
    ["Pen tool", "git-network", () => router.push(`/vector/${p.id}?page=${ed.pageIndex}`)],
  ];
  return <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 }}>{items.map(([l, i, f]) => <Tool key={l} icon={i} label={l} onPress={f} testID={`add-${l.toLowerCase().replace(/ /g, "-")}`} />)}</View>;
}

export function LayersPanel({ ed }: { ed: Editor }) {
  const { colors } = useTheme(); const layers = [...(ed.page?.layers ?? [])].reverse();
  const move = (id: string, dir: number) => ed.commit("Reorder layer", (ls) => { const i = ls.findIndex((l) => l.id === id); const j = i + dir; if (j < 0 || j >= ls.length) return ls; const n = [...ls]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  if (!layers.length) return <T v="muted" style={{ padding: spacing.md }}>No layers yet. Use Add to place text, shapes or images.</T>;
  return (
    <View>
      {layers.map((l) => {
        const on = ed.selected.includes(l.id);
        return (
          <Pressable key={l.id} onPress={() => ed.setSelected(on ? ed.selected.filter((x) => x !== l.id) : [...ed.selected.filter(() => false), l.id])} onLongPress={() => ed.setSelected(on ? ed.selected.filter((x) => x !== l.id) : [...ed.selected, l.id])} testID={`layer-row-${l.id}`}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, minHeight: 48, backgroundColor: on ? colors.brandTertiary : "transparent", borderRadius: radius.md, marginHorizontal: 8 }}>
            <Ionicons name={({ text: "text", image: "image", rect: "square", ellipse: "ellipse", path: "brush", qr: "qr-code", chart: "bar-chart", table: "grid", star: "star", polygon: "shapes", line: "remove", note: "document", measure: "resize" } as any)[l.type]} size={16} color={colors.onSurfaceTertiary} />
            <T v="body" numberOfLines={1} style={{ flex: 1, marginLeft: 10, opacity: l.visible ? 1 : 0.4 }}>{l.name}{l.groupId ? " · grouped" : ""}</T>
            <IconBtn icon="arrow-up" label="Bring forward" size={16} onPress={() => move(l.id, 1)} testID={`layer-up-${l.id}`} />
            <IconBtn icon="arrow-down" label="Send backward" size={16} onPress={() => move(l.id, -1)} testID={`layer-down-${l.id}`} />
            <IconBtn icon={l.visible ? "eye" : "eye-off"} label="Toggle visibility" size={16} onPress={() => ed.commit("Toggle visibility", (ls) => ls.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)))} testID={`layer-visibility-${l.id}`} />
            <IconBtn icon={l.locked ? "lock-closed" : "lock-open"} label="Toggle lock" size={16} onPress={() => ed.commit("Toggle lock", (ls) => ls.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x)))} testID={`layer-lock-${l.id}`} />
          </Pressable>
        );
      })}
      <T v="muted" style={{ padding: spacing.md }}>Tip: long-press rows to multi-select.</T>
    </View>
  );
}

export function EditPanel({ ed }: { ed: Editor }) {
  const router = useRouter(); const { settings } = useStore(); const sel = ed.sel; const l = sel[0];
  const [text, setText] = useState(l?.text ?? "");
  useEffect(() => setText(l?.text ?? ""), [l?.id, l?.text]);
  if (!l) return <T v="muted" style={{ padding: spacing.md }}>Select an object on the canvas to edit it.</T>;
  const ids = ed.selected; const W = ed.project!.width, H = ed.project!.height;
  const set = (patch: Partial<Layer>, label?: string) => (label ? ed.commit(label, (ls) => ls.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x))) : ed.live((ls) => ls.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x))));
  const done = (label: string) => ed.commit(label);
  const dup = () => { const copies = sel.map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: uid(), x: x.x + 24, y: x.y + 24, name: x.name + " copy" })); ed.commit("Duplicate", (ls) => [...ls, ...copies]); ed.setSelected(copies.map((c) => c.id)); };
  const del = () => { ed.commit("Delete", (ls) => ls.filter((x) => !ids.includes(x.id))); ed.setSelected([]); toast("Deleted · tap Undo to restore"); };
  const order = (front: boolean) => ed.commit(front ? "Bring to front" : "Send to back", (ls) => { const s = ls.filter((x) => ids.includes(x.id)), r = ls.filter((x) => !ids.includes(x.id)); return front ? [...r, ...s] : [...s, ...r]; });
  const group = () => { const g = sel.length > 1 && !sel.every((x) => x.groupId && x.groupId === sel[0].groupId) ? uid() : null; set({ groupId: g }, g ? "Group" : "Ungroup"); };
  return (
    <View style={{ gap: 4, paddingBottom: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        <Tool icon="copy" label="Duplicate" onPress={dup} testID="edit-duplicate" />
        <Tool icon="trash" label="Delete" onPress={del} testID="edit-delete" />
        <Tool icon="arrow-up-circle" label="Front" onPress={() => order(true)} testID="edit-front" />
        <Tool icon="arrow-down-circle" label="Back" onPress={() => order(false)} testID="edit-back" />
        <Tool icon="swap-horizontal" label="Flip H" onPress={() => set({ flipX: !l.flipX }, "Flip horizontal")} testID="edit-flip-h" />
        <Tool icon="swap-vertical" label="Flip V" onPress={() => set({ flipY: !l.flipY }, "Flip vertical")} testID="edit-flip-v" />
        <Tool icon={l.locked ? "lock-open" : "lock-closed"} label={l.locked ? "Unlock" : "Lock"} onPress={() => set({ locked: !l.locked }, "Lock")} testID="edit-lock" />
        <Tool icon="albums" label={sel.length > 1 ? "Group" : "Ungroup"} onPress={group} testID="edit-group" />
        <Tool icon="bookmark" label="Save style" onPress={async () => { const n = await promptText("Name this style preset", `${l.type} style`); if (!n) return; const { fill, stroke, strokeWidth, radius: r, gradient, shadow, glow, opacity, fontFamily, fontSize, letterSpacing, lineHeight } = l; updateSettings({ effectPresets: [...getState().settings.effectPresets, { name: n, props: JSON.parse(JSON.stringify({ fill, stroke, strokeWidth, radius: r, gradient, shadow, glow, opacity, fontFamily, fontSize, letterSpacing, lineHeight })) }] }); toast("Style preset saved", "success"); }} testID="edit-save-style" />
      </ScrollView>
      {settings.effectPresets.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 }}>{settings.effectPresets.map((p, i) => <Chip key={i} icon="color-wand" label={p.name} onPress={() => set(Object.fromEntries(Object.entries(p.props).filter(([, v]) => v !== undefined)), `Apply ${p.name}`)} testID={`style-preset-${i}`} />)}</ScrollView> : null}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: spacing.md }}>
        <Num label="X" value={l.x} onCommit={(v) => set({ x: v }, "Set X")} testID="edit-x-input" />
        <Num label="Y" value={l.y} onCommit={(v) => set({ y: v }, "Set Y")} testID="edit-y-input" />
        <Num label="W" value={l.w} onCommit={(v) => set({ w: Math.max(1, v) }, "Set width")} testID="edit-w-input" />
        <Num label="H" value={l.h} onCommit={(v) => set({ h: Math.max(1, v) }, "Set height")} testID="edit-h-input" />
      </View>
      <Slider label="Rotation" value={l.rotation} min={-180} max={180} onChange={(v) => set({ rotation: v })} onDone={() => done("Rotate")} testID="edit-rotation-slider" />
      <Slider label="Opacity" value={l.opacity * 100} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} onDone={() => done("Opacity")} testID="edit-opacity-slider" />
      {l.type === "text" ? (
        <View style={{ gap: 6 }}>
          <View style={{ paddingHorizontal: spacing.md }}><Input value={text} onChangeText={(s) => { setText(s); set({ text: s, name: s.slice(0, 18) || "Text" }); }} onEndEditing={() => done("Edit text")} multiline testID="edit-text-input" placeholder="Text" /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>{fontsList.map(([f, n]) => <Chip key={f} label={n} active={l.fontFamily === f} onPress={() => set({ fontFamily: f }, "Change font")} testID={`edit-font-${f}`} />)}</ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingTop: 6 }}>
            {(["start", "middle", "end"] as const).map((a) => <Chip key={a} icon={a === "start" ? "reorder-three" : a === "middle" ? "menu" : "reorder-three"} label={a === "start" ? "Left" : a === "middle" ? "Center" : "Right"} active={l.align === a} onPress={() => set({ align: a }, "Align text")} testID={`edit-align-${a}`} />)}
            <Chip label="Italic" active={!!l.italic} onPress={() => set({ italic: !l.italic }, "Italic")} testID="edit-italic" />
            <Chip label="Outline" active={!!l.outline} onPress={() => set({ outline: !l.outline, stroke: l.stroke ?? "#000000", strokeWidth: l.strokeWidth ?? 3 }, "Outline")} testID="edit-outline" />
            <Chip label="UPPER" onPress={() => set({ text: (l.text ?? "").toUpperCase() }, "Uppercase")} testID="edit-uppercase" />
          </ScrollView>
          <Slider label="Font size" value={l.fontSize ?? 24} min={6} max={Math.round(Math.min(W, H) / 3)} onChange={(v) => set({ fontSize: v })} onDone={() => done("Font size")} testID="edit-fontsize-slider" />
          <Slider label="Letter spacing" value={l.letterSpacing ?? 0} min={-10} max={60} onChange={(v) => set({ letterSpacing: v })} onDone={() => done("Letter spacing")} testID="edit-letterspacing-slider" />
          <Slider label="Line height" value={l.lineHeight ?? 1.2} min={0.7} max={2.5} step={0.05} onChange={(v) => set({ lineHeight: v })} onDone={() => done("Line height")} testID="edit-lineheight-slider" />
          <Slider label="Curve (text on arc)" value={l.curve ?? 0} min={-2000} max={2000} step={10} onChange={(v) => set({ curve: Math.abs(v) < 20 ? 0 : v })} onDone={() => done("Curve text")} testID="edit-curve-slider" />
          <Slider label="Skew (perspective)" value={l.skewX ?? 0} min={-45} max={45} onChange={(v) => set({ skewX: v })} onDone={() => done("Skew")} testID="edit-skew-slider" />
        </View>
      ) : null}
      {l.type === "image" ? (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
          <Btn small label="Open in Image Lab" icon="aperture" onPress={() => router.push(`/image-lab?project=${ed.project!.id}&page=${ed.pageIndex}&layer=${l.id}`)} testID="edit-open-image-lab" />
          <Btn small kind="secondary" label="Fit canvas" icon="expand" onPress={() => set({ x: 0, y: 0, w: W, h: H }, "Fit image")} testID="edit-fit-image" />
        </View>
      ) : null}
      {(l.type === "polygon" || l.type === "star") ? <Slider label={l.type === "star" ? "Points" : "Sides"} value={l.sides ?? 5} min={3} max={24} onChange={(v) => set({ sides: v })} onDone={() => done("Sides")} testID="edit-sides-slider" /> : null}
      {l.type === "star" ? <Slider label="Inner radius" value={(l.innerRatio ?? 0.45) * 100} min={10} max={95} onChange={(v) => set({ innerRatio: v / 100 })} onDone={() => done("Inner radius")} testID="edit-inner-slider" /> : null}
      {l.type === "qr" ? <View style={{ paddingHorizontal: spacing.md }}><Input label="QR content" value={l.value ?? ""} onChangeText={(s) => set({ value: s })} onEndEditing={() => done("QR value")} testID="edit-qr-input" /></View> : null}
      {l.type === "note" ? <View style={{ paddingHorizontal: spacing.md }}><Input label="Note" value={text} onChangeText={(s) => { setText(s); set({ text: s }); }} onEndEditing={() => done("Edit note")} multiline testID="edit-note-input" /></View> : null}
      {l.type === "chart" ? (
        <View style={{ gap: 6, paddingHorizontal: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 8 }}>{(["bar", "line", "pie"] as const).map((c) => <Chip key={c} label={c} active={l.chartType === c} onPress={() => set({ chartType: c }, "Chart type")} testID={`edit-chart-${c}`} />)}</View>
          <Input label="Data (label:value, …)" value={(l.data?.labels ?? []).map((lb, i) => `${lb}:${l.data!.values[i]}`).join(", ")} onChangeText={(s) => { const parts = s.split(",").map((x) => x.split(":")); set({ data: { labels: parts.map((p) => p[0]?.trim() ?? ""), values: parts.map((p) => Number(p[1]) || 0) } }); }} onEndEditing={() => done("Chart data")} testID="edit-chart-data" />
        </View>
      ) : null}
      {l.type === "table" ? <View style={{ paddingHorizontal: spacing.md }}><Input label="Table (CSV, one row per line)" multiline value={(l.rows ?? []).map((r) => r.join(",")).join("\n")} onChangeText={(s) => set({ rows: s.split("\n").map((r) => r.split(",")) })} onEndEditing={() => done("Table data")} testID="edit-table-data" /></View> : null}
      {l.type !== "image" && l.type !== "line" && l.type !== "measure" ? <><T v="label" style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>Fill</T><Swatches value={l.fill} onPick={(c) => set({ fill: c, gradient: l.gradient ? { ...l.gradient, from: c } : null }, "Fill colour")} testID="edit-fill" /></> : null}
      {l.type !== "text" && l.type !== "table" ? (
        <>
          <T v="label" style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>Stroke</T>
          <Swatches value={l.stroke} onPick={(c) => set({ stroke: c, strokeWidth: l.strokeWidth || 4 }, "Stroke colour")} testID="edit-stroke" />
          <Slider label="Stroke width" value={l.strokeWidth ?? 0} min={0} max={60} onChange={(v) => set({ strokeWidth: v })} onDone={() => done("Stroke width")} testID="edit-strokewidth-slider" />
          <View style={{ flexDirection: "row", paddingHorizontal: spacing.md, gap: 8 }}><Chip label="Dashed" active={!!l.dash} onPress={() => set({ dash: !l.dash }, "Dashed stroke")} testID="edit-dash" /></View>
        </>
      ) : null}
      {l.type === "rect" || l.type === "image" ? <Slider label="Corner radius" value={l.radius ?? 0} min={0} max={Math.min(l.w, l.h) / 2} onChange={(v) => set({ radius: v })} onDone={() => done("Corner radius")} testID="edit-radius-slider" /> : null}
      <T v="label" style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>Effects</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        <Chip label="Linear gradient" active={l.gradient?.type === "linear"} onPress={() => set({ gradient: l.gradient?.type === "linear" ? null : { type: "linear", from: l.fill ?? "#FF5E00", to: "#1C1C1E", angle: 45 } }, "Gradient")} testID="edit-gradient-linear" />
        <Chip label="Radial gradient" active={l.gradient?.type === "radial"} onPress={() => set({ gradient: l.gradient?.type === "radial" ? null : { type: "radial", from: l.fill ?? "#FF5E00", to: "#FFF0E6", angle: 0 } }, "Gradient")} testID="edit-gradient-radial" />
        <Chip label="Shadow" active={!!l.shadow} onPress={() => set({ shadow: l.shadow ? null : { dx: 8, dy: 12, blur: 16, color: "#000000", opacity: 0.25 } }, "Shadow")} testID="edit-shadow" />
        <Chip label="Glow" active={!!l.glow} onPress={() => set({ glow: l.glow ? 0 : 12 }, "Glow")} testID="edit-glow" />
        <Chip label="Sticker cut line" active={!!l.cutLine} onPress={() => set({ cutLine: l.cutLine ? 0 : Math.round(Math.min(W, H) * 0.02) }, "Cut line")} testID="edit-cutline" />
      </ScrollView>
      {l.gradient ? <><T v="small" style={{ paddingHorizontal: spacing.md, marginTop: 6 }}>Gradient end colour</T><Swatches value={l.gradient.to} onPick={(c) => set({ gradient: { ...l.gradient!, to: c } }, "Gradient colour")} testID="edit-gradient-to" /><Slider label="Gradient angle" value={l.gradient.angle} min={0} max={360} onChange={(v) => set({ gradient: { ...l.gradient!, angle: v } })} onDone={() => done("Gradient angle")} testID="edit-gradient-angle" /></> : null}
      {l.shadow ? <><Slider label="Shadow blur" value={l.shadow.blur} min={0} max={80} onChange={(v) => set({ shadow: { ...l.shadow!, blur: v } })} onDone={() => done("Shadow blur")} testID="edit-shadow-blur" /><Slider label="Shadow offset" value={l.shadow.dy} min={-60} max={60} onChange={(v) => set({ shadow: { ...l.shadow!, dy: v, dx: v * 0.6 } })} onDone={() => done("Shadow offset")} testID="edit-shadow-offset" /><Slider label="Shadow opacity" value={l.shadow.opacity * 100} min={0} max={100} onChange={(v) => set({ shadow: { ...l.shadow!, opacity: v / 100 } })} onDone={() => done("Shadow opacity")} testID="edit-shadow-opacity" /></> : null}
      {l.glow ? <Slider label="Glow size" value={l.glow} min={1} max={60} onChange={(v) => set({ glow: v })} onDone={() => done("Glow")} testID="edit-glow-slider" /> : null}
      {l.cutLine ? <Slider label="Cut line offset" value={l.cutLine} min={2} max={Math.round(Math.min(W, H) * 0.08)} onChange={(v) => set({ cutLine: v })} onDone={() => done("Cut line")} testID="edit-cutline-slider" /> : null}
    </View>
  );
}

export function ArrangePanel({ ed }: { ed: Editor }) {
  const W = ed.project!.width, H = ed.project!.height; const ids = ed.selected;
  const a = (m: any) => ed.commit("Align", (ls) => align(ls, ids, m, W, H));
  if (!ids.length) return <T v="muted" style={{ padding: spacing.md }}>Select objects to align. One object aligns to the page; several align to each other.</T>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 }}>
      {[["left", "Left", "arrow-back"], ["hcenter", "Center", "swap-horizontal"], ["right", "Right", "arrow-forward"], ["top", "Top", "arrow-up"], ["vcenter", "Middle", "swap-vertical"], ["bottom", "Bottom", "arrow-down"]].map(([m, l, i]) => <Tool key={m} icon={i as any} label={l} onPress={() => a(m)} testID={`align-${m}`} />)}
      <Tool icon="ellipsis-horizontal" label="Distribute H" onPress={() => ids.length < 3 ? toast("Select 3 or more objects") : ed.commit("Distribute", (ls) => distribute(ls, ids, "h"))} testID="distribute-h" />
      <Tool icon="ellipsis-vertical" label="Distribute V" onPress={() => ids.length < 3 ? toast("Select 3 or more objects") : ed.commit("Distribute", (ls) => distribute(ls, ids, "v"))} testID="distribute-v" />
      <Tool icon="bookmarks" label="Save selection" onPress={async () => { const n = await promptText("Name this selection", "Selection"); if (n) { updateSettings({ selectionPresets: [...getState().settings.selectionPresets, { name: n, props: { groupId: ids.join(",") } as any }] }); toast("Selection saved", "success"); } }} testID="save-selection" />
      {getState().settings.selectionPresets.map((s, i) => <Tool key={i} icon="bookmark" label={s.name} onPress={() => ed.setSelected(String((s.props as any).groupId).split(",").filter((id) => ed.page.layers.some((l) => l.id === id)))} testID={`selection-preset-${i}`} />)}
    </View>
  );
}

export function PagePanel({ ed }: { ed: Editor }) {
  const p = ed.project!; const pg = ed.page;
  const [notes, setNotes] = useState(pg.notes ?? "");
  useEffect(() => setNotes(pg.notes ?? ""), [pg.id, pg.notes]);
  const setPage = (patch: any, label: string) => ed.setAllPages(label, ed.pages.map((x, i) => (i === ed.pageIndex ? { ...x, ...patch } : x)));
  const resize = (w: number, h: number) => { ed.setAllPages(`Resize to ${w}×${h}`, ed.pages.map((x) => smartResize(x, p.width, p.height, w, h)), { width: w, height: h }); toast(`Smart-resized to ${w}×${h}`, "success"); };
  return (
    <View style={{ gap: 8, paddingBottom: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        <Tool icon="add" label="Add page" onPress={() => { ed.setAllPages("Add page", [...ed.pages, newPage(`Page ${ed.pages.length + 1}`, pg.background)]); ed.setPageIndex(ed.pages.length); }} testID="page-add" />
        <Tool icon="copy" label="Duplicate" onPress={() => { const c = { ...JSON.parse(JSON.stringify(pg)), id: uid(), name: pg.name + " copy" }; c.layers = c.layers.map((l: Layer) => ({ ...l, id: uid() })); const n = [...ed.pages]; n.splice(ed.pageIndex + 1, 0, c); ed.setAllPages("Duplicate page", n); ed.setPageIndex(ed.pageIndex + 1); }} testID="page-duplicate" />
        <Tool icon="trash" label="Delete" onPress={() => { if (ed.pages.length < 2) return toast("A project needs at least one page"); ed.setAllPages("Delete page", ed.pages.filter((_, i) => i !== ed.pageIndex)); ed.setPageIndex(Math.max(0, ed.pageIndex - 1)); }} testID="page-delete" />
        <Tool icon="arrow-back" label="Move left" onPress={() => { const i = ed.pageIndex; if (i < 1) return; const n = [...ed.pages]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; ed.setAllPages("Reorder pages", n); ed.setPageIndex(i - 1); }} testID="page-move-left" />
        <Tool icon="arrow-forward" label="Move right" onPress={() => { const i = ed.pageIndex; if (i >= ed.pages.length - 1) return; const n = [...ed.pages]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; ed.setAllPages("Reorder pages", n); ed.setPageIndex(i + 1); }} testID="page-move-right" />
        <Tool icon="create" label="Rename" onPress={async () => { const n = await promptText("Page name", pg.name); if (n) setPage({ name: n }, "Rename page"); }} testID="page-rename" />
        <Tool icon="list-circle" label="Contents" onPress={() => { const toc = newLayer("text", { x: p.width * 0.08, y: p.height * 0.08, w: p.width * 0.84, fontSize: Math.round(p.width / 30), lineHeight: 1.8, text: "Contents\n" + ed.pages.map((x, i) => `${i + 1}. ${x.name}`).join("\n"), name: "Table of contents" }); ed.commit("Table of contents", (ls) => [...ls, toc]); }} testID="page-toc" />
        <Tool icon="text" label="Page numbers" onPress={() => ed.setAllPages("Page numbers", ed.pages.map((x, i) => ({ ...x, layers: [...x.layers.filter((l) => l.name !== "Page number"), newLayer("text", { name: "Page number", text: `${i + 1} / ${ed.pages.length}`, x: p.width * 0.8, y: p.height * 0.95, w: p.width * 0.15, fontSize: Math.round(p.width / 60), align: "end", fill: "#8E8E93" })] })))} testID="page-numbers" />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>{ed.pages.map((x, i) => <Chip key={x.id} label={`${i + 1}. ${x.name}`} active={i === ed.pageIndex} onPress={() => { ed.setPageIndex(i); ed.setSelected([]); }} testID={`page-chip-${i}`} />)}</ScrollView>
      <T v="label" style={{ paddingHorizontal: spacing.md }}>Background</T>
      <Swatches value={pg.background} onPick={(c) => setPage({ background: c }, "Background")} testID="page-bg" />
      {p.kind === "presentation" ? <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>{(["none", "fade", "slide"] as const).map((t) => <Chip key={t} label={`Transition: ${t}`} active={(pg.transition ?? "none") === t} onPress={() => setPage({ transition: t }, "Transition")} testID={`page-transition-${t}`} />)}</ScrollView> : null}
      <View style={{ paddingHorizontal: spacing.md }}><Input label="Speaker / page notes" multiline value={notes} onChangeText={setNotes} onEndEditing={() => notes !== (pg.notes ?? "") && setPage({ notes }, "Notes")} testID="page-notes-input" /></View>
      <T v="label" style={{ paddingHorizontal: spacing.md }}>Smart resize (all pages)</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>{presetGroups.slice(0, 2).flatMap((g) => g.items).map((s) => <Chip key={s.name} label={`${s.name} ${s.w}×${s.h}`} onPress={() => resize(s.w, s.h)} testID={`resize-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} />)}</ScrollView>
      <Row icon="resize" title="Custom resize" subtitle={`Current ${p.width}×${p.height}px`} onPress={async () => { const s = await promptText("New size (width x height)", `${p.width}x${p.height}`); const m = s?.match(/(\d+)\s*[x×]\s*(\d+)/); if (m) resize(Number(m[1]), Number(m[2])); }} testID="resize-custom" />
    </View>
  );
}
