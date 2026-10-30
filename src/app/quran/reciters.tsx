import { router } from 'expo-router';
import { AudioLines, CircleCheck, Download, Play, Trash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { showMessage } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Chip, IconButton, ProgressBar, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { RECITERS } from '@/data/remote';
import { deleteSurah, downloadedBytes, downloadsSupported, downloadSurah, isDownloaded, useDownloads } from '@/features/audio/downloads';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

export default function RecitersScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const reciterId = useSettings((s) => s.reciterId);
  const set = useSettings((s) => s.set);
  const player = usePlayer();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const progress = useDownloads((s) => s.progress);
  const version = useDownloads((s) => s.version);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  const download = async (surah: number) => {
    try {
      await downloadSurah(reciterId, surah);
    } catch {
      showMessage(tr('تعذر التحميل', 'Download failed'), tr('تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.', 'Check your connection and try again.'));
    }
  };
  const mb = (downloadedBytes() / 1e6).toFixed(0);

  return (
    <Screen title={tr('القراء والاستماع', 'Reciters')} subtitle={downloadsSupported ? tr(`المحمَّل: ${mb} م.ب`, `Downloaded: ${mb} MB`) : undefined} scroll={false} actions={[{ icon: AudioLines, label: tr('قارن بين القراء', 'Compare reciters'), onPress: () => router.push('/quran/compare') }]}>
      <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
        <Txt variant="caption" muted>
          {tr('اختر القارئ', 'Choose a reciter')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RECITERS.map((r) => (
            <Chip key={r.id} label={`${r.name}${r.style !== 'مرتل' ? ` (${r.style})` : ''}`} active={r.id === reciterId} onPress={() => set({ reciterId: r.id })} />
          ))}
        </View>
        {!downloadsSupported ? (
          <Txt variant="caption" muted>
            {tr('التحميل للاستماع دون إنترنت متاح في تطبيق الجوال.', 'Offline downloads are available in the mobile app.')}
          </Txt>
        ) : null}
      </View>
      <FlatList
        data={surahs}
        extraData={[progress, version, reciterId]}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) => {
          const key = `${reciterId}:${item.id}`;
          const p = progress[key];
          const done = isDownloaded(reciterId, item.id);
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Pressable onPress={() => player.playSurah(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={16} color={t.colors.primaryDeep} fill={t.colors.primaryDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="medium">{`${item.id}. سورة ${item.name}`}</Txt>
                  {p != null ? <ProgressBar value={p} /> : <Txt variant="caption" muted>{done ? tr('محمّلة — تعمل دون إنترنت', 'Downloaded — works offline') : tr(`${item.versesCount} آية`, `${item.versesCount} ayat`)}</Txt>}
                </View>
              </Pressable>
              {downloadsSupported ? (
                p != null ? (
                  <ActivityIndicator color={t.colors.primary} />
                ) : done ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CircleCheck size={20} color={t.colors.success} />
                    <IconButton icon={Trash} label={tr('حذف', 'Delete')} tone="plain" size={36} onPress={() => deleteSurah(reciterId, item.id)} />
                  </View>
                ) : (
                  <IconButton icon={Download} label={tr('تحميل', 'Download')} size={38} onPress={() => download(item.id)} />
                )
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}
