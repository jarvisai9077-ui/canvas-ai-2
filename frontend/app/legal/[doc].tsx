import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Header, T } from "@/src/components/ui";
import { toast } from "@/src/engine/store";

export const SUPPORT_EMAIL = "jarvisai9077@gmail.com";
import { spacing, useTheme } from "@/src/theme";

const docs: Record<string, { title: string; body: [string, string][] }> = {
  privacy: { title: "Privacy Policy", body: [
    ["Summary", "RF Canvas is an offline-first creative app. It has no account, no login, no advertising, no analytics and no telemetry. Your projects, media, templates, brand kits and settings are stored only on this device."],
    ["Data we collect", "None. RF Canvas does not send your projects, photos, videos, audio, files or usage data to any server operated by us or anyone else."],
    ["Local storage", "Project data is saved in the app's private storage. Imported media is copied into the app's private folder so projects keep working if the original is moved. Uninstalling the app deletes this data unless you exported a backup."],
    ["Permissions", "Photos/videos: chosen through the system photo picker, which only shares the items you select. Camera: requested only when you tap Camera, used to capture media for your project. Files: chosen through the system file picker. You can revoke permissions in system settings at any time; other features keep working."],
    ["Sharing & exports", "Exports are written to the app's storage and only leave the device when you use the system share sheet, which you control."],
    ["Children", "RF Canvas does not knowingly collect any personal information from anyone, including children."],
    ["Changes", "If this policy changes, the updated version will ship inside the app. The current version is shown here."],
    ["Contact", "Questions about privacy or your data? Email our support team at jarvisai9077@gmail.com."],
  ] },
  terms: { title: "Terms & Conditions", body: [
    ["Licence", "You may use RF Canvas to create personal and commercial work. You own everything you create."],
    ["Your content", "You are responsible for having the rights to images, fonts, logos and other material you import. The Asset Licence Register helps you track this but does not verify licences."],
    ["Bundled assets", "Bundled templates are original works you may use and modify in your designs. Bundled fonts (Plus Jakarta Sans, Playfair Display, Bebas Neue, Space Mono) are licensed under the SIL Open Font License."],
    ["Limitations", "Features listed as Planned in the Feature Registry are not available. Video files cannot be rendered to MP4 in this build. Optional AI tools require a compatible local model runtime that is not included."],
    ["No warranty", "The app is provided as is. Keep backups of important work using Settings → Backup. We are not liable for data loss caused by device failure, uninstalling, or storage being cleared."],
    ["Governing terms", "These terms apply to your use of the app on your device. Continued use means you accept the latest version shown here."],
    ["Support", "For help, feedback or questions about these terms, email jarvisai9077@gmail.com."],
  ] },
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const d = docs[doc ?? "privacy"] ?? docs.privacy;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={`legal-${doc}-screen`}>
      <Header title={d.title} subtitle="Last updated June 2026" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24, gap: 16 }}>
        {d.body.map(([h, b]) => <View key={h} style={{ gap: 4 }}><T v="h3">{h}</T><T>{b}</T></View>)}
        <View style={{ gap: 8 }} testID="legal-support">
          <T v="h3">Support email</T>
          <T testID="legal-support-email">{SUPPORT_EMAIL}</T>
          <Btn label="Email support" icon="mail" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("RF Canvas support")}`).catch(() => toast(`No email app found. Write to ${SUPPORT_EMAIL}`, "error"))} testID="legal-email-button" />
        </View>
      </ScrollView>
    </View>
  );
}
