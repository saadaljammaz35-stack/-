import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Tap, Txt } from '@/components/ui';
import { BOOKS } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import booksMeta from '../../../data/hadith/books.json';

type Entry = { title: string; detail: string; links: { label: string; url: string }[] };

function Link({ label, url }: { label: string; url: string }) {
  const t = useTheme();
  return (
    <Tap onPress={() => WebBrowser.openBrowserAsync(url)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <ExternalLink size={14} color={t.colors.primary} />
      <Txt variant="caption" color={t.colors.primary}>
        {label}
      </Txt>
    </Tap>
  );
}

export default function SourcesScreen() {
  const { tr } = useI18n();
  const commit = booksMeta.commit.slice(0, 7);

  const entries: Entry[] = [
    {
      title: tr('نص القرآن الكريم والمصحف', 'Quran text & mushaf'),
      detail: tr(
        'الرسم العثماني برواية حفص بخط مجمع الملك فهد لطباعة المصحف الشريف (KFGQPC Uthmanic Hafs)، وترتيب الصفحات والأسطر على مصحف المدينة (٦٠٤ صفحات). جُلب النص من واجهة Quran.com وقوبل آليًا آية آية بنص مشروع تنزيل، فتطابقت الآيات ٦٢٣٦ كلها.',
        'Uthmani Hafs script in the King Fahd Complex font, Madinah mushaf layout (604 pages). Text from the Quran.com API, cross-checked verse by verse against Tanzil — all 6,236 verses match.',
      ),
      links: [
        { label: 'qurancomplex.gov.sa', url: 'https://qurancomplex.gov.sa' },
        { label: 'quran.com', url: 'https://quran.com' },
        { label: 'tanzil.net', url: 'https://tanzil.net' },
      ],
    },
    {
      title: tr('التفاسير والترجمات والتلاوات', 'Tafsir, translations & recitations'),
      detail: tr(
        'التفسير الميسر (مجمع الملك فهد) وتفسير السعدي مضمّنان في التطبيق. تفاسير ابن كثير والطبري والقرطبي والبغوي والوسيط وترجمات المعاني والتلاوات مع توقيت الآيات تُجلب عند الطلب من Quran.com.',
        'Al-Muyassar (King Fahd Complex) and al-Sa‘di are bundled. Ibn Kathir, al-Tabari, al-Qurtubi, al-Baghawi, al-Wasit, translations and recitations with verse timings are loaded on demand from Quran.com.',
      ),
      links: [{ label: 'quran.com', url: 'https://quran.com' }],
    },
    {
      title: tr('حصن المسلم', 'Hisn al-Muslim'),
      detail: tr(
        'تأليف د. سعيد بن علي بن وهف القحطاني رحمه الله، بترقيم الطبعة المطبوعة وحواشي التخريج كما في الكتاب. الصوتيات من موقع حصن المسلم.',
        'By Dr Sa‘id ibn ‘Ali ibn Wahf al-Qahtani, with the printed numbering and the book’s own takhrij footnotes. Audio from hisnmuslim.com.',
      ),
      links: [
        { label: 'turath.io', url: 'https://app.turath.io/book/31307' },
        { label: 'hisnmuslim.com', url: 'https://www.hisnmuslim.com' },
      ],
    },
    {
      title: tr('أذكار الصباح والمساء', 'Morning & evening adhkar'),
      detail: tr('قاعدة بيانات مفتوحة تذكر مع كل ذكر تخريجه وفضله ومصدره.', 'An open database that lists each dhikr with its takhrij, virtue and source.'),
      links: [{ label: 'GitHub — Seen-Arabic', url: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB' }],
    },
    {
      title: tr('كتب الحديث', 'Hadith collections'),
      detail: tr(
        `${BOOKS.map((b) => b.name).join('، ')}. النصوص من مستودع hadith-api المفتوح بإصدار مثبّت (${commit})، ويُتحقق من كل ملف بالبصمة SHA-256 وبمطابقة أحاديث مرجعية قبل حفظه، وأحكام العلماء تُنقل كما وردت. مسند الإمام أحمد غير متاح لعدم وجود نسخة رقمية موثقة كاملة مفتوحة الترخيص.`,
        `${BOOKS.map((b) => b.id).join(', ')}. Texts from the open hadith-api repository at a pinned commit (${commit}); each file is verified by SHA-256 and reference hadiths before it is saved, and gradings are shown as published. Musnad Ahmad is not included because no complete, verified, openly licensed digital edition was found.`,
      ),
      links: [{ label: 'GitHub — hadith-api', url: booksMeta.source }],
    },
    {
      title: tr('موسوعة الأحاديث النبوية', 'HadeethEnc'),
      detail: tr(
        'أحاديث مع الشرح والتخريج والحكم ومعاني المفردات، منقولة دون تعديل مع العزو إلى الموسوعة.',
        'Hadiths with explanation, takhrij, grade and vocabulary, reproduced unchanged with attribution.',
      ),
      links: [{ label: 'hadeethenc.com', url: 'https://hadeethenc.com' }],
    },
    {
      title: tr('أسماء الله الحسنى', 'Names of Allah'),
      detail: tr(
        'القائمة من رواية الترمذي (٣٥٠٧)، وسرد الأسماء فيها ضعيف عند أهل الحديث كما يبيّن التطبيق، والشرح من كتاب «شأن الدعاء» للخطابي.',
        'The list follows al-Tirmidhi 3507 (whose listing of the names is graded weak, as the app states). Explanations are from al-Khattabi’s Sha’n al-Du‘a’.',
      ),
      links: [{ label: 'turath.io — شأن الدعاء', url: 'https://app.turath.io/book/95700' }],
    },
    {
      title: tr('المواقيت والتقويم والمدن', 'Prayer times, calendar & cities'),
      detail: tr(
        'حساب المواقيت بمكتبة Adhan المفتوحة على الجهاز، والتاريخ الهجري بتقويم أم القرى، وقاعدة المدن من GeoNames (CC BY 4.0).',
        'Prayer times computed on-device with the open-source Adhan library, the Hijri date from the Umm al-Qura calendar, and cities from GeoNames (CC BY 4.0).',
      ),
      links: [
        { label: 'github.com/batoulapps/adhan-js', url: 'https://github.com/batoulapps/adhan-js' },
        { label: 'geonames.org', url: 'https://www.geonames.org' },
      ],
    },
    {
      title: tr('البث والإذاعات والفتاوى', 'Live streams, radio & fatwas'),
      detail: tr(
        'بث الحرمين من القنوات الرسمية على يوتيوب، والإذاعات من mp3quran.net، والفتاوى تُفتح في مواقعها الرسمية دون أي تعديل أو توليد.',
        'Haramain streams from the official YouTube channels, radio from mp3quran.net, and fatwas open on their official sites without modification or generation.',
      ),
      links: [
        { label: 'binbaz.org.sa', url: 'https://binbaz.org.sa' },
        { label: 'binothaimeen.net', url: 'https://binothaimeen.net' },
        { label: 'alifta.gov.sa', url: 'https://www.alifta.gov.sa' },
        { label: 'islamqa.info', url: 'https://islamqa.info/ar' },
        { label: 'mp3quran.net', url: 'https://mp3quran.net' },
      ],
    },
    {
      title: tr('الخطوط والأيقونات', 'Fonts & icons'),
      detail: tr('خط IBM Plex Sans Arabic وخط أميري (رخصة OFL)، وأيقونات Lucide (رخصة ISC).', 'IBM Plex Sans Arabic and Amiri (OFL), Lucide icons (ISC).'),
      links: [{ label: 'lucide.dev', url: 'https://lucide.dev' }],
    },
  ];

  return (
    <Screen title={tr('المصادر والتوثيق', 'Sources & attribution')}>
      <Txt muted>
        {tr(
          'لا يكتب التطبيق أي آية أو حديث أو ذكر يدويًا ولا يولّده بالذكاء الاصطناعي؛ كل نص منقول من مصدره ومذكور هنا.',
          'No verse, hadith or dhikr in the app is typed by hand or generated by AI; every text comes from the sources listed here.',
        )}
      </Txt>
      {entries.map((e) => (
        <Card key={e.title} style={{ gap: 8 }}>
          <Txt weight="semibold">{e.title}</Txt>
          <Txt variant="caption" muted>
            {e.detail}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {e.links.map((l) => (
              <Link key={l.url} {...l} />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
