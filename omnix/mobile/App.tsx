import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

// OMNIX for iOS: a native shell around the OMNIX web app. The app keeps the
// server address on the device, checks it before use, and shows the full
// OMNIX interface (chat, knowledge, training, evaluation…) with the user's
// session cookie kept by WKWebView.

void SplashScreen.preventAutoHideAsync();

const STORAGE_KEY = "omnix.serverUrl";
const COLORS = {
  light: { bg: "#F6F7F9", card: "#FFFFFF", text: "#20212A", muted: "#8A8D98", accent: "#665CFF", border: "rgba(32,33,42,0.12)", bad: "#C42B3C" },
  dark: { bg: "#101116", card: "#181920", text: "#F2F2F6", muted: "#8A8D98", accent: "#8B84FF", border: "rgba(255,255,255,0.12)", bad: "#FF6B7A" },
};

type Phase = { kind: "loading" } | { kind: "setup"; error?: string } | { kind: "web"; url: string } | { kind: "offline"; url: string; error: string };

/** Accepts "omnix.example.com" or a full URL; only https is allowed (App Transport Security). */
export function normalizeServer(input: string): string | null {
  const raw = input.trim().replace(/\/+$/, "");
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function checkServer(url: string): Promise<string | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(`${url}/api/health`, { signal: ctl.signal });
    const j = (await r.json().catch(() => null)) as { status?: string } | null;
    if (!r.ok || j?.status !== "ok") return "الخادم يعمل لكنه غير جاهز (قاعدة البيانات؟) — Server reachable but not ready.";
    return null;
  } catch {
    return "تعذّر الوصول إلى الخادم — Could not reach the server.";
  } finally {
    clearTimeout(t);
  }
}

export default function App() {
  const scheme = useColorScheme();
  const c = COLORS[scheme === "dark" ? "dark" : "light"];
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      setPhase(saved ? { kind: "web", url: saved } : { kind: "setup" });
      await SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  const connect = useCallback(async () => {
    const url = normalizeServer(input);
    if (!url) return setPhase({ kind: "setup", error: "اكتب عنوان https صحيحاً — Enter a valid https address." });
    setBusy(true);
    const problem = await checkServer(url);
    setBusy(false);
    if (problem) return setPhase({ kind: "setup", error: problem });
    await AsyncStorage.setItem(STORAGE_KEY, url);
    setPhase({ kind: "web", url });
  }, [input]);

  const changeServer = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPhase({ kind: "setup" });
  }, []);

  // Stay inside the OMNIX origin; anything else opens in Safari.
  const onNavigate = useCallback(
    (req: WebViewNavigation) => {
      if (phase.kind !== "web") return true;
      if (req.url.startsWith(phase.url) || req.url.startsWith("about:") || req.url.startsWith("blob:")) return true;
      void Linking.openURL(req.url);
      return false;
    },
    [phase],
  );

  if (phase.kind === "loading") {
    return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.accent} /></View>;
  }

  if (phase.kind === "setup") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.center, { backgroundColor: c.bg }]}>
        <StatusBar style="auto" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Image source={require("./assets/splash-icon.png")} style={[styles.logo, scheme === "dark" && { tintColor: "#F2F2F6" }]} />
          <Text style={[styles.title, { color: c.text }]}>OMNIX</Text>
          <Text style={[styles.rtl, { color: c.muted }]}>اكتب عنوان خادم OMNIX الخاص بك</Text>
          <Text style={[styles.ltr, { color: c.muted }]}>Your OMNIX server address</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="omnix.example.com"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="go"
            onSubmitEditing={connect}
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
            accessibilityLabel="Server address"
          />
          {phase.error ? <Text style={[styles.rtl, { color: c.bad }]}>{phase.error}</Text> : null}
          <Pressable onPress={connect} disabled={busy} style={({ pressed }) => [styles.button, { backgroundColor: c.accent, opacity: busy ? 0.5 : pressed ? 0.85 : 1 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>اتصال · Connect</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (phase.kind === "offline") {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <StatusBar style="auto" />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>غير متصل · Offline</Text>
          <Text style={[styles.rtl, { color: c.muted }]}>{phase.error}</Text>
          <Pressable onPress={() => setPhase({ kind: "web", url: phase.url })} style={[styles.button, { backgroundColor: c.accent }]} accessibilityRole="button">
            <Text style={styles.buttonText}>إعادة المحاولة · Retry</Text>
          </Pressable>
          <Pressable onPress={changeServer} style={styles.link} accessibilityRole="button">
            <Text style={{ color: c.accent }}>تغيير الخادم · Change server</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="auto" />
      <WebView
        source={{ uri: `${phase.url}/ai/chat` }}
        style={{ flex: 1, backgroundColor: c.bg }}
        sharedCookiesEnabled
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        contentInsetAdjustmentBehavior="automatic"
        startInLoadingState
        renderLoading={() => <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.accent} /></View>}
        onShouldStartLoadWithRequest={onNavigate}
        onError={(e) => setPhase({ kind: "offline", url: phase.url, error: e.nativeEvent.description || "تعذّر التحميل — Could not load." })}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setPhase({ kind: "offline", url: phase.url, error: `HTTP ${e.nativeEvent.statusCode}` });
        }}
        applicationNameForUserAgent="OMNIX-iOS/1.0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24, gap: 12, alignItems: "stretch" },
  logo: { width: 64, height: 64, alignSelf: "center", resizeMode: "contain" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", letterSpacing: 2 },
  rtl: { fontSize: 15, textAlign: "center", writingDirection: "rtl" },
  ltr: { fontSize: 13, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlign: "left" },
  button: { borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { alignItems: "center", paddingVertical: 8 },
});
