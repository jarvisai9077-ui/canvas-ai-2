import { Ionicons } from "@react-native-vector-icons/ionicons";
import React from "react";
import { Pressable, View } from "react-native";
import { CanvasView } from "./CanvasView";
import { T } from "./ui";
import type { Project } from "@/src/engine/types";
import { radius, useTheme } from "@/src/theme";

export function ProjectThumb({ p, width, onPress, onLongPress, testID, list }: { p: Project; width: number; onPress: () => void; onLongPress?: () => void; testID?: string; list?: boolean }) {
  const { colors } = useTheme();
  const tw = list ? 64 : width - 16; const th = Math.min(list ? 64 : width * 1.1, (tw * p.height) / p.width);
  const pw = Math.min(tw, (th * p.width) / p.height);
  const icon = { video: "film", drawing: "brush", vector: "git-network", document: "document-text", presentation: "easel", board: "images", design: "color-palette" }[p.kind] as any;
  return (
    <Pressable testID={testID} onPress={onPress} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button" accessibilityLabel={`Open ${p.name}`}
      style={({ pressed }) => ({ width: list ? undefined : width, flexDirection: list ? "row" : "column", gap: list ? 12 : 0, alignItems: list ? "center" : "stretch", padding: 8, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ width: tw, height: list ? 64 : width * 1.1 - 8, borderRadius: radius.md, backgroundColor: colors.canvasBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {p.kind === "video" ? <Ionicons name="film" size={34} color={colors.muted} /> : <CanvasView page={p.pages[0]} W={p.width} H={p.height} width={pw} />}
      </View>
      <View style={{ paddingTop: list ? 0 : 8, flex: list ? 1 : undefined, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name={icon} size={13} color={colors.brandPrimary} />
          <T v="h3" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>{p.name}</T>
          {p.favorite ? <Ionicons name="heart" size={13} color={colors.brandPrimary} /> : null}
        </View>
        <T v="muted" numberOfLines={1} style={{ fontSize: 12 }}>{p.width}×{p.height} · {timeAgo(p.updatedAt)}</T>
      </View>
    </Pressable>
  );
}

export function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}
