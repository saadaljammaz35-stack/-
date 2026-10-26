import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Copy, Image as ImageIcon, Share2 } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';

import { StarMark, Wordmark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Button, Txt } from '@/components/ui';
import { CARD_STYLES, shareViewAsImage } from '@/features/share-image';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';


export default function ShareCard() {
  const t = useTheme();
  const { tr } = useI18n();
  const p = useLocalSearchParams<{ title?: string; text?: string; reference?: string; quran?: string }>();
  const [styleId, setStyleId] = useState<(typeof CARD_STYLES)[number]['id']>('cream');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const s = CARD_STYLES.find((x) => x.id === styleId)!;
  const title = p.title ?? '';
  const text = p.text ?? '';
  const reference = p.reference ?? '';
  const isQuran = p.quran === '1';
  const plain = `${title}\n\n${text}\n\n${reference}\n\n— ${tr('من تطبيق «مع الله»', 'via the «Ma Allah» app')}`;
  const size = text.length > 600 ? 17 : text.length > 300 ? 19 : 22;

  const shareImage = async () => {
    setBusy(true);
    setNote(null);
    try {
      await shareViewAsImage(cardRef, title);
    } catch (e) {
      setNote(tr(`تعذّر إنشاء الصورة: ${(e as Error).message}`, `Could not create the image: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  const shareText = async () => {
    setNote(null);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        await Clipboard.setStringAsync(plain);
        setNote(tr('نُسخ النص.', 'Text copied.'));
        return;
      }
      await Share.share({ message: plain });
    } catch {
      // The user dismissed the share sheet.
    }
  };

  return (
    <Screen title={tr('مشاركة كبطاقة', 'Share as card')}>
      <View ref={cardRef} collapsable={false} style={{ backgroundColor: s.bg, borderRadius: 24, padding: 24, gap: 16, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: -60, left: -60, opacity: 0.08 }}>
          <StarMark size={220} color={s.accent} fill="none" strokeWidth={4} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StarMark size={22} color={s.accent} />
          <Text style={{ fontFamily: t.fonts.semibold, fontSize: 14, color: s.accent }}>{title}</Text>
        </View>
        <Text
          style={{
            fontFamily: isQuran ? t.fonts.quran : t.fonts.reading,
            fontSize: size,
            lineHeight: Math.round(size * (isQuran ? 2 : 1.85)),
            color: s.ink,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}>
          {text}
        </Text>
        {reference ? (
          <View style={{ backgroundColor: s.soft, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'center' }}>
            <Text style={{ fontFamily: t.fonts.medium, fontSize: 13, color: s.ink, textAlign: 'center' }}>{reference}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Wordmark height={30} light={s.light} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
        {CARD_STYLES.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => setStyleId(x.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: x.id === styleId }}
            accessibilityLabel={x.id}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: x.bg, borderWidth: x.id === styleId ? 3 : 1, borderColor: x.id === styleId ? t.colors.primaryDeep : t.colors.border }}
          />
        ))}
      </View>

      <Button title={Platform.OS === 'web' ? tr('تنزيل الصورة', 'Download image') : tr('مشاركة كصورة', 'Share as image')} icon={ImageIcon} loading={busy} onPress={shareImage} />
      <Button title={tr('مشاركة كنص', 'Share as text')} icon={Share2} tone="soft" onPress={shareText} />
      <Button
        title={tr('نسخ النص', 'Copy text')}
        icon={Copy}
        tone="plain"
        onPress={async () => {
          await Clipboard.setStringAsync(plain);
          setNote(tr('نُسخ النص.', 'Text copied.'));
        }}
      />
      {note ? (
        <Txt muted center>
          {note}
        </Txt>
      ) : null}
    </Screen>
  );
}
