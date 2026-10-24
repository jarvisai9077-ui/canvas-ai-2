// Feature registry: honest per-feature status. Format: id|name|module|status|notes
export type Status = "Planned" | "In Progress" | "Implemented" | "Tested";
const raw = `
CORE-01|Offline local storage with per-project keys and rolling backup|Storage|Implemented|AsyncStorage (not SQLite); main + backup copy, corrupt reads fall back to backup
CORE-02|Debounced autosave & manual save mode|Storage|Implemented|700 ms debounce; can be disabled in Settings
CORE-03|Undo / redo with labelled history|Editor|Tested|80 in-session steps; last 15 states persisted
CORE-04|Light, Dark and System themes|UI|Tested|
CORE-05|Adaptive tab navigation (NativeTabs on iOS 26+, JS tabs elsewhere)|UI|Implemented|
CORE-06|Privacy Policy & Terms pages|Legal|Tested|
CORE-07|Full backup & restore (JSON)|Storage|Implemented|Images are referenced by path, not embedded
CORE-08|Crash/interrupted-save recovery banner|Storage|Implemented|
PM-01|Create, rename, duplicate, favourite, archive, folders, tags|Projects|Tested|
PM-02|Trash with restore and permanent delete confirmation|Projects|Tested|
PM-03|Search, filters, sort, grid/list views, live thumbnails|Projects|Tested|Thumbnails rendered live from vector data
PM-04|Named snapshots, version restore, diff|History|Tested|
PM-05|Project integrity scanner & repair-into-copy|Reliability|Implemented|
PM-06|Portable project package export|Export|Tested|JSON package; import via Settings → Restore
CR-01|Universal Design Creator with presets & custom sizes (px/mm/in, dpi)|Create|Tested|
TP-01|Bundled original editable templates (999)|Templates|Implemented|24 hand-built + 975 generated from 12 formats × 8 layouts × 12 palettes; all objects editable
TP-02|Template categories, search, favourites, recent|Templates|Tested|
TP-03|Template pack import|Templates|Planned|
ED-01|Canvas with layers: text, shapes, images, QR, chart, table, note, path|Editor|Tested|
ED-02|Move, resize, rotate handles, pinch scale/rotate, flip|Editor|Implemented|
ED-03|Multi-select, marquee selection, groups|Editor|Implemented|Single-level groups
ED-04|Smart guides & snapping to canvas and objects|Editor|Implemented|
ED-05|Grid & safe-zone overlay|Editor|Implemented|
ED-06|Align & distribute|Editor|Tested|
ED-07|Numeric transform fields|Editor|Implemented|
ED-08|Lock, hide, reorder, duplicate, delete layers|Editor|Tested|
ED-09|Multi-page documents & page management|Editor|Tested|
ED-10|Pan & zoom & fit to screen|Editor|Implemented|
ED-11|Eyedropper (copy colour from object)|Editor|Implemented|Samples object fill, not pixels
ED-12|Clipping masks / layer masks|Editor|Planned|
ED-13|Blend modes|Editor|Planned|
ED-14|Linked components / instances|Editor|Planned|
ED-15|Copy & paste between projects|Editor|Planned|
ED-16|Reusable style presets|Editor|Implemented|
SL-01|Smart resize across dimensions|Layout|Implemented|Uniform scale + full-bleed stretch
SL-02|Constraint solver / auto-layout containers|Layout|Planned|
DI-01|Design Doctor (contrast, overflow, clipping, margins, alignment, resolution, typography, brand)|Intelligence|Tested|Deterministic rules
DI-02|Design score with explanation|Intelligence|Tested|
DI-03|Composition analyzer|Intelligence|Implemented|
DI-04|Colour-vision simulation|Accessibility|Implemented|
DI-05|Context-aware tool suggestions|Intelligence|Implemented|
DI-06|Creative Autopilot alternatives|Intelligence|Implemented|Command palette: 3 layout variants
DI-07|RTL & multilingual expansion preview|Accessibility|Planned|
TY-01|Fonts, size, spacing, line height, alignment, italic, outline|Typography|Implemented|6 bundled OFL fonts
TY-02|Curved text on arc|Typography|Implemented|
TY-03|Perspective (skew) text|Typography|Implemented|Skew transform, not true 3D
TY-04|Glyph & Ligature Inspector, OpenType features, font import|Typography|Planned|
TY-05|Text-to-path conversion|Typography|Planned|
SH-01|Rect, ellipse, polygon, star, line with fill/stroke/dash|Shapes|Implemented|
SH-02|Linear & radial gradients|Shapes|Implemented|
SH-03|Shadow and glow effects|Shapes|Implemented|
SH-04|Seamless Pattern Designer, halftone, duotone|Shapes|Planned|
SH-05|Procedural shape generator (spiral, rose, wave, gear)|Vector|Implemented|
SH-06|Variable Stroke Engine (taper, pressure, nib)|Vector|Implemented|
SH-07|Advanced Path Offset (inner/outer)|Vector|Implemented|Polygon offset of node outline
SH-08|Vector Measurement Tools|Vector|Implemented|Distance, angle, path length, measurement layers
SH-09|Technical Drawing Mode|Vector|In Progress|Measurement layers only
IL-01|Image Lab adjustments (exposure, brightness, contrast, saturation, temp, tint, hue, B&W, sepia, invert, vignette, blur)|Image Lab|Implemented|Non-destructive SVG colour matrix
IL-02|Filter presets incl. faded-photo colour restore|Image Lab|Implemented|Colour only; no scratch repair
IL-03|Rotate, flip, aspect crops, resize, 2× resample|Image Lab|Implemented|Native image manipulator, writes new file
IL-04|Before/after compare|Image Lab|Implemented|
IL-05|Curves, levels, HSL, LUTs|Image Lab|Planned|
IL-06|Luminosity masks, Dodge & Burn, frequency separation, liquify|Image Lab|Planned|Needs per-pixel GPU pipeline
IL-07|Background removal, inpainting, outpainting, AI upscale|Image Lab|Planned|Needs optional local model runtime
IL-08|Focus stacking, HDR fusion, RAW workflow, depth blur|Image Lab|Planned|
IL-09|Old photo scratch/dust restoration|Image Lab|Planned|
IL-10|Perspective Warp Studio|Image Lab|Planned|
DR-01|Brushes: pen, pencil, marker, airbrush, tapered, stroke eraser|Drawing|Tested|Strokes are vector paths
DR-02|Calligraphy Studio with nib angle|Drawing|Implemented|
DR-03|Stabilizer, pressure (stylus force or speed-simulated), symmetry|Drawing|Implemented|
DR-04|Frame-by-frame animation with onion skin & playback|Drawing|Implemented|
DR-05|Texture/smudge brushes, palm rejection|Drawing|Planned|
VE-01|Pen tool with nodes, curves/corners, open/closed|Vector|Tested|
VE-02|Node editing of existing paths|Vector|Implemented|
VE-03|Path simplification|Vector|Implemented|Douglas-Peucker
VE-04|SVG import (paths) & SVG export|Vector|Implemented|Import reads <path d> only
VE-05|Boolean union/subtract/intersect, shape builder|Vector|Planned|
VE-06|Raster tracing, vector morphing, icon batch generator|Vector|Planned|
VE-07|Isometric grid|Vector|Implemented|
VI-01|Video import & timeline with real playback|Video|Implemented|expo-video
VI-02|Trim, split at playhead, duplicate, reorder, ripple delete|Video|Implemented|
VI-03|Speed, volume, mute|Video|Implemented|
VI-04|Titles/subtitles with timing & position|Video|Implemented|
VI-05|Markers, aspect ratios, audio track list|Video|Implemented|Audio files listed; mixed playback planned
VI-06|Scene Continuity Checker|Video|Implemented|Flash frames & title overrun
VI-07|MP4 export|Video|Planned|No on-device encoder in this build; EDL JSON export instead
VI-08|Transitions, keyframes, chroma key, LUTs, scopes, stabilization|Video|Planned|
VI-09|Multicam sync, nested sequences, motion tracking, proxies|Video|Planned|
MO-01|Keyframe motion graphics, Lottie, particles, rigging, 3D|Motion|Planned|
DO-01|Documents: pages, page numbers, table of contents, notes|Documents|Implemented|
DO-02|Presentations: slides, transitions, speaker notes, presenter mode|Documents|Tested|
DO-03|Multi-page PDF export with bleed & crop marks|Export|Implemented|expo-print
DO-04|Editable tables & charts (bar/line/pie)|Documents|Implemented|
BR-01|Brand kits: colours, fonts, logo, min logo size|Brand|Tested|
BR-02|Apply brand to project with preview & snapshot|Brand|Tested|
BR-03|Brand consistency checker|Brand|Implemented|Part of Design Doctor
BR-04|Master Project propagation with confirmation & rollback|Brand|Implemented|Snapshots before propagation
BU-01|QR code generation|Business|Tested|Local qrcode library
BU-02|Product Variation / Certificate / ID Card Factory from CSV|Business|Tested|{{token}} replacement
BU-03|Report & Infographic Builder from CSV|Business|Tested|
BU-04|Print Sheet Arrangement (N-up)|Business|Tested|
BU-05|Event Stationery Suite|Business|Tested|
BU-06|Sticker Cut-Line Studio|Business|Implemented|Offset cut-line outlines; dielines planned
BU-07|Client Delivery Packager|Business|Implemented|PDF + project package + manifest
BU-08|Barcode generation, packaging dielines & mockups, fashion tech packs|Business|Planned|
DP-01|Digital products (planner, tracker, calendar, ebook) templates|Digital Products|Implemented|
AU-01|Command palette with deterministic commands|Automation|Tested|
AU-02|Create once, publish everywhere (multi-size)|Automation|Implemented|
AU-03|Batch recolour & text replace across projects|Automation|Implemented|With confirmation & snapshots
AU-04|Macro recorder, creative recipes|Automation|Planned|
AF-01|Reference Board Studio|Workflow|Implemented|Board projects with notes, swatches, images
AF-02|Visual Storyboard Builder|Workflow|In Progress|Use presentation pages as panels
AF-03|Design Variant Comparison Wall|Workflow|Tested|Side-by-side, synced zoom, restore
AF-04|Visual Annotation System|Workflow|Implemented|Hidden from exports by default
AF-05|Creative Production Checklist|Workflow|Tested|Reusable checklists
AF-06|Semantic Asset Search|Assets|Implemented|Filename/tags/metadata only, no AI
AF-07|Cross-Project Asset Updates|Assets|Implemented|
AF-08|Project Dependency Graph|Assets|Implemented|List view
AF-09|Reusable Selection Presets|Editor|Implemented|
AF-10|Batch Project Conversion|Automation|Implemented|Batch PDF/package export via Delivery Packager
AF-11|Smart Duplicate Detection|Assets|Implemented|SHA-256 exact duplicates
AF-12|Edit History Search|History|Tested|
AF-13|Safe Experiment Mode|History|Tested|Branch + merge back with snapshot
AF-14|Project Complexity Meter|Reliability|Implemented|
AF-15|Export Integrity Validator|Export|Tested|Magic-byte, size and parse checks
AF-16|Thermal-Aware Processing|Reliability|Planned|Thermal data not exposed to this runtime
AF-17|Offline Storage Migration|Reliability|Planned|
AF-18|Device Capability Test|Reliability|Tested|
AF-19|Asset License Register|Assets|Implemented|
AF-20|Export regression comparison|Export|Implemented|Size vs previous export
AI-01|Local AI Model Manager|AI|Implemented|Stores imported model files; no inference runtime in this build
AI-02|On-device OCR, segmentation, STT, generation|AI|Planned|Requires native ML runtime
`;
export const registry = raw.trim().split("\n").map((l) => { const [id, name, module, status, notes] = l.split("|"); return { id, name, module, status: status as Status, notes: notes ?? "" }; });
