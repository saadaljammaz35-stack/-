// A reading circle: the reader's mushaf page (and the verse they tap) shows for everyone present.
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, List, Mic, Share2, UsersRound, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { Button, IconButton, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { halaqaLink, parseHalaqaCode, useHalaqa } from '@/features/halaqa';
import { MushafPage } from '@/features/mushaf/page';
import { useI18n } from '@/i18n';
import { TOTAL_PAGES } from '@/lib/khatma';
import { useTheme } from '@/theme';

export default function HalaqaRoom() {
  useKeepAwake();
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code: string; lead?: string; page?: string }>();
  const code = parseHalaqaCode(params.code ?? '') ?? '';
  const leader = params.lead === '1';
  const startPage = Math.min(TOTAL_PAGES, Math.max(1, Number(params.page) || 1));
  const { state, lead, people, connected } = useHalaqa(code, leader, { page: startPage, verse: null });
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [sheet, setSheet] = useState<'people' | 'surahs' | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  const reader = people.find((p) => p.leader);
  const listeners = people.filter((p) => !p.leader).length;
  const go = (page: number) => lead({ page: Math.min(TOTAL_PAGES, Math.max(1, page)), verse: null });
  const onVerse = useCallback((id: number) => leader && lead({ page: state.page, verse: state.verse === id ? null : id }), [leader, lead, state.page, state.verse]);
  const noop = useCallback(() => undefined, []);

  const invite = () =>
    Share.share({
      message: tr(
        `حلقة قراءة في تطبيق «مع الله»: تابع المصحف معي صفحة بصفحة.\n${halaqaLink(code)}\nأو أدخل الرمز ${code} في «حلقة القراءة».`,
        `A reading circle in the Ma Allah app — follow the mushaf with me page by page:\n${halaqaLink(code)}\nor enter the code ${code} under “Reading circle”.`,
      ),
    }).catch(() => undefined);

  const status = !connected
    ? tr('جارٍ الاتصال…', 'Connecting…')
    : leader
      ? listeners
        ? tr(`أنت القارئ · يستمع ${listeners}`, `You are reading · ${listeners} listening`)
        : tr('أنت القارئ · ادعُ من تحب ليستمع', 'You are reading · invite someone to listen')
      : reader
        ? tr(`يقرأ ${reader.name} · الصفحة ${state.page}`, `${reader.name} is reading · page ${state.page}`)
        : tr('بانتظار القارئ…', 'Waiting for the reader…');

  // A page of the printed proportions, as large as the space allows.
  const pageW = area ? Math.min(area.width, area.height * 0.64) : 0;
  const pageH = area ? Math.min(area.height, pageW / 0.6) : 0;
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const Prev = isRTL ? ChevronRight : ChevronLeft;

  return (
    <Screen
      title={tr(`حلقة القراءة · ${code}`, `Reading circle · ${code}`)}
      subtitle={status}
      scroll={false}
      actions={[
        { icon: UsersRound, label: tr('الحاضرون', 'Who is here'), onPress: () => setSheet('people') },
        { icon: Share2, label: tr('دعوة', 'Invite'), onPress: invite },
      ]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {area && pageW > 0 ? (
          <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border }}>
            <MushafPage page={state.page} width={pageW} height={pageH} activeVerse={state.verse} selectedVerse={null} onVersePress={onVerse} onVerseLongPress={onVerse} onBackgroundPress={noop} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10, gap: 8 }}>
        {leader ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconButton icon={Prev} label={tr('الصفحة السابقة', 'Previous page')} onPress={() => go(state.page - 1)} disabled={state.page <= 1} />
              <Button title={tr(`الصفحة ${state.page} · اختر سورة`, `Page ${state.page} · pick a surah`)} icon={List} tone="soft" style={{ flex: 1 }} onPress={() => setSheet('surahs')} />
              <IconButton icon={Next} label={tr('الصفحة التالية', 'Next page')} onPress={() => go(state.page + 1)} disabled={state.page >= TOTAL_PAGES} tone="primary" />
            </View>
            <Txt variant="caption" muted center>
              {tr('المس آية لتظللها عند الجميع وهم يستمعون لك.', 'Tap a verse to highlight it for everyone as they listen.')}
            </Txt>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Mic size={16} color={t.colors.textMuted} />
            <Txt variant="caption" muted center>
              {tr('الصفحة تتقلّب وحدها مع القارئ، والآية المظللة هي التي يقرؤها. استمع له عبر مكالمة أو في المجلس.', 'The page turns by itself with the reader; the highlighted verse is the one being read. Listen over a call or in person.')}
            </Txt>
          </View>
        )}
      </View>

      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={{ flex: 1, backgroundColor: t.colors.overlay }} onPress={() => setSheet(null)} />
        <View style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 10, maxHeight: '70%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
            <Txt weight="semibold" style={{ flex: 1 }}>
              {sheet === 'people' ? tr(`الحاضرون (${people.length})`, `Here now (${people.length})`) : tr('انتقل إلى سورة', 'Go to a surah')}
            </Txt>
            <IconButton icon={X} label={tr('إغلاق', 'Close')} onPress={() => setSheet(null)} size={38} />
          </View>
          {sheet === 'people' ? (
            <FlatList
              data={people}
              keyExtractor={(p) => p.key}
              ListEmptyComponent={<Txt muted center style={{ padding: 16 }}>{tr('لا أحد بعد.', 'Nobody yet.')}</Txt>}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                  {item.leader ? <Mic size={18} color={t.colors.primary} /> : <UsersRound size={18} color={t.colors.textMuted} />}
                  <Txt style={{ flex: 1 }}>{item.name}</Txt>
                  {item.leader ? (
                    <Txt variant="caption" color={t.colors.primary}>
                      {tr('القارئ', 'Reader')}
                    </Txt>
                  ) : null}
                </View>
              )}
            />
          ) : (
            <FlatList
              data={surahs}
              keyExtractor={(s) => String(s.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => (go(item.pageStart), setSheet(null))}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' })}>
                  <Txt muted style={{ width: 30 }}>
                    {item.id}
                  </Txt>
                  <Txt style={{ flex: 1 }}>{item.name}</Txt>
                  <Txt variant="caption" muted>
                    {tr(`ص ${item.pageStart}`, `p. ${item.pageStart}`)}
                  </Txt>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}
