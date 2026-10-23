// Deterministic local design intelligence: Design Doctor, composition, score, complexity, integrity, preflight.
import * as FS from "expo-file-system/legacy";
import { Platform } from "react-native";
import { colorDistance, contrastRatio, hexToRgb, nearest } from "./color";
import { textBlockHeight, wrapText, CHAR_W } from "./geometry";
import type { Brand, Layer, Page, Project } from "./types";

export interface Issue { id: string; severity: "error" | "warn" | "info"; category: string; title: string; detail: string; layerIds: string[]; fix?: { label: string; apply: (p: Page) => Page } }

const bgUnder = (page: Page, l: Layer) => {
  const idx = page.layers.indexOf(l);
  for (let i = idx - 1; i >= 0; i--) {
    const b = page.layers[i];
    if (!b.visible || !["rect", "ellipse", "polygon", "star", "note"].includes(b.type)) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h && b.opacity > 0.6) return b.gradient ? b.gradient.from : b.fill ?? page.background;
  }
  return page.background;
};
const mapLayer = (p: Page, id: string, f: (l: Layer) => Layer): Page => ({ ...p, layers: p.layers.map((l) => (l.id === id ? f(l) : l)) });

export function analyzeDesign(project: Project, pageIndex: number, brand?: Brand | null) {
  const page = project.pages[pageIndex]; const W = project.width, H = project.height; const issues: Issue[] = [];
  const vis = page.layers.filter((l) => l.visible);
  const texts = vis.filter((l) => l.type === "text");
  for (const t of texts) {
    const bg = bgUnder(page, t); const fg = t.fill ?? "#000";
    if (hexToRgb(bg) && hexToRgb(fg)) {
      const cr = contrastRatio(fg, bg); const large = (t.fontSize ?? 24) >= W * 0.03;
      if (cr < (large ? 3 : 4.5)) {
        const better = contrastRatio("#1C1C1E", bg) > contrastRatio("#FFFFFF", bg) ? "#1C1C1E" : "#FFFFFF";
        issues.push({ id: "contrast-" + t.id, severity: cr < 2 ? "error" : "warn", category: "Readability", title: `Low contrast (${cr.toFixed(1)}:1)`, detail: `“${(t.text ?? "").slice(0, 30)}” is ${fg} on ${bg}. WCAG asks for ${large ? "3" : "4.5"}:1.`, layerIds: [t.id], fix: { label: `Use ${better}`, apply: (p) => mapLayer(p, t.id, (l) => ({ ...l, fill: better })) } });
      }
    }
    const lines = wrapText(t.text ?? "", t.w, t.fontSize ?? 24, t.letterSpacing);
    const longest = Math.max(...(t.text ?? "").split(/\s|\n/).map((w) => w.length));
    if (longest * (t.fontSize ?? 24) * CHAR_W > t.w + 2) issues.push({ id: "overflow-" + t.id, severity: "warn", category: "Text overflow", title: "Word wider than its text box", detail: `A word in “${(t.text ?? "").slice(0, 24)}” cannot fit on one line and will overflow.`, layerIds: [t.id], fix: { label: "Widen box", apply: (p) => mapLayer(p, t.id, (l) => ({ ...l, w: Math.min(W - l.x, longest * (l.fontSize ?? 24) * CHAR_W + 8) })) } });
    const bh = textBlockHeight(t);
    if (t.y + bh > H || t.x + t.w > W + 1 || t.x < -1) issues.push({ id: "clip-" + t.id, severity: "error", category: "Clipping", title: "Text is clipped by the canvas edge", detail: `${lines.length} line(s) extend beyond the artboard.`, layerIds: [t.id], fix: { label: "Move inside", apply: (p) => mapLayer(p, t.id, (l) => ({ ...l, x: Math.max(0, Math.min(l.x, W - l.w)), y: Math.max(0, Math.min(l.y, H - bh)) })) } });
    if ((t.fontSize ?? 24) < Math.min(W, H) * 0.018) issues.push({ id: "tiny-" + t.id, severity: "info", category: "Typography", title: "Very small text", detail: `${t.fontSize}px may be unreadable at thumbnail size.`, layerIds: [t.id], fix: { label: "Increase size", apply: (p) => mapLayer(p, t.id, (l) => ({ ...l, fontSize: Math.round(Math.min(W, H) * 0.025) })) } });
  }
  for (const l of vis) {
    if (l.type !== "text" && (l.x + l.w < 0 || l.y + l.h < 0 || l.x > W || l.y > H)) issues.push({ id: "off-" + l.id, severity: "warn", category: "Layout", title: `${l.name} is completely off-canvas`, detail: "It will not appear in exports.", layerIds: [l.id], fix: { label: "Hide layer", apply: (p) => mapLayer(p, l.id, (x) => ({ ...x, visible: false })) } });
    if (l.type === "image" && l.naturalW && l.naturalW < l.w * 0.9) issues.push({ id: "lowres-" + l.id, severity: "warn", category: "Resolution", title: "Low-resolution image", detail: `Source is ${l.naturalW}px wide but displayed at ${Math.round(l.w)}px (upscaled ${Math.round((l.w / l.naturalW) * 100)}%).`, layerIds: [l.id] });
    if (l.type === "image" && !l.uri) issues.push({ id: "missing-" + l.id, severity: "error", category: "Assets", title: "Missing image", detail: "Relink this image from Assets.", layerIds: [l.id] });
    if (l.opacity < 0.05) issues.push({ id: "invisible-" + l.id, severity: "info", category: "Layers", title: `${l.name} is nearly invisible`, detail: "Opacity below 5%.", layerIds: [l.id] });
    const m = Math.min(W, H) * 0.03;
    if (l.type === "text" && (l.x < m || l.x + l.w > W - m) && l.x > -1) issues.push({ id: "margin-" + l.id, severity: "info", category: "Spacing", title: "Text sits inside the safe margin", detail: `Keep ${Math.round(m)}px from edges for social overlays and printing.`, layerIds: [l.id], fix: { label: "Apply margin", apply: (p) => mapLayer(p, l.id, (x) => ({ ...x, x: Math.max(m, Math.min(x.x, W - m - x.w)) })) } });
  }
  // near-miss alignment (left edges within 1-6px)
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j]; const d = Math.abs(a.x - b.x);
    if (d > 0.5 && d < Math.max(6, W * 0.006) && a.type === "text" && b.type === "text") issues.push({ id: `align-${a.id}-${b.id}`, severity: "info", category: "Alignment", title: "Almost aligned left edges", detail: `${a.name} and ${b.name} are ${d.toFixed(1)}px apart.`, layerIds: [a.id, b.id], fix: { label: "Snap together", apply: (p) => mapLayer(p, b.id, (x) => ({ ...x, x: a.x })) } });
  }
  const families = new Set(texts.map((t) => (t.fontFamily ?? "").split("-")[0]));
  if (families.size > 3) issues.push({ id: "fonts", severity: "warn", category: "Typography", title: `${families.size} font families used`, detail: "Two or three families usually read as more professional.", layerIds: texts.map((t) => t.id) });
  if (texts.length > 1) {
    const sizes = texts.map((t) => t.fontSize ?? 24).sort((a, b) => b - a);
    if (sizes[0] / sizes[1] < 1.25) issues.push({ id: "hierarchy", severity: "info", category: "Hierarchy", title: "Weak typographic hierarchy", detail: "Your largest text is less than 1.25× the next size; make the headline stand out.", layerIds: texts.map((t) => t.id) });
  }
  if (brand?.colors.length) {
    for (const l of vis) {
      const c = l.fill; if (!c || !hexToRgb(c) || l.type === "image") continue;
      const nb = nearest(c, [...brand.colors, "#FFFFFF", "#000000", "#1C1C1E"]);
      if (colorDistance(c, nb) > 40) issues.push({ id: "brand-" + l.id, severity: "info", category: "Brand", title: `Off-brand colour ${c}`, detail: `${l.name} is not in the ${brand.name} palette.`, layerIds: [l.id], fix: { label: `Use ${nb}`, apply: (p) => mapLayer(p, l.id, (x) => ({ ...x, fill: nb })) } });
    }
  }
  const comp = composition(page, W, H);
  const penalty = issues.reduce((s, i) => s + (i.severity === "error" ? 12 : i.severity === "warn" ? 6 : 2), 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty - (comp.balance < 0.6 ? 6 : 0) - (comp.whitespace < 0.1 ? 6 : 0))));
  const explain = [
    `${vis.length} visible layers, ${texts.length} text blocks, ${families.size || 0} font families.`,
    `Visual balance ${(comp.balance * 100).toFixed(0)}% (100% = mass centred). Whitespace ${(comp.whitespace * 100).toFixed(0)}%.`,
    comp.thirds ? "Key elements land near rule-of-thirds lines." : "No large element sits on a rule-of-thirds line.",
    issues.length ? `${issues.filter((i) => i.severity === "error").length} errors and ${issues.filter((i) => i.severity === "warn").length} warnings reduce the score.` : "No rule violations detected.",
  ];
  return { score, issues, explain, comp };
}

export function composition(page: Page, W: number, H: number) {
  let mx = 0, my = 0, mass = 0, area = 0; let thirds = false;
  for (const l of page.layers.filter((x) => x.visible)) {
    const a = Math.max(0, Math.min(l.w * l.h, W * H)); if (a >= W * H * 0.95) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2; mx += cx * a; my += cy * a; mass += a; area += a;
    if (a > W * H * 0.03 && [W / 3, (2 * W) / 3].some((t) => Math.abs(cx - t) < W * 0.06)) thirds = true;
  }
  const cx = mass ? mx / mass : W / 2, cy = mass ? my / mass : H / 2;
  const balance = 1 - Math.min(1, Math.hypot((cx - W / 2) / W, (cy - H / 2) / H) * 2);
  return { cx, cy, balance, whitespace: Math.max(0, 1 - area / (W * H)), thirds };
}

export function complexity(p: Project) {
  const layers = p.pages.reduce((s, pg) => s + pg.layers.length, 0);
  const images = p.pages.flatMap((pg) => pg.layers.filter((l) => l.type === "image"));
  const mp = images.reduce((s, l) => s + ((l.naturalW ?? 1000) * (l.naturalH ?? 1000)) / 1e6, 0);
  const effects = p.pages.reduce((s, pg) => s + pg.layers.filter((l) => l.shadow || l.glow || l.adjust || l.gradient).length, 0);
  const paths = p.pages.reduce((s, pg) => s + pg.layers.filter((l) => l.type === "path").reduce((a, l) => a + (l.d?.length ?? 0), 0), 0);
  const clips = (p.timeline?.clips.length ?? 0) + (p.timeline?.audio.length ?? 0);
  const score = Math.min(100, Math.round(layers * 0.6 + mp * 2.5 + effects * 2 + paths / 4000 + clips * 6 + p.pages.length * 1.5 + (p.width * p.height) / 1e6));
  const level = score < 30 ? "Light" : score < 65 ? "Moderate" : "Heavy";
  const rec = level === "Light" ? "Full-quality preview is fine on all devices." : level === "Moderate" ? "Use Balanced preview on 2–4 GB RAM devices; avoid >2K exports there." : "Use Low preview quality, flatten unused effects, and export pages one at a time on entry-level devices.";
  return { layers, images: images.length, megapixels: Math.round(mp * 10) / 10, effects, clips, pages: p.pages.length, score, level, rec };
}

export async function integrityScan(p: Project) {
  const problems: { title: string; detail: string; repairable: boolean }[] = [];
  const ids = new Set<string>();
  for (const pg of p.pages) for (const l of pg.layers) {
    if (ids.has(l.id)) problems.push({ title: "Duplicate layer id", detail: `${l.name} shares an id with another layer.`, repairable: true });
    ids.add(l.id);
    for (const k of ["x", "y", "w", "h", "rotation", "opacity"] as const) if (!Number.isFinite(l[k])) problems.push({ title: "Invalid number", detail: `${l.name}.${k} is not a number.`, repairable: true });
    if (l.type === "image" && l.uri && Platform.OS !== "web" && l.uri.startsWith("file:")) {
      const info = await FS.getInfoAsync(l.uri).catch(() => ({ exists: false }));
      if (!info.exists) problems.push({ title: "Missing image file", detail: `${l.name} points to a file that no longer exists.`, repairable: false });
    }
  }
  if (!p.pages.length) problems.push({ title: "No pages", detail: "Project has no pages.", repairable: true });
  return problems;
}
export function repairProject(p: Project): Project {
  const seen = new Set<string>(); const fixNum = (v: number, d: number) => (Number.isFinite(v) ? v : d);
  const pages = (p.pages.length ? p.pages : [{ id: "p1", name: "Page 1", background: "#FFFFFF", layers: [] }]).map((pg) => ({
    ...pg, layers: pg.layers.map((l) => {
      const id = seen.has(l.id) ? l.id + Math.random().toString(36).slice(2, 6) : l.id; seen.add(id);
      return { ...l, id, x: fixNum(l.x, 0), y: fixNum(l.y, 0), w: fixNum(l.w, 100), h: fixNum(l.h, 100), rotation: fixNum(l.rotation, 0), opacity: fixNum(l.opacity, 1) };
    }),
  }));
  return { ...p, pages };
}

export function preflight(p: Project, dpi: number, bleedMm: number) {
  const out: { ok: boolean; text: string }[] = [];
  const inW = p.width / dpi, inH = p.height / dpi;
  out.push({ ok: dpi >= 300, text: `Document is ${p.width}×${p.height}px = ${(inW * 25.4).toFixed(0)}×${(inH * 25.4).toFixed(0)} mm at ${dpi} dpi${dpi < 300 ? " (300 dpi recommended)" : ""}.` });
  out.push({ ok: bleedMm >= 3, text: bleedMm >= 3 ? `${bleedMm} mm bleed will be added with crop marks.` : "No bleed: background may show white edges after trimming." });
  const safe = (dpi / 25.4) * 5;
  for (const pg of p.pages) for (const l of pg.layers.filter((x) => x.visible)) {
    if (l.type === "image" && l.naturalW) { const eff = (l.naturalW / l.w) * dpi; if (eff < 200) out.push({ ok: false, text: `${pg.name}: “${l.name}” prints at ~${Math.round(eff)} dpi effective.` }); }
    if (l.type === "text" && (l.x < safe || l.y < safe || l.x + l.w > p.width - safe)) out.push({ ok: false, text: `${pg.name}: text “${(l.text ?? "").slice(0, 20)}” is within 5 mm of the trim.` });
  }
  out.push({ ok: true, text: "Fonts are bundled with RF Canvas and embedded as rendered outlines in PDF." });
  out.push({ ok: true, text: "Colour: exports are sRGB. CMYK conversion is not performed on-device." });
  return out;
}
