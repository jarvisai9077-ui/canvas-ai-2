import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Card, Chip, ChipRow, Header, Input, Row, Section, T } from "@/src/components/ui";
import { exportPDF, fileName, share, writeText } from "@/src/engine/exporter";
import { newLayer, newPage, newProject, presetGroups } from "@/src/engine/factory";
import { smartResize } from "@/src/engine/geometry";
import { pickTextFile } from "@/src/engine/media";
import { confirmAsk, duplicateProject, getState, saveProject, toast, uid, useStore } from "@/src/engine/store";
import type { Layer, Page, Project } from "@/src/engine/types";
import { spacing, useTheme } from "@/src/theme";

type Tool = "variations" | "multisize" | "batch" | "report" | "sheet" | "stationery" | "delivery";
export function parseCSV(t: string): string[][] {
  return t.trim().split(/\r?\n/).filter(Boolean).map((line) => { const out: string[] = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out; });
}
const fill = (pages: Page[], row: Record<string, string>) => pages.map((pg) => ({ ...pg, id: uid(), layers: pg.layers.map((l) => { const r = (s?: string) => s?.replace(/\{\{(\w+)\}\}/g, (_, k) => row[k] ?? `{{${k}}}`); return { ...l, id: uid(), text: r(l.text), value: r(l.value), name: r(l.name) ?? l.name }; }) }));

export default function Factory() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme(); const { projects } = useStore();
  const live = projects.filter((p) => !p.trashed && p.kind !== "video");
  const [tool, setTool] = useState<Tool>("variations"); const [src, setSrc] = useState<string | null>(live[0]?.id ?? null);
  const [csv, setCsv] = useState("name,course,date,title,price,id,role\nAva Chen,Design Basics,12 June 2026,Citrus Cold Brew,$4.50,A-001,Designer\nLeo Park,Typography,12 June 2026,Mango Tea,$3.90,A-002,Editor");
  const [sizes, setSizes] = useState<string[]>([]); const [find, setFind] = useState(""); const [repl, setRepl] = useState(""); const [picked, setPicked] = useState<string[]>([]);
  const [grid, setGrid] = useState("2x4"); const [event, setEvent] = useState("Maya & Leo"); const [edate, setEdate] = useState("12 September 2026"); const [busy, setBusy] = useState(false);
  const p = live.find((x) => x.id === src);
  const tokens = p ? [...new Set(p.pages.flatMap((pg) => pg.layers.flatMap((l) => [...(l.text ?? "").matchAll(/\{\{(\w+)\}\}/g), ...(l.value ?? "").matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))))] : [];
  const loadCSV = async () => { const f = await pickTextFile(["text/csv", "text/comma-separated-values", "text/plain", "*/*"]); if (f) setCsv(f.text); };

  const runVariations = async () => {
    if (!p) return; const rows = parseCSV(csv); const head = rows[0]; const data = rows.slice(1);
    if (!tokens.length) return toast("This project has no {{tokens}} — add text like {{name}} first", "error");
    if (!(await confirmAsk({ title: `Create ${data.length} projects?`, message: `Tokens: ${tokens.join(", ")}`, items: data.map((r) => r.join(" · ")), confirmLabel: "Create" }))) return;
    data.forEach((r, i) => { const row = Object.fromEntries(head.map((h, k) => [h, r[k] ?? ""])); duplicateProject({ ...p, pages: fill(p.pages, row), snapshots: [], history: [] }, `${p.name} · ${r[0] || i + 1}`, { folder: `${p.name} batch` }); });
    toast(`Created ${data.length} projects in folder “${p.name} batch”`, "success");
  };
  const runMulti = () => {
    if (!p || !sizes.length) return toast("Pick a source and at least one size", "error");
    const all = presetGroups.flatMap((g) => g.items); sizes.forEach((n) => { const s = all.find((x) => x.name === n)!; duplicateProject({ ...p, width: s.w, height: s.h, pages: p.pages.map((pg) => smartResize(pg, p.width, p.height, s.w, s.h)) }, `${p.name} · ${s.name}`, { folder: `${p.name} sizes` }); });
    toast(`Generated ${sizes.length} sizes`, "success");
  };
  const runBatch = async () => {
    const targets = live.filter((x) => picked.includes(x.id)); if (!targets.length || !find) return toast("Select projects and enter text or #colour to find", "error");
    const isColor = /^#[0-9a-f]{6}$/i.test(find);
    const hits = targets.map((t) => ({ t, n: t.pages.flatMap((pg) => pg.layers).filter((l) => (isColor ? l.fill?.toUpperCase() === find.toUpperCase() : l.text?.includes(find))).length })).filter((x) => x.n);
    if (!hits.length) return toast("No matches found");
    if (!(await confirmAsk({ title: `Replace “${find}” → “${repl}”?`, message: "Each project gets a rollback snapshot.", items: hits.map((h) => `${h.t.name}: ${h.n} object(s)`), confirmLabel: "Replace" }))) return;
    hits.forEach(({ t }) => saveProject({ ...t, snapshots: [{ id: uid(), name: "Before batch replace", createdAt: Date.now(), pages: t.pages, width: t.width, height: t.height }, ...t.snapshots], pages: t.pages.map((pg) => ({ ...pg, layers: pg.layers.map((l) => (isColor ? (l.fill?.toUpperCase() === find.toUpperCase() ? { ...l, fill: repl } : l) : l.text?.includes(find) ? { ...l, text: l.text.split(find).join(repl) } : l)) })) }));
    toast(`Updated ${hits.length} projects`, "success");
  };
  const runReport = () => {
    const rows = parseCSV(csv); if (rows.length < 2) return toast("CSV needs a header and at least one row", "error");
    const num = rows[0].findIndex((_, k) => rows.slice(1).every((r) => !isNaN(Number(String(r[k]).replace(/[$,%]/g, ""))) && r[k] !== ""));
    const W = 1240, H = 1754; const layers: Layer[] = [newLayer("text", { text: "Data Report", x: 90, y: 80, w: 1060, fontSize: 80, fontFamily: "Jakarta-800" }), newLayer("text", { text: `${rows.length - 1} rows · generated ${new Date().toLocaleDateString()}`, x: 90, y: 190, w: 1060, fontSize: 30, fill: "#8E8E93" })];
    if (num >= 0) layers.push(newLayer("chart", { x: 90, y: 280, w: 1060, h: 560, fontSize: 24, data: { labels: rows.slice(1).map((r) => r[0]), values: rows.slice(1).map((r) => Number(String(r[num]).replace(/[$,%]/g, ""))) } }));
    layers.push(newLayer("table", { x: 90, y: num >= 0 ? 900 : 280, w: 1060, h: Math.min(780, rows.length * 64), fontSize: 22, rows: rows.slice(0, 13).map((r) => r.slice(0, 5)) }));
    const np = newProject({ name: "CSV Report", kind: "document", width: W, height: H, category: "Report", pages: [newPage("Report", "#FFFFFF", layers)] }); saveProject(np, { immediate: true }); router.push(`/editor/${np.id}`);
  };
  const runSheet = () => {
    if (!p) return; const [c, r] = grid.split("x").map(Number); const W = 2480, H = 3508, m = 120; const cw = (W - m * 2) / c, ch = (H - m * 2) / r; const s = Math.min(cw / p.width, ch / p.height) * 0.94;
    const layers: Layer[] = []; for (let i = 0; i < c * r; i++) { const ox = m + (i % c) * cw + (cw - p.width * s) / 2, oy = m + Math.floor(i / c) * ch + (ch - p.height * s) / 2;
      layers.push(newLayer("rect", { x: ox, y: oy, w: p.width * s, h: p.height * s, fill: p.pages[0].background, stroke: "#C7C7CC", strokeWidth: 2, dash: true, name: `Cell ${i + 1}` }));
      p.pages[0].layers.forEach((l) => layers.push({ ...l, id: uid(), x: ox + l.x * s, y: oy + l.y * s, w: l.w * s, h: l.h * s, fontSize: l.fontSize ? l.fontSize * s : undefined, strokeWidth: l.strokeWidth ? l.strokeWidth * s : l.strokeWidth, cutLine: l.cutLine ? l.cutLine * s : l.cutLine })); }
    const np = newProject({ name: `${p.name} · print sheet ${grid}`, kind: "document", width: W, height: H, dpi: 300, unit: "mm", category: "Print sheet", pages: [newPage("Sheet", "#FFFFFF", layers)] }); saveProject(np, { immediate: true }); router.push(`/editor/${np.id}`);
  };
  const runStationery = () => {
    const T = (t: string, y: number, size: number, f = "Jakarta-400", c = "#1C1C1E") => newLayer("text", { text: t, x: 80, y, w: 1340, fontSize: size, fontFamily: f, fill: c, align: "middle" });
    const frame = () => newLayer("rect", { x: 40, y: 40, w: 1420, h: 2020, fill: "#FFF0E6", stroke: "#C9A27E", strokeWidth: 4, name: "Frame" });
    const pages = [
      newPage("Invitation", "#FFF0E6", [frame(), T("You are invited", 400, 56, "Jakarta-600", "#8E8E93"), T(event, 600, 150, "Playfair-700"), T(edate.toUpperCase(), 1000, 56, "Jakarta-800", "#FF5E00")]),
      newPage("RSVP", "#FFF0E6", [frame(), T("RSVP", 400, 120, "Playfair-700"), T(`Kindly reply for ${event}`, 650, 48), T("Name ____________________\n\n□ Joyfully accepts   □ Regretfully declines", 900, 44)]),
      newPage("Menu", "#FFF0E6", [frame(), T("Menu", 300, 130, "Playfair-700"), T("Starter\nMain course\nDessert", 600, 64, "Jakarta-600"), T(event, 1800, 40, "Jakarta-400", "#8E8E93")]),
      newPage("Place card", "#FFF0E6", [frame(), T("{{guest}}", 900, 140, "Playfair-700"), T(event, 1200, 44, "Jakarta-400", "#8E8E93")]),
      newPage("Thank you", "#FFF0E6", [frame(), T("Thank you", 700, 160, "Playfair-700"), T(`for celebrating with us · ${edate}`, 1000, 48)]),
    ];
    const np = newProject({ name: `${event} stationery`, kind: "document", width: 1500, height: 2100, category: "Event stationery", pages }); saveProject(np, { immediate: true }); router.push(`/editor/${np.id}`);
  };
  const runDelivery = async () => {
    if (!p) return; setBusy(true);
    try {
      const pdf = await exportPDF(p, "{name}_delivery_{date}"); const pkg = await writeText(p, JSON.stringify({ app: "RF Canvas", version: 1, createdAt: Date.now(), projects: [p], assets: getState().assets.filter((a) => p.pages.some((pg) => pg.layers.some((l) => l.uri === a.uri))), brands: [] }), "json", fileName("{name}_source_{date}", p, "rfcanvas.json"));
      const manifest = await writeText(p, JSON.stringify({ project: p.name, size: `${p.width}x${p.height}`, pages: p.pages.map((pg) => pg.name), files: [pdf, pkg].map((r) => ({ name: r.name, size: r.size, valid: r.valid })), fonts: [...new Set(p.pages.flatMap((pg) => pg.layers.map((l) => l.fontFamily).filter(Boolean)))], assets: getState().assets.filter((a) => p.pages.some((pg) => pg.layers.some((l) => l.uri === a.uri))).map((a) => ({ name: a.name, license: a.license })), usage: "Final artwork for client delivery. Edit the source package in RF Canvas." }, null, 2), "json", fileName("{name}_manifest_{date}", p, "json"));
      const all = [pdf, pkg, manifest]; toast(all.every((r) => r.valid) ? "Delivery package written and verified" : "Some files failed validation", all.every((r) => r.valid) ? "success" : "error");
      if (pdf.uri.startsWith("file")) share(pdf.uri);
    } catch (e: any) { toast(e?.message ?? "Packaging failed", "error"); }
    setBusy(false);
  };
  const tools: [Tool, string][] = [["variations", "Product / certificate / ID factory"], ["multisize", "Publish everywhere"], ["batch", "Batch replace"], ["report", "CSV report"], ["sheet", "Print sheet"], ["stationery", "Event stationery"], ["delivery", "Client delivery"]];
  const Source = () => <Section title="Source project"><ChipRow>{live.map((x) => <Chip key={x.id} label={x.name} active={src === x.id} onPress={() => setSrc(x.id)} testID={`factory-source-${x.id}`} />)}</ChipRow>{!live.length ? <T v="muted" style={{ paddingHorizontal: spacing.md }}>Create a project first (templates with {"{{tokens}}"}: Certificate, Staff ID Card, Product Ad).</T> : null}</Section>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="factory-screen">
      <Header title="Business & Automation Factory" subtitle="Batch creation from real project data" onBack={() => router.back()} />
      <ChipRow>{tools.map(([k, l]) => <Chip key={k} label={l} active={tool === k} onPress={() => setTool(k)} testID={`factory-tool-${k}`} />)}</ChipRow>
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {tool === "variations" ? <><Source /><Card style={{ padding: spacing.md, gap: 10 }}><T v="small">Tokens found: {tokens.length ? tokens.map((t) => `{{${t}}}`).join(" ") : "none"}</T><Input label="CSV data (first row = token names)" multiline value={csv} onChangeText={setCsv} testID="factory-csv-input" /><View style={{ flexDirection: "row", gap: 8 }}><Btn small kind="secondary" label="Load CSV file" icon="document" onPress={loadCSV} testID="factory-load-csv" /><Btn small label="Generate projects" icon="construct" onPress={runVariations} testID="factory-run-variations" /></View></Card></> : null}
        {tool === "multisize" ? <><Source /><Section title="Target sizes"><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.md }}>{presetGroups.slice(0, 2).flatMap((g) => g.items).map((s) => <Chip key={s.name} label={`${s.name}`} active={sizes.includes(s.name)} onPress={() => setSizes(sizes.includes(s.name) ? sizes.filter((x) => x !== s.name) : [...sizes, s.name])} testID={`factory-size-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`} />)}</View></Section><View style={{ padding: spacing.md }}><Btn label={`Generate ${sizes.length} sizes`} onPress={runMulti} testID="factory-run-multisize" /></View></> : null}
        {tool === "batch" ? <><Section title="Projects"><Card>{live.map((x) => <Row key={x.id} title={x.name} onPress={() => setPicked(picked.includes(x.id) ? picked.filter((y) => y !== x.id) : [...picked, x.id])} right={<T>{picked.includes(x.id) ? "✓" : ""}</T>} testID={`factory-pick-${x.id}`} />)}</Card></Section><View style={{ padding: spacing.md, gap: 8 }}><Input label="Find (text or #RRGGBB)" value={find} onChangeText={setFind} testID="factory-find-input" /><Input label="Replace with" value={repl} onChangeText={setRepl} testID="factory-replace-input" /><Btn label="Preview & replace" onPress={runBatch} testID="factory-run-batch" /></View></> : null}
        {tool === "report" ? <Card style={{ marginTop: spacing.md, padding: spacing.md, gap: 10 }}><T v="small">First column = labels; the first fully numeric column becomes an editable chart; up to 12 rows become an editable table.</T><Input label="CSV" multiline value={csv} onChangeText={setCsv} testID="factory-report-csv" /><View style={{ flexDirection: "row", gap: 8 }}><Btn small kind="secondary" label="Load CSV file" onPress={loadCSV} testID="factory-report-load" /><Btn small label="Build report" onPress={runReport} testID="factory-run-report" /></View></Card> : null}
        {tool === "sheet" ? <><Source /><Section title="Layout (A4, 300 dpi)"><ChipRow>{["1x2", "2x2", "2x4", "3x3", "3x5", "4x6"].map((g) => <Chip key={g} label={`${g.replace("x", " × ")}`} active={grid === g} onPress={() => setGrid(g)} testID={`factory-grid-${g}`} />)}</ChipRow></Section><View style={{ padding: spacing.md }}><Btn label="Arrange print sheet" onPress={runSheet} testID="factory-run-sheet" /></View></> : null}
        {tool === "stationery" ? <View style={{ padding: spacing.md, gap: 10 }}><Input label="Event / couple name" value={event} onChangeText={setEvent} testID="factory-event-input" /><Input label="Date" value={edate} onChangeText={setEdate} testID="factory-date-input" /><Btn label="Create coordinated suite (5 pieces)" onPress={runStationery} testID="factory-run-stationery" /></View> : null}
        {tool === "delivery" ? <><Source /><View style={{ padding: spacing.md, gap: 8 }}><T v="small">Writes a print PDF, the editable source package and a manifest (files, fonts, asset licences, usage notes), validating each file.</T><Btn label="Build delivery package" icon="briefcase" loading={busy} onPress={runDelivery} testID="factory-run-delivery" /></View></> : null}
      </KeyboardAwareScrollView>
    </View>
  );
}
