import { Platform } from "react-native";
import type { Project } from "./engine/types";

export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export function projectRoute(p: Project): any {
  if (p.kind === "video") return `/video/${p.id}`;
  if (p.kind === "drawing") return `/draw/${p.id}`;
  if (p.kind === "vector") return `/vector/${p.id}`;
  return `/editor/${p.id}`;
}
