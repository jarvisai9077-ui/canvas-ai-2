import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CanvasView } from "@/src/components/CanvasView";
import { Btn, Chip, ChipRow, Empty, Header, Section, Slider, T, Tool } from "@/src/components/ui";
import { defaultAdjust, filterPresets } from "@/src/engine/color";
import { newLayer, newPage, newProject } from "@/src/engine/factory";
import { captureWithCamera, hashFile, pickFromGallery } from "@/src/engine/media";
import { getState, saveAssets, saveProject, toast, uid, useStore } from "@/src/engine/store";
import type { Adjust, Layer } from "@/src/engine/types";
import { radius, spacing, useTheme } from "@/src/theme";

const sliders: [keyof Adjust, string, number, number][] = [
  ["exposure", "Exposure", -100, 100], ["brightness", "Brightness", -100, 100], ["contrast", "Contrast", -100, 100], ["saturation", "Saturation", -100, 100],
  ["temperature", "Temperature", -100, 100], ["tint", "Tint", -100, 100], ["hue", "Hue rotate", -180, 180], ["grayscale", "Black & white", 0, 100],
  ["sepia", "Sepia / faded", 0, 100], ["invert", "Invert", 0, 100], ["vignette", "Vignette", 0, 100], ["blur", "Blur", 0, 40],
];

export default function ImageLab() {
  const params = useLocalSearchParams<{ project?: string; page?: string; layer?: string }>(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors } = useTheme(); const { width } = useWindowDimensions(); const { projects } = useStore();
  const proj = projects.find((p) => p.id === params.project); const pi = Number(params.page ?? 0);
  const orig = proj?.pages[pi]?.layers.find((l) => l.id === params.layer);
  const [img, setImg] = useState<Layer | null>(orig ?? null); const [stack, setStack] = useState<Layer[]>([]);
  const [before, setBefore] = useState(false); const [busy, setBusy] = useState(false); const [tab, setTab] = useState<"adjust" | "filters" | "transform">("adjust");
  const adj = img?.adjust ?? defaultAdjust;
  const nw = img?.naturalW ?? 1000, nh = img?.naturalH ?? 750;
  const preview = useMemo(() => (img ? newPage("lab", "#00000000", [{ ...img, x: 0, y: 0, w: nw, h: nh, rotation: 0, opacity: 1, radius: 0, shadow: null, adjust: before ? undefined : img.adjust, flipX: img.flipX, flipY: img.flipY }]) : null), [img, before, nw, nh]);
  const load = async (camera: boolean) => {
    const a = (camera ? await captureWithCamera() : await pickFromGallery("image", false))[0]; if (!a) return;
    setImg(newLayer("image", { uri: a.uri, assetId: a.id, naturalW: a.width, naturalH: a.height, name: a.name, adjust: { ...defaultAdjust } })); setStack([]);
  };
  const setAdj = (patch: Partial<Adjust>) => setImg((l) => (l ? { ...l, adjust: { ...defaultAdjust, ...l.adjust, ...patch } } : l));
  const push = () => img && setStack((s) => [...s, img].slice(-30));
  // Destructive pixel operations run in the native image manipulator (off the JS thread) and write a new file.
  const op = async (label: string, f: (c: ReturnType<typeof ImageManipulator.manipulate>) => void) => {
    if (!img?.uri) return; setBusy(true); push();
    try {
      const ctx = ImageManipulator.manipulate(img.uri); f(ctx); const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      const asset = { id: uid(), name: `${label}-${img.name}`.slice(0, 40), uri: out.uri, kind: "image" as const, width: out.width, height: out.height, tags: ["image-lab"], license: "Own work", createdAt: Date.now(), hash: await hashFile(out.uri) };
      saveAssets([asset, ...getState().assets]);
      setImg({ ...img, uri: out.uri, assetId: asset.id, naturalW: out.width, naturalH: out.height }); toast(`${label} · ${out.width}×${out.height}`, "success");
    } catch (e: any) { toast(e?.message ?? `${label} failed`, "error"); }
    setBusy(false);
  };
  const crop = (ar: number) => op(`Crop ${ar.toFixed(2)}`, (c) => { const cw = nw / nh > ar ? nh * ar : nw, ch = nw / nh > ar ? nh : nw / ar; c.crop({ originX: (nw - cw) / 2, originY: (nh - ch) / 2, width: cw, height: ch }); });
  const save = () => {
    if (!img) return;
    if (proj && orig) {
      const ar = (img.naturalH ?? 1) / (img.naturalW ?? 1);
      saveProject({ ...proj, pages: proj.pages.map((pg, i) => (i === pi ? { ...pg, layers: pg.layers.map((l) => (l.id === orig.id ? { ...l, uri: img.uri, assetId: img.assetId, naturalW: img.naturalW, naturalH: img.naturalH, adjust: img.adjust, flipX: img.flipX, flipY: img.flipY, h: Math.abs(ar - orig.h / orig.w) > 0.01 ? l.w * ar : l.h } : l)) } : pg)), log: [{ t: Date.now(), label: "Image Lab edit" }, ...proj.log] });
      toast("Saved to design", "success"); router.back();
    } else {
      const p = newProject({ name: "Image Lab edit", kind: "design", width: nw, height: nh, category: "Photo" });
      p.pages[0].layers = [{ ...img, x: 0, y: 0, w: nw, h: nh }]; saveProject(p, { immediate: true }); toast("Saved as a new project", "success"); router.replace(`/editor/${p.id}`);
    }
  };
  const pw = Math.min(width - 32, (340 * nw) / nh);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="image-lab-screen">
      <Header title="Image Lab" subtitle={img ? `${nw}×${nh}px · ${img.name}` : "Non-destructive photo editing"} onBack={() => router.back()}
        right={img ? <Btn small label="Save" icon="checkmark" onPress={save} testID="image-lab-save-button" style={{ marginRight: 8 }} /> : undefined} />
      {!img || !preview ? (
        <Empty icon="aperture" title="Open a photo" text="Import from your gallery, screenshots, downloads or camera. Edits are processed on this device." action={<View style={{ gap: 10, width: 240 }}><Btn label="Choose photo" icon="images" onPress={() => load(false)} testID="image-lab-pick-button" /><Btn label="Take photo" kind="secondary" icon="camera" onPress={() => load(true)} testID="image-lab-camera-button" /></View>} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Pressable onPressIn={() => setBefore(true)} onPressOut={() => setBefore(false)} style={{ alignItems: "center", padding: spacing.md }} testID="image-lab-preview" accessibilityLabel="Hold to compare with original">
            <View style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.canvasBg }}><CanvasView page={preview} W={nw} H={nh} width={pw} /></View>
            {busy ? <ActivityIndicator style={{ position: "absolute", top: "45%" }} color={colors.brandPrimary} /> : null}
            <T v="muted" style={{ marginTop: 6 }} testID="image-lab-compare-label">{before ? "Showing original" : "Hold image to compare before / after"}</T>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: spacing.md }}>
            <Btn small kind="ghost" label="Undo" icon="arrow-undo" disabled={!stack.length} onPress={() => { const l = stack[stack.length - 1]; setStack(stack.slice(0, -1)); setImg(l); }} testID="image-lab-undo" />
            <Btn small kind="ghost" label="Reset adjustments" icon="refresh" onPress={() => { push(); setAdj({ ...defaultAdjust }); }} testID="image-lab-reset" />
          </View>
          <ChipRow>{(["adjust", "filters", "transform"] as const).map((t) => <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} testID={`image-lab-tab-${t}`} />)}</ChipRow>
          {tab === "adjust" ? sliders.map(([k, l, mn, mx]) => <Slider key={k} label={l} value={adj[k]} min={mn} max={mx} onChange={(v) => setAdj({ [k]: v })} onDone={() => push()} testID={`image-lab-${k}-slider`} />) : null}
          {tab === "filters" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.md }}>
              {Object.entries(filterPresets).map(([n, f]) => <Chip key={n} label={n} onPress={() => { push(); setAdj({ ...defaultAdjust, ...f }); }} testID={`image-lab-preset-${n.toLowerCase()}`} />)}
              <T v="muted" style={{ marginTop: 8 }}>“Restore” boosts faded colour and contrast with a deterministic colour matrix; it does not repair scratches or missing regions.</T>
            </View>
          ) : null}
          {tab === "transform" ? (
            <Section title="Pixel operations (writes a new file, original kept)">
              <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 }}>
                <Tool icon="refresh" label="Rotate 90°" onPress={() => op("Rotate", (c) => c.rotate(90))} testID="image-lab-rotate" />
                <Tool icon="swap-horizontal" label="Flip H" onPress={() => op("Flip", (c) => c.flip("horizontal" as any))} testID="image-lab-flip-h" />
                <Tool icon="swap-vertical" label="Flip V" onPress={() => op("Flip", (c) => c.flip("vertical" as any))} testID="image-lab-flip-v" />
                <Tool icon="crop" label="Crop 1:1" onPress={() => crop(1)} testID="image-lab-crop-1-1" />
                <Tool icon="crop" label="Crop 4:5" onPress={() => crop(4 / 5)} testID="image-lab-crop-4-5" />
                <Tool icon="crop" label="Crop 16:9" onPress={() => crop(16 / 9)} testID="image-lab-crop-16-9" />
                <Tool icon="crop" label="Crop 9:16" onPress={() => crop(9 / 16)} testID="image-lab-crop-9-16" />
                <Tool icon="contract" label="Resize 50%" onPress={() => op("Resize", (c) => c.resize({ width: Math.round(nw / 2) }))} testID="image-lab-resize-half" />
                <Tool icon="expand" label="Resample 2×" onPress={() => nw * 2 > 8000 ? toast("Result would exceed 8000px", "error") : op("Resample", (c) => c.resize({ width: nw * 2 }))} testID="image-lab-resample" />
              </View>
              <T v="muted" style={{ paddingHorizontal: spacing.md }}>Resample uses standard interpolation, not AI upscaling. Background removal, inpainting and AI enhancement need an optional local model (see Local AI Studio).</T>
            </Section>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
