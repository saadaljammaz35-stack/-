import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { ExternalLink, Pause, Play, Radio, RefreshCw, Tv, WifiOff } from 'lucide-react-native';
import { createElement, useEffect, useState } from 'react';
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

function LiveVideo({ channelId, handle }: { channelId: string; handle: string }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  const src = `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&playsinline=1`;
  const openYoutube = () => Linking.openURL(`https://www.youtube.com/@${handle}/live`);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
            <WifiOff size={28} color="#fff" />
            <Txt color="#fff" center>
              {tr('تعذر تشغيل البث. قد يكون البث متوقفًا مؤقتًا أو الاتصال ضعيفًا.', 'The stream could not play. It may be offline or the connection is weak.')}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={tr('إعادة المحاولة', 'Retry')} icon={RefreshCw} tone="soft" onPress={() => (setFailed(false), setKey((k) => k + 1))} />
              <Button title={tr('فتح في يوتيوب', 'Open YouTube')} icon={ExternalLink} tone="soft" onPress={openYoutube} />
            </View>
          </View>
        ) : Platform.OS === 'web' ? (
          createElement('iframe', {
            key,
            src,
            style: { border: 0, width: '100%', height: '100%' },
            allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
            allowFullScreen: true,
            title: handle,
          })
        ) : (
          <WebView
            key={key}
            source={{ uri: src }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            startInLoadingState
            renderLoading={() => <Loading />}
            style={{ backgroundColor: '#000' }}
          />
        )}
      </View>
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
          <LiveVideo key={ch.id} channelId={ch.channelId} handle={ch.handle} />
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
