import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Linking, Platform } from "react-native";
import { confirmAsk, getState, saveAssets, toast, uid } from "./store";
import type { Asset } from "./types";

const isWeb = Platform.OS === "web";
const assetDir = () => (FS.documentDirectory ?? "") + "assets/";

async function hashFile(uri: string) {
  try {
    const data = isWeb ? uri.slice(0, 200000) : await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  } catch { return undefined; }
}

export async function freeSpaceOK(bytesNeeded: number) {
  if (isWeb) return true;
  const free = await FS.getFreeDiskStorageAsync().catch(() => Number.MAX_SAFE_INTEGER);
  if (free < bytesNeeded + 50 * 1024 * 1024) { toast(`Not enough storage: ${(free / 1e6).toFixed(0)} MB free`, "error"); return false; }
  return true;
}

// Copies the picked file into app-managed storage so projects never depend on gallery paths.
async function persist(uri: string, name: string): Promise<string> {
  if (isWeb) return uri;
  await FS.makeDirectoryAsync(assetDir(), { intermediates: true }).catch(() => {});
  const ext = (name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const dest = `${assetDir()}${uid()}.${ext}`;
  await FS.copyAsync({ from: uri, to: dest });
  return dest;
}

async function register(items: Omit<Asset, "id" | "createdAt" | "tags" | "license">[]) {
  const added: Asset[] = items.map((i) => ({ ...i, id: uid(), createdAt: Date.now(), tags: [], license: "Own work" }));
  saveAssets([...added, ...getState().assets]);
  return added;
}

async function handlePicker(res: ImagePicker.ImagePickerResult, kind: "image" | "video") {
  if (res.canceled) return [];
  const total = res.assets.reduce((s, a) => s + (a.fileSize ?? 5e6), 0);
  if (!(await freeSpaceOK(total))) return [];
  const out: Omit<Asset, "id" | "createdAt" | "tags" | "license">[] = [];
  for (const a of res.assets) {
    const name = a.fileName ?? `${kind}-${Date.now()}.${kind === "video" ? "mp4" : "jpg"}`;
    try {
      const uri = await persist(a.uri, name);
      out.push({ name, uri, kind, width: a.width, height: a.height, size: a.fileSize, hash: kind === "image" ? await hashFile(uri) : undefined, ...(a.duration ? { duration: a.duration / 1000 } : {}) } as any);
    } catch { toast(`Could not import ${name}`, "error"); }
  }
  return register(out);
}

export async function pickFromGallery(kind: "image" | "video" = "image", multiple = true) {
  // Android Photo Picker / iOS PHPicker: no broad storage permission needed.
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [kind === "image" ? "images" : "videos"], allowsMultipleSelection: multiple, quality: 1, exif: false });
  return handlePicker(res, kind);
}

export async function captureWithCamera(kind: "image" | "video" = "image") {
  if (isWeb) { toast("Camera capture is available in the mobile app", "info"); return []; }
  let perm = await ImagePicker.getCameraPermissionsAsync();
  if (!perm.granted) {
    if (perm.canAskAgain) {
      const go = await confirmAsk({ title: "Use your camera", message: "Take photos or videos to place straight into your design. Nothing leaves your device.", confirmLabel: "Continue" });
      if (!go) return [];
      perm = await ImagePicker.requestCameraPermissionsAsync();
    }
    if (!perm.granted) {
      const open = await confirmAsk({ title: "Camera access is off", message: "You can still import from your gallery or files. To use the camera, enable it in Settings.", confirmLabel: "Open Settings" });
      if (open) Linking.openSettings();
      return [];
    }
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: [kind === "image" ? "images" : "videos"], quality: 1 });
  return handlePicker(res, kind);
}

export async function pickFiles(type: string | string[] = "*/*") {
  const res = await DocumentPicker.getDocumentAsync({ type, multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  const out: Omit<Asset, "id" | "createdAt" | "tags" | "license">[] = [];
  for (const a of res.assets) {
    const kind: Asset["kind"] = a.mimeType?.startsWith("image") ? "image" : a.mimeType?.startsWith("audio") ? "audio" : a.mimeType?.startsWith("video") ? "video" : "file";
    try { const uri = await persist(a.uri, a.name); out.push({ name: a.name, uri, kind, size: a.size, hash: kind === "image" ? await hashFile(uri) : undefined }); }
    catch { toast(`Could not import ${a.name}`, "error"); }
  }
  return register(out);
}

// Reads a picked text file (CSV / JSON / SVG) without registering it as an asset.
export async function pickTextFile(types: string[]): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (res.canceled) return null;
  const a = res.assets[0];
  if ((a.size ?? 0) > 20 * 1024 * 1024) { toast("File is larger than 20 MB", "error"); return null; }
  const text = isWeb ? await (await fetch(a.uri)).text() : await FS.readAsStringAsync(a.uri);
  return { name: a.name, text };
}

export { hashFile };
