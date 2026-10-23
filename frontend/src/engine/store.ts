// Offline-first local store. Every project is persisted as its own key with a
// rolling backup copy; reads fall back to the backup if the main copy is corrupt.
import { useSyncExternalStore } from "react";
import { storage } from "@/src/utils/storage";
import { setColorScheme } from "@/src/theme";
import type { Asset, Brand, Project, Settings } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

interface State {
  ready: boolean;
  projects: Project[];
  assets: Asset[];
  brands: Brand[];
  settings: Settings;
  recovered: string[];
}

export const defaultSettings: Settings = {
  theme: "system", autosave: true, snapping: true, showGrid: false, highContrast: false,
  previewQuality: "balanced", filenameTemplate: "{name}_{w}x{h}_{date}", recentCommands: [],
  savedChecklists: [{ name: "Social post launch", items: ["Check spelling", "Run Design Doctor", "Export PNG 1080", "Export JPEG backup"] }],
  selectionPresets: [], effectPresets: [],
};

let state: State = { ready: false, projects: [], assets: [], brands: [], settings: defaultSettings, recovered: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit(); };

export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
export const getState = () => state;

const K = { index: "rf_index", proj: (id: string) => `rf_p_${id}`, bak: (id: string) => `rf_b_${id}`, assets: "rf_assets", brands: "rf_brands", settings: "rf_settings" };

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await storage.getItem(key, null);
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function validateProject(p: any): p is Project {
  return !!p && typeof p.id === "string" && Array.isArray(p.pages) && p.pages.every((pg: any) => Array.isArray(pg.layers)) && typeof p.width === "number";
}

function normalize(p: Project): Project {
  const d: any = { snapshots: [], checklist: [], log: [], history: [], tags: [], folder: "", favorite: false, archived: false, trashed: false, category: "Custom", unit: "px", dpi: 72 };
  return { ...d, ...p };
}

export async function initStore() {
  if (state.ready) return;
  const ids = (await readJSON<string[]>(K.index)) ?? [];
  const projects: Project[] = []; const recovered: string[] = [];
  for (const id of ids) {
    let p = await readJSON<Project>(K.proj(id));
    if (!validateProject(p)) {
      const b = await readJSON<Project>(K.bak(id));
      if (validateProject(b)) { p = { ...b, recovered: true }; recovered.push(b.name); }
      else continue;
    }
    projects.push(normalize(p));
  }
  const assets = (await readJSON<Asset[]>(K.assets)) ?? [];
  const brands = (await readJSON<Brand[]>(K.brands)) ?? [];
  const settings = { ...defaultSettings, ...((await readJSON<Settings>(K.settings)) ?? {}) };
  setColorScheme(settings.theme === "system" ? null : settings.theme);
  set({ ready: true, projects: projects.sort((a, b) => b.updatedAt - a.updatedAt), assets, brands, settings, recovered });
}

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
async function writeProject(p: Project) {
  const prev = await storage.getItem(K.proj(p.id), null);
  if (typeof prev === "string") await storage.setItem(K.bak(p.id), prev);
  const ok = await storage.setItem(K.proj(p.id), JSON.stringify(p));
  if (!ok) throw new Error("Storage write failed");
}
async function writeIndex() { await storage.setItem(K.index, JSON.stringify(state.projects.map((p) => p.id))); }

export function saveProject(p: Project, opts: { immediate?: boolean; touch?: boolean } = {}) {
  const next = { ...p, updatedAt: opts.touch === false ? p.updatedAt : Date.now() };
  const exists = state.projects.some((x) => x.id === p.id);
  const projects = exists ? state.projects.map((x) => (x.id === p.id ? next : x)) : [next, ...state.projects];
  set({ projects });
  if (!exists) writeIndex();
  clearTimeout(timers[p.id]);
  const run = () => writeProject(getProject(p.id) ?? next).catch(() => {});
  if (opts.immediate) return run();
  timers[p.id] = setTimeout(run, 700);
}

export async function flushProject(id: string) {
  clearTimeout(timers[id]);
  const p = getProject(id);
  if (p) await writeProject(p);
}

export const getProject = (id: string) => state.projects.find((p) => p.id === id);

export async function deleteProjectForever(id: string) {
  set({ projects: state.projects.filter((p) => p.id !== id) });
  await storage.removeItem(K.proj(id)); await storage.removeItem(K.bak(id)); await writeIndex();
}

export function duplicateProject(p: Project, name?: string, extra: Partial<Project> = {}): Project {
  const copy: Project = JSON.parse(JSON.stringify(p));
  copy.id = uid(); copy.name = name ?? `${p.name} copy`; copy.createdAt = Date.now(); copy.favorite = false; copy.recovered = false;
  Object.assign(copy, extra);
  saveProject(copy, { immediate: true });
  return copy;
}

export function saveAssets(assets: Asset[]) { set({ assets }); storage.setItem(K.assets, JSON.stringify(assets)); }
export function saveBrands(brands: Brand[]) { set({ brands }); storage.setItem(K.brands, JSON.stringify(brands)); }
export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch }; set({ settings }); storage.setItem(K.settings, JSON.stringify(settings));
  if (patch.theme) setColorScheme(patch.theme === "system" ? null : patch.theme);
}
export function pushRecentCommand(cmd: string) {
  updateSettings({ recentCommands: [cmd, ...state.settings.recentCommands.filter((c) => c !== cmd)].slice(0, 8) });
}

// Full backup: every project, asset index, brand and settings in one JSON document.
export function buildBackup() {
  return JSON.stringify({ app: "RF Canvas", version: 1, createdAt: Date.now(), projects: state.projects, assets: state.assets, brands: state.brands, settings: state.settings });
}
export async function restoreBackup(json: string): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(json);
  if (data?.app !== "RF Canvas" || !Array.isArray(data.projects)) throw new Error("Not an RF Canvas backup file");
  let added = 0, skipped = 0;
  for (const p of data.projects) {
    if (!validateProject(p)) { skipped++; continue; }
    const exists = getProject(p.id);
    const proj = normalize(exists ? { ...p, id: uid(), name: `${p.name} (restored)` } : p);
    saveProject(proj, { immediate: true, touch: false }); added++;
  }
  if (Array.isArray(data.assets)) saveAssets([...state.assets, ...data.assets.filter((a: Asset) => !state.assets.some((x) => x.id === a.id))]);
  if (Array.isArray(data.brands)) saveBrands([...state.brands, ...data.brands.filter((b: Brand) => !state.brands.some((x) => x.id === b.id))]);
  await writeIndex();
  return { added, skipped };
}

// ---- global UI feedback (toast / confirm / prompt) ----
type Toast = { id: number; text: string; tone: "info" | "success" | "error" };
export type ConfirmReq = { title: string; message?: string; items?: string[]; confirmLabel?: string; destructive?: boolean; input?: { value: string; placeholder?: string; multiline?: boolean }; resolve: (v: any) => void };
let ui: { toast: Toast | null; confirm: ConfirmReq | null } = { toast: null, confirm: null };
const uiListeners = new Set<() => void>();
export function useUI() { return useSyncExternalStore((l) => { uiListeners.add(l); return () => uiListeners.delete(l); }, () => ui, () => ui); }
const setUI = (p: Partial<typeof ui>) => { ui = { ...ui, ...p }; uiListeners.forEach((l) => l()); };
export function toast(text: string, tone: Toast["tone"] = "info") {
  const id = Date.now(); setUI({ toast: { id, text, tone } });
  setTimeout(() => { if (ui.toast?.id === id) setUI({ toast: null }); }, 2600);
}
export function confirmAsk(req: Omit<ConfirmReq, "resolve">): Promise<boolean> {
  return new Promise((resolve) => setUI({ confirm: { ...req, resolve } }));
}
export function promptText(title: string, value = "", opts: { message?: string; placeholder?: string; multiline?: boolean } = {}): Promise<string | null> {
  return new Promise((resolve) => setUI({ confirm: { title, message: opts.message, confirmLabel: "Save", input: { value, placeholder: opts.placeholder, multiline: opts.multiline }, resolve } }));
}
export function closeConfirm(result: any) { const c = ui.confirm; setUI({ confirm: null }); c?.resolve(result); }
