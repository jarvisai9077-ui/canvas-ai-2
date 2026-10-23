import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Btn, Chip, ChipRow, Empty, Header, Input, Row, T } from "@/src/components/ui";
import { captureWithCamera, pickFiles, pickFromGallery } from "@/src/engine/media";
import { confirmAsk, promptText, saveAssets, saveProject, toast, useStore } from "@/src/engine/store";
import type { Asset } from "@/src/engine/types";
import { radius, spacing, useTheme } from "@/src/theme";

type Tab = "library" | "duplicates" | "dependencies" | "licences";

export default function Assets() {
  const params = useLocalSearchParams<{ tab?: Tab }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const { assets, projects, brands } = useStore(); const [tab, setTab] = useState<Tab>(params.tab ?? "library"); const [q, setQ] = useState("");
  const usage = (a: Asset) => projects.filter((p) => p.pages.some((pg) => pg.layers.some((l) => l.uri === a.uri)));
  const found = useMemo(() => assets.filter((a) => { const s = q.toLowerCase(); return !s || [a.name, a.kind, a.license, ...a.tags, a.width ? `${a.width}x${a.height}` : ""].join(" ").toLowerCase().includes(s); }), [assets, q]);
  const dupGroups = useMemo(() => Object.values(assets.reduce((m: Record<string, Asset[]>, a) => { if (a.hash) (m[a.hash] ??= []).push(a); return m; }, {})).filter((g) => g.length > 1), [assets]);
  const total = assets.reduce((s, a) => s + (a.size ?? 0), 0);
  const replaceEverywhere = async (a: Asset) => {
    const used = usage(a); if (!used.length) return toast("This asset is not used in any project");
    const n = (await pickFromGallery("image", false))[0]; if (!n) return;
    if (!(await confirmAsk({ title: "Update linked asset in all projects?", message: `${a.name} → ${n.name}. Each project gets a snapshot.`, items: used.map((p) => p.name), confirmLabel: `Update ${used.length}` }))) return;
    used.forEach((p) => saveProject({ ...p, snapshots: [{ id: Date.now().toString(36) + p.id, name: `Before replacing ${a.name}`, createdAt: Date.now(), pages: p.pages, width: p.width, height: p.height }, ...p.snapshots], pages: p.pages.map((pg) => ({ ...pg, layers: pg.layers.map((l) => (l.uri === a.uri ? { ...l, uri: n.uri, assetId: n.id, naturalW: n.width, naturalH: n.height } : l)) })) }));
    toast(`Updated ${used.length} project(s)`, "success");
  };
  const remove = async (a: Asset) => {
    const used = usage(a);
    if (!(await confirmAsk({ title: `Remove ${a.name} from library?`, message: used.length ? `Still used in ${used.length} project(s); those keep their copy of the file.` : "The file stays on disk until cache cleanup.", destructive: true, confirmLabel: "Remove" }))) return;
    saveAssets(assets.filter((x) => x.id !== a.id));
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="assets-screen">
      <Header title="Assets" subtitle={`${assets.length} items · ${(total / 1e6).toFixed(1)} MB`} onBack={() => router.back()} />
      <ChipRow>{(["library", "duplicates", "dependencies", "licences"] as Tab[]).map((t) => <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} testID={`assets-tab-${t}`} />)}</ChipRow>
      {tab === "library" ? (
        <>
          <View style={{ paddingHorizontal: spacing.md, gap: 8 }}>
            <Input value={q} onChangeText={setQ} placeholder="Search by name, tag, type, size, licence" testID="assets-search-input" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn small label="Photos" icon="images" onPress={() => pickFromGallery("image")} testID="assets-import-photos" />
              <Btn small kind="secondary" label="Camera" icon="camera" onPress={() => captureWithCamera()} testID="assets-import-camera" />
              <Btn small kind="secondary" label="Files" icon="folder" onPress={() => pickFiles()} testID="assets-import-files" />
            </View>
          </View>
          <FlatList data={found} keyExtractor={(a) => a.id} contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 8 }}
            ListEmptyComponent={<Empty icon="folder-open" title="No assets" text="Imported media is copied into private app storage so your projects never break." />}
            renderItem={({ item }) => (
              <Row title={item.name} subtitle={`${item.kind}${item.width ? ` · ${item.width}×${item.height}` : ""}${item.size ? ` · ${(item.size / 1e6).toFixed(1)} MB` : ""} · used in ${usage(item).length}${item.tags.length ? ` · #${item.tags.join(" #")}` : ""}`} testID={`asset-row-${item.id}`}
                right={<View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {item.kind === "image" ? <Image source={{ uri: item.uri }} style={{ width: 40, height: 40, borderRadius: 8 }} /> : null}
                  <Btn small kind="ghost" label="Tag" onPress={async () => { const t = await promptText("Tags", item.tags.join(", ")); if (t !== null) saveAssets(assets.map((a) => (a.id === item.id ? { ...a, tags: t.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) } : a))); }} testID={`asset-tag-${item.id}`} />
                  {item.kind === "image" ? <Btn small kind="ghost" label="Replace" onPress={() => replaceEverywhere(item)} testID={`asset-replace-${item.id}`} /> : null}
                  <Btn small kind="ghost" label="✕" onPress={() => remove(item)} testID={`asset-remove-${item.id}`} />
                </View>} />
            )} />
        </>
      ) : null}
      {tab === "duplicates" ? (
        <FlatList data={dupGroups} keyExtractor={(g) => g[0].hash!} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<Empty icon="checkmark-done" title="No exact duplicates" text="Files are compared with SHA-256 hashes. Visual similarity search is not available." />}
          renderItem={({ item }) => (
            <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: 6 }} testID={`dup-group-${item[0].id}`}>
              <T v="h3">{item.length} identical files</T>{item.map((a) => <T key={a.id} v="small">• {a.name} · used in {usage(a).length}</T>)}
              <Btn small label="Keep first, remove unused copies" onPress={async () => { const extra = item.slice(1).filter((a) => !usage(a).length); if (!extra.length) return toast("All copies are in use"); if (await confirmAsk({ title: `Remove ${extra.length} unused duplicate(s)?`, items: extra.map((a) => a.name), confirmLabel: "Remove" })) saveAssets(assets.filter((a) => !extra.includes(a))); }} testID={`dup-clean-${item[0].id}`} />
            </View>
          )} />
      ) : null}
      {tab === "dependencies" ? (
        <FlatList data={projects.filter((p) => !p.trashed)} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item: p }) => {
            const imgs = [...new Set(p.pages.flatMap((pg) => pg.layers.filter((l) => l.type === "image").map((l) => l.uri ?? "missing")))];
            const fontsUsed = [...new Set(p.pages.flatMap((pg) => pg.layers.filter((l) => l.fontFamily).map((l) => l.fontFamily!)))];
            const brand = brands.find((b) => b.id === p.brandId); const shared = imgs.filter((u) => projects.some((o) => o.id !== p.id && o.pages.some((pg) => pg.layers.some((l) => l.uri === u))));
            return (
              <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: 4 }} testID={`deps-${p.id}`}>
                <T v="h3">{p.name}</T>
                <T v="small">├─ Images: {imgs.length ? imgs.map((u) => assets.find((a) => a.uri === u)?.name ?? (u === "missing" ? "MISSING" : u.split("/").pop())).join(", ") : "none"}</T>
                <T v="small">├─ Fonts: {fontsUsed.join(", ") || "none"}</T>
                <T v="small">├─ Brand: {brand?.name ?? "none"}</T>
                <T v="small">├─ Experiment of: {projects.find((o) => o.id === p.parentId)?.name ?? "—"}</T>
                <T v="small">└─ Shared assets with other projects: {shared.length}</T>
                {shared.length ? <Badge text="Cross-project dependency" tone="warning" /> : null}
              </View>
            );
          }} />
      ) : null}
      {tab === "licences" ? (
        <FlatList data={assets} keyExtractor={(a) => a.id} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<Empty icon="document-lock" title="No assets" text="Licence information you record appears here." />}
          renderItem={({ item }) => <Row title={item.name} subtitle={`Licence: ${item.license}`} onPress={async () => { const l = await promptText("Licence / source", item.license, { placeholder: "e.g. Own work, CC BY 4.0, Purchased from…" }); if (l !== null) saveAssets(assets.map((a) => (a.id === item.id ? { ...a, license: l } : a))); }} testID={`licence-row-${item.id}`} />} />
      ) : null}
    </View>
  );
}
