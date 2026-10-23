import * as FS from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo } from "@/src/components/ProjectThumb";
import { Badge, Btn, Empty, Header, Row } from "@/src/components/ui";
import { ExportRecord, listExports, share, validateFile } from "@/src/engine/exporter";
import { toast, useStore } from "@/src/engine/store";
import { useTheme } from "@/src/theme";

// Export Centre: history, re-validation (Export Integrity Validator) and size regression vs previous export.
export default function Exports() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme(); const { projects } = useStore();
  const [list, setList] = useState<ExportRecord[]>([]);
  useEffect(() => { listExports().then(setList); }, []);
  const verify = async () => {
    const out: ExportRecord[] = [];
    for (const r of list) out.push(r.uri.startsWith("file") ? { ...r, ...(await validateFile(r.uri, r.format)) } : r);
    setList(out); toast(`${out.filter((r) => r.valid).length}/${out.length} files verified`, "success");
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="exports-screen">
      <Header title="Export Centre" subtitle={`${list.length} exports on this device`} onBack={() => router.back()} right={list.length ? <Btn small label="Verify all" onPress={verify} testID="exports-verify-all" style={{ marginRight: 8 }} /> : undefined} />
      <FlatList data={list} keyExtractor={(r, i) => r.uri + i} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<Empty icon="share" title="No exports yet" text="Open a project and tap Export. Every file is verified after it is written." />}
        renderItem={({ item, index }) => {
          const prev = list.slice(index + 1).find((r) => r.projectId === item.projectId && r.format === item.format);
          const delta = prev && prev.size ? Math.round(((item.size - prev.size) / prev.size) * 100) : null;
          const proj = projects.find((p) => p.id === item.projectId);
          return <Row icon={item.valid ? "checkmark-circle" : "close-circle"} tone={item.valid ? colors.success : colors.error} title={item.name} subtitle={`${proj?.name ?? "Deleted project"} · ${item.message} · ${timeAgo(item.t)}${delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta}% vs previous` : ""}`}
            right={item.uri.startsWith("file") ? <Btn small kind="secondary" label="Share" onPress={async () => { const i = await FS.getInfoAsync(item.uri); if (!i.exists) return toast("File no longer exists", "error"); share(item.uri); }} testID={`exports-share-${index}`} /> : <Badge text={item.format.toUpperCase()} tone="muted" />} testID={`exports-row-${index}`} />;
        }} />
    </View>
  );
}
