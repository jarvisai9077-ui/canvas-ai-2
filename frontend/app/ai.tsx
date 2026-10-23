import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Btn, Card, Header, Row, Section, T } from "@/src/components/ui";
import { freeSpaceOK } from "@/src/engine/media";
import { confirmAsk, toast } from "@/src/engine/store";
import { storage } from "@/src/utils/storage";
import { spacing, useTheme } from "@/src/theme";

type Model = { name: string; uri: string; size: number; t: number };
const tools = [
  ["Background removal / segmentation", "Manual alternative: crop & rounded mask in the editor"],
  ["OCR (text recognition)", "Alternative: type text into a text layer"],
  ["Speech-to-text captions", "Alternative: add titles manually in Video Studio"],
  ["AI upscaling", "Alternative: Image Lab → Resample 2× (interpolation)"],
  ["Inpainting / object removal", "No algorithmic alternative in this build"],
  ["Local language model commands", "Alternative: deterministic Command Palette"],
];

// Local AI Model Manager: explicit, user-controlled model storage. No downloads, no cloud.
export default function AIStudio() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme(); const [models, setModels] = useState<Model[]>([]);
  useEffect(() => { storage.getItem("rf_models", "[]").then((r) => { try { setModels(JSON.parse(String(r))); } catch { setModels([]); } }); }, []);
  const persist = (m: Model[]) => { setModels(m); storage.setItem("rf_models", JSON.stringify(m)); };
  const importModel = async () => {
    if (Platform.OS === "web") return toast("Model import is available in the mobile app");
    const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true }); if (r.canceled) return; const a = r.assets[0];
    if (!/\.(tflite|onnx|gguf|bin|pte)$/i.test(a.name)) return toast("Expected a .tflite, .onnx, .gguf, .pte or .bin model file", "error");
    if (!(await freeSpaceOK(a.size ?? 0))) return;
    const dir = FS.documentDirectory + "models/"; await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const uri = dir + a.name; await FS.copyAsync({ from: a.uri, to: uri }); const info: any = await FS.getInfoAsync(uri);
    persist([{ name: a.name, uri, size: info.size ?? a.size ?? 0, t: Date.now() }, ...models.filter((m) => m.name !== a.name)]); toast("Model stored on device", "success");
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="ai-screen">
      <Header title="Local AI Studio" subtitle="Optional · on-device only" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Card style={{ marginTop: spacing.md, padding: spacing.md, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Badge text="Runtime unavailable" tone="warning" /><T v="h3">Honest status</T></View>
          <T v="small">This build does not include an on-device inference engine, so no AI tool can run yet and none is simulated. You can store model files now; they are never uploaded and can be removed without touching projects.</T>
          <Btn label="Import model file" icon="download" onPress={importModel} testID="ai-import-model" />
        </Card>
        <Section title={`Stored models (${models.length})`}>
          <Card>
            {models.map((m) => <Row key={m.uri} icon="hardware-chip" title={m.name} subtitle={`${(m.size / 1e6).toFixed(1)} MB · stored ${new Date(m.t).toLocaleDateString()} · not loadable in this build`} right={<Btn small kind="ghost" label="Remove" onPress={async () => { if (await confirmAsk({ title: `Remove ${m.name}?`, message: "Only the model file is deleted.", destructive: true, confirmLabel: "Remove" })) { await FS.deleteAsync(m.uri, { idempotent: true }); persist(models.filter((x) => x.uri !== m.uri)); } }} testID={`ai-remove-${m.name}`} />} />)}
            {!models.length ? <Row title="No models stored" subtitle="Nothing is downloaded automatically." /> : null}
          </Card>
        </Section>
        <Section title="AI tools and non-AI alternatives">
          <Card>{tools.map(([t, alt]) => <Row key={t} icon="sparkles" title={t} subtitle={`Unavailable · ${alt}`} />)}</Card>
        </Section>
      </ScrollView>
    </View>
  );
}
