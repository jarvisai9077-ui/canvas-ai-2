import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Chip, ChipRow, Header, Input, T } from "@/src/components/ui";
import { registry } from "@/src/engine/registry";
import { spacing, useTheme } from "@/src/theme";

export default function Registry() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const [q, setQ] = useState(""); const [s, setS] = useState("All");
  const data = useMemo(() => registry.filter((r) => (s === "All" || r.status === s) && (!q || (r.name + r.module + r.id).toLowerCase().includes(q.toLowerCase()))), [q, s]);
  const count = (x: string) => registry.filter((r) => r.status === x).length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="registry-screen">
      <Header title="Feature registry" subtitle={`${registry.length} entries · ${count("Implemented") + count("Tested")} working · ${count("Planned")} planned`} onBack={() => router.back()} />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}><Input value={q} onChangeText={setQ} placeholder="Search features" testID="registry-search-input" /></View>
      <ChipRow>{["All", "Tested", "Implemented", "In Progress", "Planned"].map((x) => <Chip key={x} label={`${x}${x === "All" ? "" : ` (${count(x)})`}`} active={s === x} onPress={() => setS(x)} testID={`registry-filter-${x.toLowerCase().replace(" ", "-")}`} />)}</ChipRow>
      <FlatList data={data} keyExtractor={(r) => r.id} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 4 }} testID={`registry-row-${item.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T v="muted" style={{ fontSize: 11 }}>{item.id} · {item.module}</T><View style={{ flex: 1 }} /><Badge text={item.status} tone={item.status === "Tested" ? "success" : item.status === "Implemented" ? "info" : item.status === "In Progress" ? "warning" : "muted"} /></View>
            <T v="h3">{item.name}</T>{item.notes ? <T v="small">{item.notes}</T> : null}
          </View>
        )} />
    </View>
  );
}
