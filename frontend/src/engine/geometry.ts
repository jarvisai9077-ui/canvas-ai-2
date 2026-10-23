import type { Layer, Page } from "./types";

export const CHAR_W = 0.56;

export function wrapText(text: string, w: number, fontSize: number, letterSpacing = 0): string[] {
  const cw = fontSize * CHAR_W + letterSpacing;
  const max = Math.max(1, Math.floor(w / cw));
  const out: string[] = [];
  for (const para of (text ?? "").split("\n")) {
    const words = para.split(" "); let line = "";
    for (const word of words) {
      const t = line ? line + " " + word : word;
      if (t.length > max && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
export const textBlockHeight = (l: Layer) => wrapText(l.text ?? "", l.w, l.fontSize ?? 24, l.letterSpacing).length * (l.fontSize ?? 24) * (l.lineHeight ?? 1.2);

export function polygonPoints(sides: number, w: number, h: number) {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) { const a = (Math.PI * 2 * i) / sides - Math.PI / 2; pts.push(`${w / 2 + (w / 2) * Math.cos(a)},${h / 2 + (h / 2) * Math.sin(a)}`); }
  return pts.join(" ");
}
export function starPoints(points: number, inner: number, w: number, h: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner; const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${w / 2 + (w / 2) * r * Math.cos(a)},${h / 2 + (h / 2) * r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

export function pointInLayer(l: Layer, px: number, py: number, pad = 0) {
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2; const a = (-l.rotation * Math.PI) / 180;
  const dx = px - cx, dy = py - cy;
  const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(rx) <= l.w / 2 + pad && Math.abs(ry) <= l.h / 2 + pad;
}

export function bounds(layers: Layer[]) {
  const x = Math.min(...layers.map((l) => l.x)), y = Math.min(...layers.map((l) => l.y));
  const r = Math.max(...layers.map((l) => l.x + l.w)), b = Math.max(...layers.map((l) => l.y + l.h));
  return { x, y, w: r - x, h: b - y };
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export function align(layers: Layer[], ids: string[], mode: AlignMode, W: number, H: number): Layer[] {
  const sel = layers.filter((l) => ids.includes(l.id));
  if (!sel.length) return layers;
  const box = sel.length > 1 ? bounds(sel) : { x: 0, y: 0, w: W, h: H };
  return layers.map((l) => {
    if (!ids.includes(l.id)) return l;
    const n = { ...l };
    if (mode === "left") n.x = box.x; if (mode === "right") n.x = box.x + box.w - l.w; if (mode === "hcenter") n.x = box.x + (box.w - l.w) / 2;
    if (mode === "top") n.y = box.y; if (mode === "bottom") n.y = box.y + box.h - l.h; if (mode === "vcenter") n.y = box.y + (box.h - l.h) / 2;
    return n;
  });
}
export function distribute(layers: Layer[], ids: string[], axis: "h" | "v"): Layer[] {
  const sel = layers.filter((l) => ids.includes(l.id)).sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
  if (sel.length < 3) return layers;
  const first = sel[0], last = sel[sel.length - 1];
  const total = sel.reduce((s, l) => s + (axis === "h" ? l.w : l.h), 0);
  const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
  const gap = (span - total) / (sel.length - 1);
  let pos = axis === "h" ? first.x : first.y; const map: Record<string, number> = {};
  for (const l of sel) { map[l.id] = pos; pos += (axis === "h" ? l.w : l.h) + gap; }
  return layers.map((l) => (map[l.id] === undefined ? l : axis === "h" ? { ...l, x: map[l.id] } : { ...l, y: map[l.id] }));
}

// Smart resize: uniform content scale centred in the new canvas; full-bleed layers stretch to fill.
export function smartResize(page: Page, W: number, H: number, NW: number, NH: number): Page {
  const s = Math.min(NW / W, NH / H); const ox = (NW - W * s) / 2, oy = (NH - H * s) / 2;
  return {
    ...page,
    layers: page.layers.map((l) => {
      const fullBleed = l.x <= 1 && l.y <= 1 && l.w >= W - 2 && l.h >= H - 2;
      if (fullBleed) return { ...l, x: 0, y: 0, w: NW, h: NH };
      const n: Layer = { ...l, x: ox + l.x * s, y: oy + l.y * s, w: l.w * s, h: l.h * s };
      if (l.fontSize) n.fontSize = Math.max(6, Math.round(l.fontSize * s));
      if (l.strokeWidth) n.strokeWidth = l.strokeWidth * s;
      return n;
    }),
  };
}

// ---- paths ----
export type Pt = { x: number; y: number; p?: number };
export function smoothPath(pts: Pt[], closed = false): string {
  if (!pts.length) return "";
  if (pts.length < 3) return `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map((p) => `L${p.x},${p.y}`).join(" ");
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const l = pts[pts.length - 1]; d += ` L${l.x.toFixed(1)},${l.y.toFixed(1)}`;
  return closed ? d + " Z" : d;
}
// Catmull-Rom spline through nodes -> cubic Bezier path
export function splinePath(n: Pt[], closed: boolean, smooth: boolean): string {
  if (n.length < 2) return n.length ? `M${n[0].x},${n[0].y}` : "";
  if (!smooth) return `M${n[0].x},${n[0].y} ` + n.slice(1).map((p) => `L${p.x},${p.y}`).join(" ") + (closed ? " Z" : "");
  const pts = closed ? [n[n.length - 1], ...n, n[0], n[1]] : [n[0], ...n, n[n.length - 1]];
  let d = `M${n[0].x.toFixed(1)},${n[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return closed ? d + " Z" : d;
}
// Moving-average stabiliser
export function stabilize(pts: Pt[], k: number): Pt[] {
  if (k <= 1) return pts;
  return pts.map((_, i) => {
    const s = pts.slice(Math.max(0, i - k + 1), i + 1);
    return { x: s.reduce((a, p) => a + p.x, 0) / s.length, y: s.reduce((a, p) => a + p.y, 0) / s.length, p: pts[i].p };
  });
}
// Douglas-Peucker simplification
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1]; let idx = 0, md = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]; const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
    const den = Math.hypot(b.y - a.y, b.x - a.x) || 1; const d = num / den;
    if (d > md) { md = d; idx = i; }
  }
  if (md > eps) return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
  return [a, b];
}
// Variable stroke outline (tapered / calligraphic nib / pressure). Returns closed polygon path.
export function variableStroke(pts: Pt[], width: number, opts: { nibAngle?: number | null; taper?: number; pressure?: boolean }): string {
  if (pts.length < 2) return "";
  const L: Pt[] = [], R: Pt[] = []; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let w = width;
    if (opts.nibAngle !== undefined && opts.nibAngle !== null) {
      const dir = Math.atan2(dy, dx); const nib = (opts.nibAngle * Math.PI) / 180;
      w = width * (0.15 + 0.85 * Math.abs(Math.sin(dir - nib)));
    }
    if (opts.pressure) w *= 0.4 + 0.6 * (pts[i].p ?? 0.6);
    const t = opts.taper ?? 0;
    if (t > 0) { const edge = Math.min(i, n - 1 - i) / Math.max(1, n * t); w *= Math.min(1, 0.1 + edge); }
    L.push({ x: pts[i].x + (nx * w) / 2, y: pts[i].y + (ny * w) / 2 }); R.push({ x: pts[i].x - (nx * w) / 2, y: pts[i].y - (ny * w) / 2 });
  }
  const all = [...L, ...R.reverse()];
  return "M" + all.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L") + " Z";
}
// Build a path layer box from absolute points
export function pathBox(pts: Pt[], pad: number) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const w = Math.max(2, Math.max(...xs) - x + pad), h = Math.max(2, Math.max(...ys) - y + pad);
  return { x, y, w, h, local: pts.map((p) => ({ x: p.x - x, y: p.y - y, p: p.p })) };
}
// Path length & polyline offset (inner/outer) for Advanced Path Offset
export function polyLength(pts: Pt[]) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; }
export function offsetPolygon(pts: Pt[], dist: number): Pt[] {
  const n = pts.length; if (n < 3) return pts;
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const sign = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const n1 = norm(p.y - a.y, -(p.x - a.x)), n2 = norm(b.y - p.y, -(b.x - p.x));
    const nx = n1.x + n2.x, ny = n1.y + n2.y; const l = Math.hypot(nx, ny) || 1;
    const dot = (n1.x * nx + n1.y * ny) / l; const k = dist / Math.max(0.3, dot);
    return { x: p.x - sign * (nx / l) * k, y: p.y - sign * (ny / l) * k };
  });
}
const norm = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
