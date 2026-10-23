import type { Adjust } from "./types";

export const defaultAdjust: Adjust = { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, tint: 0, exposure: 0, grayscale: 0, sepia: 0, invert: 0, vignette: 0, blur: 0 };

export function hexToRgb(hex: string): [number, number, number] | null {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
export const isHex = (s: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());

function lum([r, g, b]: [number, number, number]) {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
// WCAG 2.x contrast ratio
export function contrastRatio(a: string, b: string): number {
  const A = hexToRgb(a), B = hexToRgb(b);
  if (!A || !B) return 21;
  const la = lum(A), lb = lum(B);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function colorDistance(a: string, b: string) {
  const A = hexToRgb(a), B = hexToRgb(b); if (!A || !B) return 999;
  return Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2);
}
export function nearest(color: string, palette: string[]) {
  let best = palette[0], d = Infinity;
  for (const c of palette) { const x = colorDistance(color, c); if (x < d) { d = x; best = c; } }
  return best;
}
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a) ?? [0, 0, 0], B = hexToRgb(b) ?? [0, 0, 0];
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// Colour-vision simulation matrices (Machado et al. approximations, severity 1.0)
export const cvd: Record<string, number[]> = {
  protanopia: [0.152, 1.053, -0.205, -0.115, 0.786, 0.329, -0.004, -0.048, 1.052],
  deuteranopia: [0.367, 0.861, -0.228, 0.28, 0.673, 0.047, -0.012, 0.043, 0.969],
  tritanopia: [1.256, -0.077, -0.179, -0.078, 0.931, 0.148, 0.005, 0.691, 0.304],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
};
export function simulate(hex: string, mode: string) {
  const m = cvd[mode]; const c = hexToRgb(hex); if (!m || !c) return hex;
  return rgbToHex(m[0] * c[0] + m[1] * c[1] + m[2] * c[2], m[3] * c[0] + m[4] * c[1] + m[5] * c[2], m[6] * c[0] + m[7] * c[1] + m[8] * c[2]);
}

// ---- 4x5 colour matrices for SVG feColorMatrix ----
type M = number[];
const I: M = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
function mul(a: M, b: M): M {
  const r: M = new Array(20).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    let s = j === 4 ? a[i * 5 + 4] : 0;
    for (let k = 0; k < 4; k++) s += a[i * 5 + k] * b[k * 5 + j];
    r[i * 5 + j] = s;
  }
  return r;
}
const sat = (s: number): M => {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  return [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s), 0, 0, lr * (1 - s), lg * (1 - s) + s, lb * (1 - s), 0, 0, lr * (1 - s), lg * (1 - s), lb * (1 - s) + s, 0, 0, 0, 0, 0, 1, 0];
};
const hueRot = (deg: number): M => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0, 0, 0, 0, 1, 0];
};
// Values in SVG feColorMatrix are normalised (0..1 per channel)
export function adjustMatrix(a: Adjust): M | null {
  const isDefault = Object.keys(defaultAdjust).every((k) => k === "vignette" || k === "blur" || (a as any)[k] === 0);
  if (isDefault) return null;
  let m = I;
  const ex = Math.pow(2, a.exposure / 50);
  m = mul([ex, 0, 0, 0, 0, 0, ex, 0, 0, 0, 0, 0, ex, 0, 0, 0, 0, 0, 1, 0], m);
  const b = a.brightness / 200;
  m = mul([1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0], m);
  const c = 1 + a.contrast / 100, o = 0.5 * (1 - c);
  m = mul([c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0], m);
  if (a.saturation) m = mul(sat(1 + a.saturation / 100), m);
  if (a.hue) m = mul(hueRot(a.hue), m);
  const t = a.temperature / 400, tn = a.tint / 400;
  if (t || tn) m = mul([1, 0, 0, 0, t, 0, 1, 0, 0, -tn, 0, 0, 1, 0, -t, 0, 0, 0, 1, 0], m);
  if (a.grayscale) m = mul(sat(1 - a.grayscale / 100), m);
  if (a.sepia) {
    const s = a.sepia / 100;
    const sp: M = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
    m = mul(I.map((v, i) => v * (1 - s) + sp[i] * s), m);
  }
  if (a.invert) {
    const s = a.invert / 100;
    const inv: M = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];
    m = mul(I.map((v, i) => v * (1 - s) + inv[i] * s), m);
  }
  return m.map((v) => Math.round(v * 10000) / 10000);
}

export const filterPresets: Record<string, Partial<Adjust>> = {
  Original: {},
  Vivid: { saturation: 35, contrast: 15 },
  Warm: { temperature: 40, saturation: 10 },
  Cool: { temperature: -40 },
  Mono: { grayscale: 100, contrast: 15 },
  Sepia: { sepia: 80 },
  Fade: { contrast: -25, brightness: 10, saturation: -20 },
  Noir: { grayscale: 100, contrast: 45, exposure: -10 },
  Restore: { contrast: 18, saturation: 25, temperature: -10, exposure: 6 },
  Screenshot: { contrast: 12, saturation: 8, brightness: 4 },
};

export const swatches = ["#FF5E00", "#FF6600", "#FFF0E6", "#1C1C1E", "#FFFFFF", "#8E8E93", "#F5F6F8", "#E53935", "#FFB300", "#43A047", "#00897B", "#1E88E5", "#3949AB", "#8E24AA", "#D81B60", "#6D4C41", "#FFD8C2", "#C8E6C9", "#BBDEFB", "#000000"];
