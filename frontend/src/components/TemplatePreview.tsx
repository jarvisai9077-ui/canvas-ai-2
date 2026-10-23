import React from "react";
import { CanvasView } from "./CanvasView";
import { templates } from "@/src/engine/factory";

const cache: Record<string, any> = {};
export function TemplatePreview({ id, size }: { id: string; size: number }) {
  const t = templates.find((x) => x.id === id)!;
  const page = (cache[id] ??= t.pages()[0]);
  const w = t.w >= t.h ? size : (size * t.w) / t.h;
  return <CanvasView page={page} W={t.w} H={t.h} width={w} />;
}
