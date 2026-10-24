// Embeds bundled fonts into exported SVG/PDF so shared files look exactly like the canvas.
import { Asset } from "expo-asset";
import * as FS from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { Page } from "./types";

const mods: Record<string, number> = {
  "Jakarta-400": require("../../assets/fonts/Jakarta-400.ttf"),
  "Jakarta-600": require("../../assets/fonts/Jakarta-600.ttf"),
  "Jakarta-800": require("../../assets/fonts/Jakarta-800.ttf"),
  "Playfair-700": require("../../assets/fonts/Playfair-700.ttf"),
  "Bebas-400": require("../../assets/fonts/Bebas-400.ttf"),
  SpaceMono: require("../../assets/fonts/SpaceMono-Regular.ttf"),
};
const cache: Record<string, string> = {};

const blobToDataURL = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

async function fontData(name: string): Promise<string | null> {
  if (cache[name]) return cache[name];
  try {
    const a = Asset.fromModule(mods[name]); await a.downloadAsync();
    let url: string;
    if (Platform.OS === "web") url = (await blobToDataURL(await (await fetch(a.uri)).blob())).replace(/^data:[^;]*;/, "data:font/ttf;");
    else url = `data:font/ttf;base64,${await FS.readAsStringAsync(a.localUri ?? a.uri, { encoding: FS.EncodingType.Base64 })}`;
    return (cache[name] = url);
  } catch { return null; }
}

// Fonts used by the pages (layers default to Jakarta; tables, charts, notes and measures use Jakarta too).
export async function fontCSS(pages: Page[]): Promise<string> {
  const used = new Set<string>(["Jakarta-400", "Jakarta-600", "Jakarta-800"]);
  pages.forEach((p) => p.layers.forEach((l) => l.fontFamily && mods[l.fontFamily] && used.add(l.fontFamily)));
  let css = "";
  for (const f of used) { const d = await fontData(f); if (d) css += `@font-face{font-family:"${f}";src:url(${d}) format("truetype");}`; }
  return css;
}

export async function toDataURL(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith("data:")) return uri;
    if (Platform.OS === "web") return await blobToDataURL(await (await fetch(uri)).blob());
    const b = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
    return `data:image/${/\.png$/i.test(uri) ? "png" : /\.webp$/i.test(uri) ? "webp" : "jpeg"};base64,${b}`;
  } catch { return null; }
}
