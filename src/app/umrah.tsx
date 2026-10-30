// «العمرة والحج»: the steps of Umrah with counters for the seven circuits of tawaf and of sa‘y, and
// the days of Hajj in outline — each with what to say from Hisn al-Muslim and the hadith of Jabir.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { HandHeart, Minus, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const TALBIYAH = 4535; // Ibn ʿUmar: the Prophet's talbiyah (agreed upon)
const JABIR = 10622; // Jabir: the Prophet's Hajj (Muslim)
const UMRAH_VIRTUE = 65626; // Umrah to Umrah expiates what is between (agreed upon)
const hisn = (id: number) => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${id}` } });

function Counter({ kind }: { kind: 'tawaf' | 'sai' }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [n, setN] = useState(0);
  const done = n >= 7;
  const tap = () => {
    if (done) return;
    const next = n + 1;
    setN(next);
    if (Platform.OS !== 'web') (next >= 7 ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)).catch(() => undefined);
  };
  // Sa‘y begins at as-Safa: odd circuits go to al-Marwah, even ones come back.
  const leg = kind === 'sai' && !done ? (n % 2 === 0 ? tr('من الصفا إلى المروة', 'From as-Safa to al-Marwah') : tr('من المروة إلى الصفا', 'From al-Marwah to as-Safa')) : null;
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={tr(`الشوط ${n} من 7`, `Circuit ${n} of 7`)} style={{ alignItems: 'center', paddingVertical: 22, borderRadius: 22, backgroundColor: done ? t.colors.primarySoft : t.colors.fill }}>
        <Txt variant="display" weight="bold" color={done ? t.colors.primaryDeep : '#FFFFFF'}>
          {done ? '✓' : n + 1}
        </Txt>
        <Txt color={done ? t.colors.primaryDeep : 'rgba(255,255,255,0.9)'}>{done ? tr('أتممت سبعة أشواط', 'Seven circuits done') : tr(`الشوط ${n + 1} من 7 · المس عند إتمامه`, `Circuit ${n + 1} of 7 · tap when done`)}</Txt>
        {leg ? <Txt variant="caption" color="rgba(255,255,255,0.85)">{leg}</Txt> : null}
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        <IconButton icon={Minus} label={tr('أنقص شوطًا', 'One less')} onPress={() => setN((x) => Math.max(0, x - 1))} />
        <IconButton icon={RotateCcw} label={tr('من البداية', 'Start over')} onPress={() => setN(0)} />
      </View>
    </View>
  );
}

export default function Umrah() {
  const { tr } = useI18n();
  const [tab, setTab] = useState<'umrah' | 'hajj'>('umrah');

  return (
    <Screen title={tr('العمرة والحج', 'Umrah and Hajj')} subtitle={tr('خطوة بخطوة، بأدلتها', 'Step by step, with evidence')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={tr('العمرة', 'Umrah')} active={tab === 'umrah'} onPress={() => setTab('umrah')} />
        <Chip label={tr('أيام الحج', 'The days of Hajj')} active={tab === 'hajj'} onPress={() => setTab('hajj')} />
      </View>
      {tab === 'umrah' ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt variant="subheading">{tr('١. الإحرام والتلبية', '1. Ihram and talbiyah')}</Txt>
            <Txt muted>{tr('يُحرم من الميقات، ويلبّي حتى يبدأ الطواف.', 'Enter ihram at the miqat and say the talbiyah until tawaf begins.')}</Txt>
            <Evidence id={TALBIYAH} full />
          </Card>
          <Card style={{ gap: 10 }}>
            <Txt variant="subheading">{tr('٢. الطواف: سبعة أشواط', '2. Tawaf: seven circuits')}</Txt>
            <Txt muted>{tr('يبدأ كل شوط من الحجر الأسود، والكعبة عن يساره.', 'Each circuit starts at the Black Stone, with the Kaaba on your left.')}</Txt>
            <Counter kind="tawaf" />
            <Button title={tr('التكبير عند الحجر الأسود', 'Takbir at the Black Stone')} icon={HandHeart} tone="soft" onPress={() => hisn(116)} />
            <Button title={tr('الدعاء بين الركن اليماني والحجر', 'Between the Yemeni corner and the Stone')} icon={HandHeart} tone="soft" onPress={() => hisn(117)} />
          </Card>
          <Card style={{ gap: 8 }}>
            <Txt variant="subheading">{tr('٣. ركعتان خلف المقام', '3. Two rak‘ahs behind the Maqam')}</Txt>
            <Txt muted>{tr('كما في حديث جابر: صلى ركعتين قرأ فيهما ﴿قُلْ يَٰٓأَيُّهَا ٱلْكَٰفِرُونَ﴾ و﴿قُلْ هُوَ ٱللَّهُ أَحَدٌ﴾.', 'As in Jabir’s hadith: two rak‘ahs with al-Kafirun and al-Ikhlas.')}</Txt>
          </Card>
          <Card style={{ gap: 10 }}>
            <Txt variant="subheading">{tr('٤. السعي: سبعة أشواط', '4. Sa‘y: seven circuits')}</Txt>
            <Txt muted>{tr('يبدأ بالصفا وينتهي بالمروة؛ الذهاب شوط والعودة شوط.', 'Start at as-Safa and end at al-Marwah; each way is one circuit.')}</Txt>
            <Counter kind="sai" />
            <Button title={tr('الدعاء على الصفا والمروة', 'At as-Safa and al-Marwah')} icon={HandHeart} tone="soft" onPress={() => hisn(118)} />
          </Card>
          <Card style={{ gap: 8 }}>
            <Txt variant="subheading">{tr('٥. الحلق أو التقصير', '5. Shaving or shortening the hair')}</Txt>
            <Txt muted>{tr('وبه تتم العمرة. والمرأة تقصّر.', 'And the Umrah is complete. Women shorten.')}</Txt>
          </Card>
          <Evidence id={UMRAH_VIRTUE} full />
        </>
      ) : (
        <>
          {[
            [tr('اليوم الثامن (التروية)', '8th (Tarwiyah)'), tr('الإحرام بالحج والتوجه إلى منى، وصلاة الظهر والعصر والمغرب والعشاء والفجر بها كما في حديث جابر.', 'Ihram for Hajj and to Mina, praying Dhuhr, Asr, Maghrib, Isha and Fajr there, as in Jabir’s hadith.')],
            [tr('اليوم التاسع (عرفة)', '9th (Arafah)'), tr('الوقوف بعرفة والدعاء حتى الغروب، ثم الدفع إلى مزدلفة والمبيت بها.', 'Standing at Arafah in dua until sunset, then to Muzdalifah for the night.')],
            [tr('اليوم العاشر (النحر)', '10th (Sacrifice)'), tr('رمي جمرة العقبة بسبع حصيات يكبّر مع كل حصاة، ثم النحر، ثم الحلق، ثم طواف الإفاضة.', 'Stone Jamrat al-ʿAqabah with seven pebbles, a takbir with each; then the sacrifice, shaving, and tawaf al-ifadah.')],
            [tr('أيام التشريق (11–13)', 'Tashreeq (11th–13th)'), tr('المبيت بمنى ورمي الجمرات الثلاث كل يوم بعد الزوال، ولمن تعجّل في يومين.', 'Nights at Mina and stoning the three jamarat each day after noon; one may leave after two days.')],
          ].map(([title, body]) => (
            <Card key={title} style={{ gap: 6 }}>
              <Txt variant="subheading">{title}</Txt>
              <Txt style={{ lineHeight: 24 }}>{body}</Txt>
            </Card>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={tr('دعاء يوم عرفة', 'Dua of Arafah')} onPress={() => hisn(119)} />
            <Chip label={tr('الذكر عند المشعر الحرام', 'At al-Mashʿar al-Haram')} onPress={() => hisn(120)} />
            <Chip label={tr('التكبير عند رمي الجمار', 'Takbir when stoning')} onPress={() => hisn(121)} />
          </View>
          <Evidence id={JABIR} />
        </>
      )}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('هذا مختصر للتذكير لا يغني عن سؤال أهل العلم، ففي تفاصيل المناسك وأحكامها خلاف معروف بين المذاهب.', 'A short reminder, not a substitute for asking scholars; the details of the rites differ between the schools.')}
      </Txt>
    </Screen>
  );
}
