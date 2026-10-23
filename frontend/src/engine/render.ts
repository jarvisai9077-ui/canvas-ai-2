// Single SVG renderer used for on-screen display (SvgXml), SVG export, PDF export and web raster export,
// so what you see is exactly what gets exported.
import QRCode from "qrcode";
import { adjustMatrix, cvd } from "./color";
import { textBlockHeight, polygonPoints, starPoints, wrapText } from "./geometry";
import type { Layer, Page } from "./types";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

export interface RenderOpts { annotations?: boolean; cvdMode?: string | null; bleed?: number; cropMarks?: boolean; imageMap?: Record<string, string>; hideIds?: string[]; cutLines?: boolean }

const qrCache: Record<string, { size: number; d: string }> = {};
export function qrPath(value: string) {
  if (qrCache[value]) return qrCache[value];
  const q = QRCode.create(value || " ", { errorCorrectionLevel: "M" });
  const size = q.modules.size; let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (q.modules.get(x, y)) { let e = x; while (e < size && q.modules.get(e, y)) e++; d += `M${x},${y}h${e - x}v1h${x - e}z`; x = e; } else x++;
    }
  }
  return (qrCache[value] = { size, d });
}

function gradDef(id: string, l: Layer) {
  const g = l.gradient!;
  if (g.type === "radial") return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></radialGradient>`;
  const a = (g.angle * Math.PI) / 180; const x = Math.cos(a) / 2, y = Math.sin(a) / 2;
  return `<linearGradient id="${id}" x1="${n(0.5 - x)}" y1="${n(0.5 - y)}" x2="${n(0.5 + x)}" y2="${n(0.5 + y)}"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>`;
}

function shapeBody(l: Layer, fill: string, defs: string[], o: RenderOpts, forShadow = false): string {
  const sw = l.strokeWidth ?? 0; const stroke = l.stroke && sw && !forShadow ? ` stroke="${l.stroke}" stroke-width="${n(sw)}"${l.dash ? ' stroke-dasharray="12 8"' : ""}` : "";
  switch (l.type) {
    case "rect": return `<rect width="${n(l.w)}" height="${n(l.h)}" rx="${n(l.radius ?? 0)}" fill="${fill}"${stroke}/>`;
    case "ellipse": return `<ellipse cx="${n(l.w / 2)}" cy="${n(l.h / 2)}" rx="${n(l.w / 2)}" ry="${n(l.h / 2)}" fill="${fill}"${stroke}/>`;
    case "polygon": return `<polygon points="${polygonPoints(l.sides ?? 6, l.w, l.h)}" fill="${fill}"${stroke}/>`;
    case "star": return `<polygon points="${starPoints(l.sides ?? 5, l.innerRatio ?? 0.45, l.w, l.h)}" fill="${fill}"${stroke}/>`;
    case "line": return `<line x1="0" y1="${n(l.h / 2)}" x2="${n(l.w)}" y2="${n(l.h / 2)}" stroke="${forShadow ? fill : l.stroke ?? "#000"}" stroke-width="${n(l.strokeWidth ?? 4)}" stroke-linecap="round"${l.dash ? ' stroke-dasharray="12 8"' : ""}/>`;
    case "path": {
      const sx = l.w / (l.pathW || l.w), sy = l.h / (l.pathH || l.h);
      const f = l.strokeOnly ? "none" : fill; const st = l.strokeOnly || (l.stroke && sw) ? ` stroke="${forShadow ? fill : l.stroke ?? "#000"}" stroke-width="${n(sw / Math.max(sx, 0.0001))}" stroke-linecap="round" stroke-linejoin="round"` : "";
      return `<path d="${l.d ?? ""}" transform="scale(${n(sx)} ${n(sy)})" fill="${f}"${st}/>`;
    }
    case "text": {
      const fs = l.fontSize ?? 24; const lh = fs * (l.lineHeight ?? 1.2);
      const anchor = l.align ?? "start"; const ax = anchor === "middle" ? l.w / 2 : anchor === "end" ? l.w : 0;
      const ff = esc(l.fontFamily ?? "Jakarta-400");
      const out = l.outline && !forShadow ? ` stroke="${l.stroke ?? "#000"}" stroke-width="${n(l.strokeWidth ?? 2)}"` : "";
      const common = `font-size="${n(fs)}" font-family="${ff}" fill="${fill}" letter-spacing="${n(l.letterSpacing ?? 0)}"${l.italic ? ' font-style="italic"' : ""}${out}`;
      if (l.curve) {
        const r = Math.max(20, Math.abs(l.curve)); const id = `tp-${l.id}`; const sweep = l.curve > 0 ? 1 : 0;
        defs.push(`<path id="${id}" d="M0,${n(l.h)} A${n(r)},${n(r)} 0 0 ${sweep} ${n(l.w)},${n(l.h)}"/>`);
        return `<text ${common} text-anchor="middle"><textPath href="#${id}" startOffset="50%">${esc(l.text ?? "")}</textPath></text>`;
      }
      return wrapText(l.text ?? "", l.w, fs, l.letterSpacing).map((line, i) => `<text x="${n(ax)}" y="${n(i * lh + fs * 0.92)}" text-anchor="${anchor}" ${common}>${esc(line)}</text>`).join("");
    }
    case "image": {
      const href = o.imageMap?.[l.uri ?? ""] ?? l.uri ?? "";
      let filt = "";
      const m = l.adjust ? adjustMatrix(l.adjust) : null;
      if ((m || l.adjust?.blur) && !forShadow) {
        const fid = `f-${l.id}`;
        defs.push(`<filter id="${fid}" x="0" y="0" width="100%" height="100%">${m ? `<feColorMatrix type="matrix" values="${m.join(" ")}"/>` : ""}${l.adjust?.blur ? `<feGaussianBlur stdDeviation="${n(l.adjust.blur)}"/>` : ""}</filter>`);
        filt = ` filter="url(#${fid})"`;
      }
      if (forShadow) return `<rect width="${n(l.w)}" height="${n(l.h)}" rx="${n(l.radius ?? 0)}" fill="${fill}"/>`;
      const cid = `c-${l.id}`; defs.push(`<clipPath id="${cid}"><rect width="${n(l.w)}" height="${n(l.h)}" rx="${n(l.radius ?? 0)}"/></clipPath>`);
      let s = href ? `<g clip-path="url(#${cid})"><image href="${esc(href)}" width="${n(l.w)}" height="${n(l.h)}" preserveAspectRatio="xMidYMid slice"${filt}/></g>` : `<rect width="${n(l.w)}" height="${n(l.h)}" fill="#ECEDF1"/><text x="${n(l.w / 2)}" y="${n(l.h / 2)}" text-anchor="middle" font-size="${n(Math.max(12, l.w / 14))}" fill="#D32F2F">Missing image</text>`;
      if (l.adjust?.vignette) {
        const vid = `v-${l.id}`; defs.push(`<radialGradient id="${vid}" cx="50%" cy="50%" r="72%"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${n(l.adjust.vignette / 100)}"/></radialGradient>`);
        s += `<rect width="${n(l.w)}" height="${n(l.h)}" rx="${n(l.radius ?? 0)}" fill="url(#${vid})"/>`;
      }
      if (sw && l.stroke) s += `<rect width="${n(l.w)}" height="${n(l.h)}" rx="${n(l.radius ?? 0)}" fill="none" stroke="${l.stroke}" stroke-width="${n(sw)}"/>`;
      return s;
    }
    case "qr": {
      const q = qrPath(l.value ?? ""); const s = Math.min(l.w, l.h) / (q.size + 2);
      return `<rect width="${n(l.w)}" height="${n(l.h)}" fill="${forShadow ? fill : "#FFFFFF"}" fill-opacity="${l.fill === "#FFFFFF" ? 0 : 1}"/><path d="${q.d}" transform="translate(${n(s)} ${n(s)}) scale(${n(s)})" fill="${fill}"/>`;
    }
    case "chart": return chart(l, fill);
    case "table": return table(l);
    case "note": {
      const fs = l.fontSize ?? 22;
      return `<rect width="${n(l.w)}" height="${n(l.h)}" rx="8" fill="${fill}"/>` + wrapText(l.text ?? "", l.w - 32, fs).map((t, i) => `<text x="16" y="${n(16 + fs + i * fs * 1.3)}" font-size="${n(fs)}" font-family="Jakarta-600" fill="#3A2A00">${esc(t)}</text>`).join("");
    }
    case "measure": {
      const len = Math.round(l.w); const y = l.h / 2;
      return `<line x1="0" y1="${n(y)}" x2="${n(l.w)}" y2="${n(y)}" stroke="${l.stroke}" stroke-width="${n(sw || 2)}"/><line x1="0" y1="${n(y - 12)}" x2="0" y2="${n(y + 12)}" stroke="${l.stroke}" stroke-width="2"/><line x1="${n(l.w)}" y1="${n(y - 12)}" x2="${n(l.w)}" y2="${n(y + 12)}" stroke="${l.stroke}" stroke-width="2"/><text x="${n(l.w / 2)}" y="${n(y - 10)}" text-anchor="middle" font-size="20" font-family="Jakarta-600" fill="${l.stroke}">${len}px · ${n(l.rotation)}°</text>`;
    }
  }
  return "";
}

function chart(l: Layer, fill: string) {
  const d = l.data ?? { labels: [], values: [] }; const fs = l.fontSize ?? 16; const max = Math.max(1, ...d.values);
  const pal = [fill, "#1C1C1E", "#FFB300", "#1E88E5", "#43A047", "#8E24AA", "#D81B60"];
  if (l.chartType === "pie") {
    const total = d.values.reduce((a, b) => a + b, 0) || 1; const r = Math.min(l.w * 0.55, l.h) / 2 - 4; const cx = r + 4, cy = l.h / 2; let a0 = -Math.PI / 2; let s = "";
    d.values.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0;
      s += `<path d="M${n(cx)},${n(cy)} L${n(cx + r * Math.cos(a0))},${n(cy + r * Math.sin(a0))} A${n(r)},${n(r)} 0 ${large} 1 ${n(cx + r * Math.cos(a1))},${n(cy + r * Math.sin(a1))} Z" fill="${pal[i % pal.length]}"/>`;
      s += `<rect x="${n(2 * r + 30)}" y="${n(20 + i * fs * 1.8)}" width="${n(fs)}" height="${n(fs)}" fill="${pal[i % pal.length]}"/><text x="${n(2 * r + 40 + fs)}" y="${n(20 + i * fs * 1.8 + fs * 0.85)}" font-size="${n(fs)}" font-family="Jakarta-600" fill="#3A3A3C">${esc(d.labels[i] ?? "")} · ${n((v / total) * 100)}%</text>`;
      a0 = a1;
    });
    return s;
  }
  const ch = l.h - fs * 2; const bw = l.w / Math.max(1, d.values.length);
  let s = `<line x1="0" y1="${n(ch)}" x2="${n(l.w)}" y2="${n(ch)}" stroke="#C7C7CC" stroke-width="2"/>`;
  if (l.chartType === "line") {
    const pts = d.values.map((v, i) => `${n(i * bw + bw / 2)},${n(ch - (v / max) * (ch - fs))}`);
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${fill}" stroke-width="${n(Math.max(3, fs / 4))}" stroke-linejoin="round"/>` + pts.map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="${n(fs / 3)}" fill="${fill}"/>`).join("");
  } else d.values.forEach((v, i) => { const h = Math.max(0, (v / max) * (ch - fs * 1.4)); s += `<rect x="${n(i * bw + bw * 0.15)}" y="${n(ch - h)}" width="${n(bw * 0.7)}" height="${n(h)}" rx="${n(bw * 0.08)}" fill="${fill}"/><text x="${n(i * bw + bw / 2)}" y="${n(ch - h - 6)}" text-anchor="middle" font-size="${n(fs * 0.9)}" font-family="Jakarta-600" fill="#3A3A3C">${n(v)}</text>`; });
  d.labels.forEach((lb, i) => { s += `<text x="${n(i * bw + bw / 2)}" y="${n(l.h - fs * 0.4)}" text-anchor="middle" font-size="${n(fs)}" font-family="Jakarta-400" fill="#8E8E93">${esc(lb)}</text>`; });
  return s;
}

function table(l: Layer) {
  const rows = l.rows ?? []; const cols = Math.max(1, ...rows.map((r) => r.length)); const rh = l.h / Math.max(1, rows.length); const cw = l.w / cols; const fs = l.fontSize ?? 18;
  let s = `<rect width="${n(l.w)}" height="${n(l.h)}" fill="#FFFFFF" stroke="${l.stroke ?? "#D0D3DA"}" stroke-width="2"/>`;
  rows.forEach((r, i) => {
    if (i === 0) s += `<rect width="${n(l.w)}" height="${n(rh)}" fill="#FFF0E6"/>`;
    if (i > 0) s += `<line x1="0" y1="${n(i * rh)}" x2="${n(l.w)}" y2="${n(i * rh)}" stroke="${l.stroke ?? "#D0D3DA"}" stroke-width="1.5"/>`;
    r.forEach((c, j) => { s += `<text x="${n(j * cw + 12)}" y="${n(i * rh + rh / 2 + fs * 0.35)}" font-size="${n(fs)}" font-family="${i === 0 ? "Jakarta-800" : "Jakarta-400"}" fill="${l.fill ?? "#1C1C1E"}">${esc(c)}</text>`; });
  });
  for (let j = 1; j < cols; j++) s += `<line x1="${n(j * cw)}" y1="0" x2="${n(j * cw)}" y2="${n(l.h)}" stroke="${l.stroke ?? "#D0D3DA"}" stroke-width="1.5"/>`;
  return s;
}

export function layerSVG(l: Layer, defs: string[], o: RenderOpts): string {
  if (!l.visible || o.hideIds?.includes(l.id)) return "";
  l = { ...l, w: Math.max(1, Math.abs(l.w)), h: Math.max(1, Math.abs(l.h)) };
  const h = l.type === "text" && !l.curve ? Math.max(l.h, textBlockHeight(l)) : l.h;
  const cx = l.x + l.w / 2, cy = l.y + h / 2;
  const tf = `translate(${n(cx)} ${n(cy)}) rotate(${n(l.rotation)}) scale(${l.flipX ? -1 : 1} ${l.flipY ? -1 : 1})${l.skewX ? ` skewX(${n(l.skewX)})` : ""} translate(${n(-l.w / 2)} ${n(-h / 2)})`;
  let fill = l.fill ?? "#000000";
  if (l.gradient && l.type !== "image") { const gid = `g-${l.id}`; defs.push(gradDef(gid, l)); fill = `url(#${gid})`; }
  let out = "";
  if (l.shadow) {
    const sid = `s-${l.id}`; defs.push(`<filter id="${sid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(l.shadow.blur / 2)}"/></filter>`);
    out += `<g transform="translate(${n(l.shadow.dx)} ${n(l.shadow.dy)})" opacity="${n(l.shadow.opacity)}"${l.shadow.blur ? ` filter="url(#${sid})"` : ""}>${shapeBody(l, l.shadow.color, defs, o, true)}</g>`;
  }
  if (l.glow) {
    const gid = `gl-${l.id}`; defs.push(`<filter id="${gid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(l.glow)}"/></filter>`);
    out += `<g opacity="0.85" filter="url(#${gid})">${shapeBody(l, l.gradient ? l.gradient.from : fill, defs, o, true)}</g>`;
  }
  out += shapeBody(l, fill, defs, o);
  if (l.cutLine && o.cutLines !== false) {
    const c = l.cutLine;
    out += l.type === "ellipse"
      ? `<ellipse cx="${n(l.w / 2)}" cy="${n(l.h / 2)}" rx="${n(l.w / 2 + c)}" ry="${n(l.h / 2 + c)}" fill="none" stroke="#FF00FF" stroke-width="3" stroke-dasharray="14 8"/>`
      : `<rect x="${n(-c)}" y="${n(-c)}" width="${n(l.w + 2 * c)}" height="${n(l.h + 2 * c)}" rx="${n((l.radius ?? 0) + c)}" fill="none" stroke="#FF00FF" stroke-width="3" stroke-dasharray="14 8"/>`;
  }
  return `<g id="${esc(l.id)}" transform="${tf}" opacity="${n(l.opacity)}">${out}</g>`;
}

export function pageToSVG(page: Page, W: number, H: number, o: RenderOpts = {}): string {
  const defs: string[] = []; const b = o.bleed ?? 0;
  let body = `<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${page.background}"/>`;
  for (const l of page.layers) body += layerSVG(l, defs, o);
  if (o.annotations) (page.annotations ?? []).filter((a) => !a.resolved).forEach((a, i) => {
    const r = Math.max(18, W / 40);
    body += `<circle cx="${n(a.x)}" cy="${n(a.y)}" r="${n(r)}" fill="${a.color}" stroke="#FFFFFF" stroke-width="${n(r / 6)}"/><text x="${n(a.x)}" y="${n(a.y + r * 0.38)}" text-anchor="middle" font-size="${n(r)}" font-family="Jakarta-800" fill="#FFFFFF">${i + 1}</text>`;
  });
  if (o.cvdMode && cvd[o.cvdMode]) {
    const m = cvd[o.cvdMode]; defs.push(`<filter id="cvd"><feColorMatrix type="matrix" values="${m[0]} ${m[1]} ${m[2]} 0 0 ${m[3]} ${m[4]} ${m[5]} 0 0 ${m[6]} ${m[7]} ${m[8]} 0 0 0 0 0 1 0"/></filter>`);
    body = `<g filter="url(#cvd)">${body}</g>`;
  }
  let marks = "";
  if (o.cropMarks && b > 0) {
    const L = b * 0.8; const st = `stroke="#000" stroke-width="${n(Math.max(1, W / 1000))}"`;
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const dx = x === 0 ? -1 : 1, dy = y === 0 ? -1 : 1;
      marks += `<line x1="${x + dx * 4}" y1="${y}" x2="${x + dx * L}" y2="${y}" ${st}/><line x1="${x}" y1="${y + dy * 4}" x2="${x}" y2="${y + dy * L}" ${st}/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W + 2 * b}" height="${H + 2 * b}" viewBox="${-b} ${-b} ${W + 2 * b} ${H + 2 * b}"><defs>${defs.join("")}</defs>${body}${marks}</svg>`;
}
