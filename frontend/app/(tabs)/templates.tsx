import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TemplatePreview } from "@/src/components/TemplatePreview";
import { Ambient, Btn, Chip, ChipRow, IconBtn, Input, T } from "@/src/components/ui";
import { projectFromTemplate, templateCategories, templates } from "@/src/engine/factory";
import { saveProject, toast } from "@/src/engine/store";
import { projectRoute, usesNativeTabs } from "@/src/navigation";
import { storage } from "@/src/utils/storage";
import { radius, spacing, useTheme } from "@/src/theme";

export default function Templates() {
  const router = useRouter(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ open?: string }>();
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [preview, setPreview] = useState<string | null>(null);
  const [fav, setFav] = useState<string[]>([]); const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { (async () => {
    try { setFav(JSON.parse((await storage.getItem("rf_tpl_fav", "[]")) as string)); setRecent(JSON.parse((await storage.getItem("rf_tpl_recent", "[]")) as string)); } catch { /* fresh install */ }
  })(); }, []);
  useEffect(() => { if (params.open) setPreview(params.open); }, [params.open]);
  const cols = width > 700 ? 4 : 2; const cw = (width - spacing.md * 2 - 12 * (cols - 1)) / cols;
  const data = useMemo(() => templates.filter((t) => {
    if (cat === "Favourites") return fav.includes(t.id); if (cat === "Recent") return recent.includes(t.id);
    return (cat === "All" || t.category === cat) && (!q || (t.name + " " + t.category).toLowerCase().includes(q.toLowerCase()));
  }), [q, cat, fav, recent]);
  const toggleFav = (id: string) => { const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]; setFav(n); storage.setItem("rf_tpl_fav", JSON.stringify(n)); };
  const use = (id: string) => {
    const t = templates.find((x) => x.id === id)!; const p = projectFromTemplate(t); saveProject(p, { immediate: true });
    const r = [id, ...recent.filter((x) => x !== id)].slice(0, 12); setRecent(r); storage.setItem("rf_tpl_recent", JSON.stringify(r));
    setPreview(null); toast("Template copied into a new editable project", "success"); router.push(projectRoute(p));
  };
  const pt = templates.find((t) => t.id === preview);
  const bottom = usesNativeTabs ? insets.bottom : 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="templates-screen">
      <Ambient />
      <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.glassStrong, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <T v="h1">Templates</T>
          <T v="muted">{templates.length} original bundled templates · every object stays editable</T>
          <View style={{ marginTop: 8 }}><Input value={q} onChangeText={setQ} placeholder="Search templates" testID="templates-search-input" /></View>
        </View>
        <ChipRow>{["All", "Favourites", "Recent", ...templateCategories].map((c) => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} testID={`templates-cat-${c.toLowerCase().replace(/ /g, "-")}`} />)}</ChipRow>
      </View>
      <FlatList data={data} key={cols} numColumns={cols} keyExtractor={(t) => t.id} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: bottom + 24 }}
        ListEmptyComponent={<T v="muted" style={{ textAlign: "center", marginTop: 40 }}>No templates match.</T>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setPreview(item.id)} testID={`template-card-${item.id}`} style={({ pressed }) => ({ width: cw, padding: 8, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ height: cw, borderRadius: radius.md, backgroundColor: colors.canvasBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><TemplatePreview id={item.id} size={cw - 24} /></View>
            <T v="h3" numberOfLines={1} style={{ fontSize: 14, marginTop: 8 }}>{item.name}</T>
            <T v="muted" style={{ fontSize: 12 }}>{item.category} · {item.w}×{item.h}</T>
          </Pressable>
        )} />
      <Modal visible={!!pt} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
          {pt ? (
            <View style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + 16, gap: 12 }} testID="template-preview-sheet">
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}><T v="h2">{pt.name}</T><T v="muted">{pt.category} · {pt.w}×{pt.h}px · {pt.pages().length} page(s)</T></View>
                <IconBtn icon={fav.includes(pt.id) ? "heart" : "heart-outline"} label="Favourite template" onPress={() => toggleFav(pt.id)} testID="template-fav-toggle" tone={colors.brandPrimary} />
                <IconBtn icon="close" label="Close" onPress={() => setPreview(null)} testID="template-preview-close" />
              </View>
              <View style={{ alignItems: "center", backgroundColor: colors.canvasBg, borderRadius: radius.lg, padding: 12 }}><TemplatePreview id={pt.id} size={Math.min(width - 72, 360)} /></View>
              <Btn label="Use this template" icon="color-wand" onPress={() => use(pt.id)} testID="template-use-button" />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
