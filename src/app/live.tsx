import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { ExternalLink, Pause, Play, Radio, RefreshCw, Tv, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, Loading, Segmented, Txt } from '@/components/ui';
import { cachedJson } from '@/data/remote';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { normalizeArabic } from '@/lib/arabic';
import { useTheme } from '@/theme';

// Official channels of the Saudi Broadcasting Authority.
const CHANNELS = [
  { id: 'makkah', ar: 'المسجد الحرام — قناة القرآن الكريم', en: 'Masjid al-Haram — KSA Quran TV', channelId: 'UCos52azQNBgW63_9uDJoPDA', handle: 'SaudiQuranTv' },
  { id: 'madinah', ar: 'المسجد النبوي — قناة السنة النبوية', en: 'Masjid an-Nabawi — Sunnah TV', channelId: 'UCROKYPep-UuODNwyipe6JMw', handle: 'SaudiSunnahTv' },
];

const SAUDI_QURAN_RADIO = { id: 109082, name: 'إذاعة القرآن الكريم — المملكة العربية السعودية', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' };

type RadioItem = { id: number; name: string; url: string };

// YouTube refuses embeds that arrive without a Referer (player error 153); in-app web views
// identify the app with an https URL built from its bundle id.
const EMBED_REFERER = 'https://com.maallah.app/';

// The channel's /live page always points at its current broadcast. A hidden web view opens it
// and reports the broadcast's video id, which is then played in the official embedded player.
const RESOLVE_LIVE_ID = `
  (function () {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var r = window.ytInitialPlayerResponse;
      var d = r && r.videoDetails;
      var id = d && d.videoId;
      if (!id) { var m = location.href.match(/[?&]v=([\\w-]{11})/); if (m) id = m[1]; }
      if (id || tries > 30) {
        clearInterval(timer);
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id || null, live: !!(d && d.isLive) }));
      }
    }, 500);
  })();
  true;
`;

// Reports YouTube's own error screen (stream offline, unavailable) back to the app.
const DETECT_PLAYER_ERROR = `
  (function () {
    var sent = false;
    setInterval(function () {
      if (sent) return;
      var el = document.querySelector('.ytp-error, .ytp-error-content');
      if (el && el.offsetParent !== null) { sent = true; window.ReactNativeWebView.postMessage('player-error'); }
    }, 1500);
  })();
  true;
`;

type LiveState = { phase: 'resolving' } | { phase: 'playing'; videoId: string; live: boolean } | { phase: 'failed' };

function LiveVideo({ handle }: { handle: string }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ attempt: number; value: LiveState }>({ attempt: 0, value: { phase: 'resolving' } });
  const current: LiveState = state.attempt === attempt ? state.value : { phase: 'resolving' };
  const openYoutube = () => Linking.openURL(`https://www.youtube.com/@${handle}/live`);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Give up if the channel page never reports a broadcast.
    const id = setTimeout(() => setState((s) => (s.attempt === attempt && s.value.phase !== 'resolving' ? s : { attempt, value: { phase: 'failed' } })), 25_000);
    return () => clearTimeout(id);
  }, [attempt]);

  if (Platform.OS === 'web') {
    // Browsers cannot look up the current broadcast (cross-origin), so the web build links to it.
    return (
      <Card tone="primary" style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
        <Tv size={30} color="#fff" />
        <Txt color="#fff" center>
          {tr('يعمل البث داخل التطبيق على iOS وAndroid. في المتصفح افتح البث الرسمي مباشرة.', 'The stream plays inside the iOS and Android app. In a browser, open the official stream directly.')}
        </Txt>
        <Button title={tr('مشاهدة البث المباشر', 'Watch live')} icon={ExternalLink} tone="soft" onPress={openYoutube} />
      </Card>
    );
  }

  const retry = () => setAttempt((a) => a + 1);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        {current.phase === 'failed' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
            <WifiOff size={28} color="#fff" />
            <Txt color="#fff" center>
              {tr('تعذر تشغيل البث. قد يكون متوقفًا مؤقتًا أو الاتصال ضعيفًا.', 'The stream could not play. It may be offline or the connection is weak.')}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={tr('إعادة المحاولة', 'Retry')} icon={RefreshCw} tone="soft" onPress={retry} />
              <Button title={tr('فتح في يوتيوب', 'Open YouTube')} icon={ExternalLink} tone="soft" onPress={openYoutube} />
            </View>
          </View>
        ) : current.phase === 'resolving' ? (
          <>
            <Loading label={tr('جارٍ الاتصال بالبث…', 'Connecting…')} />
            <WebView
              key={`resolve-${attempt}`}
              source={{ uri: `https://m.youtube.com/@${handle}/live` }}
              injectedJavaScript={RESOLVE_LIVE_ID}
              onMessage={(e) => {
                try {
                  const r = JSON.parse(e.nativeEvent.data) as { id: string | null; live: boolean };
                  setState({ attempt, value: r.id ? { phase: 'playing', videoId: r.id, live: r.live } : { phase: 'failed' } });
                } catch {
                  setState({ attempt, value: { phase: 'failed' } });
                }
              }}
              onError={() => setState({ attempt, value: { phase: 'failed' } })}
              mediaPlaybackRequiresUserAction
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          </>
        ) : (
          <WebView
            key={`play-${attempt}`}
            source={{ uri: `https://www.youtube.com/embed/${current.videoId}?autoplay=1&playsinline=1&rel=0`, headers: { Referer: EMBED_REFERER } }}
            injectedJavaScript={DETECT_PLAYER_ERROR}
            onMessage={(e) => e.nativeEvent.data === 'player-error' && setState({ attempt, value: { phase: 'failed' } })}
            onShouldStartLoadWithRequest={(req) => {
              // Keep the player in place; links out of it open in the YouTube app or browser.
              if (req.url.startsWith('https://www.youtube.com/embed/') || req.url.startsWith('about:')) return true;
              if (req.isTopFrame === false) return true;
              Linking.openURL(req.url);
              return false;
            }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onError={() => setState({ attempt, value: { phase: 'failed' } })}
            onHttpError={() => setState({ attempt, value: { phase: 'failed' } })}
            startInLoadingState
            renderLoading={() => <Loading />}
            style={{ backgroundColor: '#000' }}
          />
        )}
      </View>
      {current.phase === 'playing' && !current.live ? (
        <Txt variant="caption" muted>
          {tr('لا يوجد بث مباشر الآن؛ يُعرض آخر بث للقناة.', 'Not live right now; showing the channel’s latest broadcast.')}
        </Txt>
      ) : null}
      <Pressable onPress={openYoutube} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <ExternalLink size={14} color={t.colors.primary} />
        <Txt variant="caption" color={t.colors.primary}>
          {tr('القناة الرسمية على يوتيوب (للتكبير وملء الشاشة)', 'Official channel on YouTube (full screen)')}
        </Txt>
      </Pressable>
    </View>
  );
}

export default function LiveScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const [tab, setTab] = useState<'tv' | 'radio'>('tv');
  const [channel, setChannel] = useState(CHANNELS[0].id);
  const [radios, setRadios] = useState<RadioItem[]>([SAUDI_QURAN_RADIO]);
  const [filter, setFilter] = useState('');
  const player = usePlayer();

  useEffect(() => {
    cachedJson<{ radios: RadioItem[] }>('https://mp3quran.net/api/v3/radios?language=ar', 7 * 86_400_000)
      .then((d) => setRadios([SAUDI_QURAN_RADIO, ...d.radios.filter((r) => r.id !== SAUDI_QURAN_RADIO.id)]))
      .catch(() => undefined);
  }, []);

  const ch = CHANNELS.find((c) => c.id === channel)!;
  const shown = filter ? radios.filter((r) => normalizeArabic(r.name).includes(normalizeArabic(filter))) : radios;

  return (
    <Screen title={tr('البث المباشر والإذاعات', 'Live & radio')}>
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as 'tv' | 'radio')}
        options={[
          { value: 'tv', label: tr('بث الحرمين', 'Haramain live') },
          { value: 'radio', label: tr('إذاعات صوتية', 'Radio') },
        ]}
      />
      {tab === 'tv' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {CHANNELS.map((c) => (
              <Chip key={c.id} label={tr(c.ar, c.en)} active={c.id === channel} onPress={() => setChannel(c.id)} />
            ))}
          </View>
          <LiveVideo key={ch.id} handle={ch.handle} />
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Tv size={20} color={t.colors.primaryDeep} />
            <Txt variant="caption" muted style={{ flex: 1 }}>
              {tr('البث من القنوات الرسمية لهيئة الإذاعة والتلفزيون السعودية. للاستماع الصوتي فقط استخدم «إذاعة القرآن الكريم» من تبويب الإذاعات.', 'Streams from the official Saudi Broadcasting Authority channels. For audio only, use Quran Radio.')}
            </Txt>
          </Card>
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['', 'السديس', 'الشريم', 'المنشاوي', 'الحصري', 'العفاسي'].map((f) => (
              <Chip key={f || 'all'} label={f || tr('الكل', 'All')} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
          {shown.map((r) => {
            const playing = player.now?.kind === 'stream' && player.now.url === r.url && player.playing;
            return (
              <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} tone={r.id === SAUDI_QURAN_RADIO.id ? 'soft' : 'surface'}>
                <Radio size={22} color={t.colors.primaryDeep} />
                <Txt weight="medium" style={{ flex: 1 }}>
                  {r.name}
                </Txt>
                <Pressable
                  accessibilityLabel={playing ? tr('إيقاف', 'Pause') : tr('استماع مباشر', 'Listen live')}
                  onPress={() => (playing ? player.toggle() : player.playStream(r.url, r.name, tr('بث مباشر', 'Live')))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.primaryDeep, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  {playing ? <Pause size={16} color="#fff" fill="#fff" /> : <Play size={16} color="#fff" fill="#fff" />}
                  <Txt variant="caption" color="#fff">
                    {playing ? tr('إيقاف', 'Pause') : tr('استماع', 'Listen')}
                  </Txt>
                </Pressable>
              </Card>
            );
          })}
          <Txt variant="label" muted center>
            {tr('الإذاعات من mp3quran.net', 'Radios via mp3quran.net')}
          </Txt>
        </>
      )}
    </Screen>
  );
}
