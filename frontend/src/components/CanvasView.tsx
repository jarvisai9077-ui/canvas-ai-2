import React, { forwardRef, memo, useMemo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { pageToSVG, RenderOpts } from "@/src/engine/render";
import type { Page } from "@/src/engine/types";

interface Props { page: Page; W: number; H: number; width: number; opts?: RenderOpts; testID?: string }

// Renders a page via the shared SVG renderer; exports use the same markup.
export const CanvasView = memo(forwardRef<View, Props>(function CanvasView({ page, W, H, width, opts, testID }, ref) {
  const xml = useMemo(() => pageToSVG(page, W, H, opts), [page, W, H, opts]);
  const height = (width * H) / W;
  return (
    <View ref={ref as any} collapsable={false} style={{ width, height, overflow: "hidden" }} testID={testID}>
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}));
