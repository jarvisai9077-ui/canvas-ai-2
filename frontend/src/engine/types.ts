export type LayerType =
  | "text" | "rect" | "ellipse" | "polygon" | "star" | "line" | "image"
  | "path" | "qr" | "chart" | "table" | "note" | "measure";

export interface Adjust {
  brightness: number; contrast: number; saturation: number; hue: number;
  temperature: number; tint: number; exposure: number; grayscale: number;
  sepia: number; invert: number; vignette: number; blur: number;
}

export interface Gradient { type: "linear" | "radial"; from: string; to: string; angle: number }
export interface Shadow { dx: number; dy: number; blur: number; color: string; opacity: number }

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number; y: number; w: number; h: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  flipX?: boolean; flipY?: boolean;
  skewX?: number;
  fill?: string; stroke?: string; strokeWidth?: number; radius?: number; dash?: boolean;
  gradient?: Gradient | null;
  shadow?: Shadow | null;
  glow?: number;
  // text
  text?: string; fontSize?: number; fontWeight?: string; fontFamily?: string;
  align?: "start" | "middle" | "end"; letterSpacing?: number; lineHeight?: number;
  curve?: number; italic?: boolean; outline?: boolean;
  // image
  uri?: string; assetId?: string; naturalW?: number; naturalH?: number; adjust?: Adjust; crop?: { x: number; y: number; w: number; h: number } | null;
  // path (d in local coords 0..pathW / 0..pathH)
  d?: string; pathW?: number; pathH?: number; strokeOnly?: boolean; closed?: boolean;
  nodes?: { x: number; y: number }[]; smooth?: boolean;
  // polygon / star
  sides?: number; innerRatio?: number;
  // qr / chart / table
  value?: string;
  data?: { labels: string[]; values: number[] };
  chartType?: "bar" | "line" | "pie";
  rows?: string[][];
  groupId?: string | null;
  cutLine?: number;
}

export interface Annotation { id: string; x: number; y: number; text: string; color: string; resolved: boolean; layerId?: string }

export interface Page {
  id: string;
  name: string;
  background: string;
  layers: Layer[];
  notes?: string;
  transition?: "none" | "fade" | "slide";
  annotations?: Annotation[];
}

export interface Snapshot { id: string; name: string; createdAt: number; pages: Page[]; width: number; height: number }
export interface Task { id: string; text: string; done: boolean }
export interface LogEntry { t: number; label: string }
export interface HistoryState { t: number; label: string; pages: Page[] }

export interface Clip {
  id: string; uri: string; name: string; duration: number; in: number; out: number;
  speed: number; volume: number; muted: boolean; fadeIn: number; fadeOut: number; kind: "video" | "audio";
}
export interface TextOverlay { id: string; text: string; start: number; end: number; x: number; y: number; size: number; color: string; style: string }
export interface Timeline { clips: Clip[]; audio: Clip[]; texts: TextOverlay[]; markers: number[]; aspect: "16:9" | "9:16" | "1:1" }

export type ProjectKind = "design" | "drawing" | "vector" | "document" | "presentation" | "video" | "board";

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  category: string;
  width: number; height: number; unit: "px" | "mm" | "in"; dpi: number;
  pages: Page[];
  createdAt: number; updatedAt: number;
  favorite: boolean; archived: boolean; trashed: boolean;
  folder: string; tags: string[];
  snapshots: Snapshot[];
  checklist: Task[];
  log: LogEntry[];
  history: HistoryState[];
  brandId?: string | null;
  parentId?: string | null;
  timeline?: Timeline;
  recovered?: boolean;
}

export interface Asset {
  id: string; name: string; uri: string; kind: "image" | "video" | "audio" | "file";
  width?: number; height?: number; size?: number; hash?: string;
  tags: string[]; license: string; createdAt: number;
}

export interface Brand {
  id: string; name: string; colors: string[]; headingFont: string; bodyFont: string;
  logoUri?: string; tagline?: string; minLogoSize: number; createdAt: number;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  autosave: boolean;
  snapping: boolean;
  showGrid: boolean;
  highContrast: boolean;
  previewQuality: "low" | "balanced" | "high";
  filenameTemplate: string;
  recentCommands: string[];
  savedChecklists: { name: string; items: string[] }[];
  selectionPresets: { name: string; props: Partial<Layer> }[];
  effectPresets: { name: string; props: Partial<Layer> }[];
}
