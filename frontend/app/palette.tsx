import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Input, Row, Section, T } from "@/src/components/ui";
import { isHex } from "@/src/engine/color";
import { smartResize } from "@/src/engine/geometry";
import { confirmAsk, duplicateProject, getProject, getState, pushRecentCommand, saveProject, toast, uid, useStore } from "@/src/engine/store";
import type { Project } from "@/src/engine/types";
import { projectRoute } from "@/src/navigation";
import { spacing, useTheme } from "@/src/theme";

type Cmd = { id: string; label: string; hint: string; icon: any; needsProject?: boolean; run: (arg: string, p?: Project) => void | Promise<void> };

// Creative Command Palette: deterministic commands mapped to real operations.
export default function Palette() {
  const { project } = useLocalSearchParams<{ project?: string }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const { projects, settings } = useStore(); const [q, setQ] = useState("");
  const cur = project ? getProject(project) : projects.find((p) => !p.trashed);
  const cmds: Cmd[] = useMemo(() => [
    { id: "resize", label: "Resize this design to WxH", hint: "e.g. “resize 1080x1920”", icon: "resize", needsProject: true, run: async (a, p) => {
      const m = a.match(/(\d+)\s*[x×]\s*(\d+)/); if (!m || !p) return toast("Type a size, e.g. resize 1080x1920", "error");
      const w = Number(m[1]), h = Number(m[2]); if (!(await confirmAsk({ title: `Resize “${p.name}” to ${w}×${h}?`, message: `${p.pages.length} page(s) will be smart-resized. A snapshot is saved first.`, confirmLabel: "Resize" }))) return;
      saveProject({ ...p, width: w, height: h, pages: p.pages.map((pg) => smartResize(pg, p.width, p.height, w, h)), snapshots: [{ id: uid(), name: `Before resize to ${w}×${h}`, createdAt: Date.now(), pages: p.pages, width: p.width, height: p.height }, ...p.snapshots] }); toast("Resized", "success"); } },
    { id: "recolor", label: "Replace colour #AAAAAA with #BBBBBB", hint: "e.g. “replace #FF5E00 with #1E88E5”", icon: "color-fill", needsProject: true, run: async (a, p) => {
      const m = a.match(/(#[0-9a-fA-F]{6}).*(#[0-9a-fA-F]{6})/); if (!m || !p || !isHex(m[1]) || !isHex(m[2])) return toast("Type two hex colours", "error");
      const affected = p.pages.flatMap((pg) => pg.layers.filter((l) => l.fill?.toUpperCase() === m[1].toUpperCase() || l.stroke?.toUpperCase() === m[1].toUpperCase()).map((l) => `${pg.name}: ${l.name}`));
      if (!affected.length) return toast(`No objects use ${m[1]}`);
      if (!(await confirmAsk({ title: `Replace ${m[1]} → ${m[2]}?`, items: affected, confirmLabel: "Replace" }))) return;
      const sw = (c?: string) => (c?.toUpperCase() === m[1].toUpperCase() ? m[2] : c);
      saveProject({ ...p, pages: p.pages.map((pg) => ({ ...pg, background: sw(pg.background)!, layers: pg.layers.map((l) => ({ ...l, fill: sw(l.fill), stroke: sw(l.stroke) })) })), snapshots: [{ id: uid(), name: "Before colour replace", createdAt: Date.now(), pages: p.pages, width: p.width, height: p.height }, ...p.snapshots] }); toast(`Replaced in ${affected.length} objects`, "success"); } },
    { id: "alts", label: "Create three alternative layouts", hint: "Mirrored, centred and swapped-colour variants as new projects", icon: "copy", needsProject: true, run: (_a, p) => {
      if (!p) return; const W = p.width;
      const mk = (name: string, f: (l: any) => any) => duplicateProject({ ...p, pages: p.pages.map((pg) => ({ ...pg, layers: pg.layers.map(f) })) }, `${p.name} · ${name}`);
      mk("mirrored", (l) => (l.x <= 1 && l.w >= W - 2 ? l : { ...l, x: W - l.x - l.w, align: l.align === "start" ? "end" : l.align === "end" ? "start" : l.align }));
      mk("centred", (l) => (l.type === "text" ? { ...l, x: (W - l.w) / 2, align: "middle" } : l));
      mk("dark", (l) => (l.type === "text" ? { ...l, fill: l.fill === "#FFFFFF" ? "#1C1C1E" : "#FFFFFF" } : l));
      toast("3 variants created · compare them in Projects", "success"); } },
    { id: "overflow", label: "Find text overflow & design problems", hint: "Opens Design Doctor", icon: "medkit", needsProject: true, run: (_a, p) => p && router.replace(`/doctor/${p.id}`) },
    { id: "missing", label: "Locate missing assets / integrity scan", hint: "Design Doctor integrity scanner", icon: "search", needsProject: true, run: (_a, p) => p && router.replace(`/doctor/${p.id}`) },
    { id: "brand", label: "Apply saved brand colours", hint: "Brand Studio", icon: "ribbon", needsProject: true, run: (_a, p) => router.replace(`/brand?project=${p?.id ?? ""}`) },
    { id: "export", label: "Prepare export sizes / print preflight", hint: "Export with preflight report", icon: "share", needsProject: true, run: (_a, p) => p && router.replace(`/export/${p.id}`) },
    { id: "dup", label: "Duplicate this version", hint: "Saves a named snapshot", icon: "camera", needsProject: true, run: (_a, p) => { if (!p) return; saveProject({ ...p, snapshots: [{ id: uid(), name: `Snapshot ${new Date().toLocaleString()}`, createdAt: Date.now(), pages: p.pages, width: p.width, height: p.height }, ...p.snapshots] }, { touch: false }); toast("Snapshot saved", "success"); } },
    { id: "compare", label: "Compare design variants", hint: "Variant wall & version diff", icon: "git-compare", needsProject: true, run: (_a, p) => p && router.replace(`/history/${p.id}`) },
    { id: "check", label: "Create a production checklist", hint: "Checklist & comments", icon: "checkbox", needsProject: true, run: (_a, p) => p && router.replace(`/checklist/${p.id}`) },
    { id: "dups", label: "Find duplicate files", hint: "SHA-256 duplicate detection in Assets", icon: "albums", run: () => router.replace("/library?tab=duplicates") },
    { id: "deps", label: "Inspect project dependencies", hint: "Dependency graph in Assets", icon: "git-network", run: () => router.replace("/library?tab=dependencies") },
    { id: "batch", label: "Batch create from CSV / multi-size", hint: "Business & Automation Factory", icon: "construct", run: () => router.replace("/factory") },
    { id: "new", label: "New design", hint: "Choose size or preset", icon: "add", run: () => router.replace("/create") },
    { id: "lab", label: "Open Image Lab", hint: "Photo adjustments", icon: "aperture", run: () => router.replace("/image-lab") },
    { id: "settings", label: "Settings, backup & restore", hint: "", icon: "settings", run: () => router.replace("/settings") },
    { id: "registry", label: "Feature registry", hint: "Status of every feature", icon: "list", run: () => router.replace("/registry") },
    ...projects.filter((p) => !p.trashed).slice(0, 30).map((p) => ({ id: "open-" + p.id, label: `Open “${p.name}”`, hint: `${p.kind} · ${p.width}×${p.height}`, icon: "open", run: () => router.replace(projectRoute(p)) })),
  ], [projects]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = cmds.filter((c) => !words.length || words.some((w) => !w.startsWith("#") && !/^\d/.test(w) && w.length > 1 && (c.label + c.hint + c.id).toLowerCase().includes(w)));
  const recent = settings.recentCommands.map((id) => cmds.find((c) => c.id === id)).filter(Boolean) as Cmd[];
  const run = (c: Cmd) => { if (c.needsProject && !cur) return toast("Create or open a project first", "error"); pushRecentCommand(c.id); c.run(q, getProject(cur?.id ?? "") ?? getState().projects[0]); };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="palette-screen">
      <Header title="Command palette" subtitle={cur ? `Context: ${cur.name}` : "No project open"} onBack={() => router.back()} />
      <View style={{ padding: spacing.md }}><Input value={q} onChangeText={setQ} placeholder="Type a command, e.g. resize 1080x1350" testID="palette-input" /></View>
      <FlatList data={filtered} keyExtractor={(c) => c.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={!q && recent.length ? <Section title="Recent">{recent.map((c) => <Row key={"r" + c.id} icon={c.icon} title={c.label} subtitle={c.hint} onPress={() => run(c)} testID={`palette-recent-${c.id}`} />)}</Section> : undefined}
        ListEmptyComponent={<T v="muted" style={{ textAlign: "center", marginTop: 24 }}>No matching command.</T>}
        renderItem={({ item }) => <Row icon={item.icon} title={item.label} subtitle={item.hint} onPress={() => run(item)} testID={`palette-cmd-${item.id}`} />} />
    </View>
  );
}
