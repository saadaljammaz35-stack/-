// Privacy policy and terms of use. One source for the in-app screens and the public web pages
// (scripts/legal-pages.mjs) that the app stores link to. Keep it free of React Native imports.

export type Bilingual = { ar: string; en: string };
export type LegalSection = { heading: Bilingual; paragraphs: Bilingual[] };
export type LegalDoc = { id: 'privacy' | 'terms'; title: Bilingual; updated: Bilingual; sections: LegalSection[] };

const UPDATED: Bilingual = { ar: 'تاريخ السريان: ٢٦ أكتوبر ٢٠٢٦م', en: 'Effective date: 26 October 2026' };
const PRIVACY_UPDATED: Bilingual = { ar: 'تاريخ السريان: ٢٨ أكتوبر ٢٠٢٦م', en: 'Effective date: 28 October 2026' };

export const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: { ar: 'مقدمة', en: 'Introduction' },
      paragraphs: [
        {
          ar: '«مع الله» تطبيق إسلامي للقرآن الكريم والصلاة والأذكار. توضّح هذه السياسة ما يحدث لبياناتك عند استخدامه. باختصار: بياناتك تبقى على جهازك، ولا نجمع عنك شيئًا.',
          en: '«Ma Allah» is an Islamic app for the Quran, prayer and adhkar. This policy explains what happens to your data when you use it. In short: your data stays on your device and we do not collect anything about you.',
        },
      ],
    },
    {
      heading: { ar: 'البيانات التي نجمعها', en: 'Data we collect' },
      paragraphs: [
        {
          ar: 'لا نجمع أي بيانات شخصية ولا نرسل بياناتك إلى خوادم تابعة لنا، ولا يتطلب استخدام التطبيق إنشاء حساب.',
          en: 'We do not collect any personal data or send your data to servers of ours, and using the app does not require an account.',
        },
      ],
    },
    {
      heading: { ar: 'البيانات المحفوظة على جهازك', en: 'Data stored on your device' },
      paragraphs: [
        {
          ar: 'يحفظ التطبيق على جهازك فقط: الإعدادات، والمدينة وإحداثياتها، وموضع القراءة والعلامات، والختمات، وتقدّم الأذكار والمفضلة، والمسبحة، وسجل الصيام، وسجل صلواتك وصلوات القضاء، وتقدّم الحفظ ومواعيد المراجعة، وكتب الحديث والتلاوات التي تختار تحميلها.',
          en: 'The app stores only on your device: settings, your city and its coordinates, reading position and bookmarks, khatmas, adhkar progress and favourites, tasbih counts, the fasting log, your prayer log and prayers to make up, memorisation progress and review dates, and any hadith books and recitations you choose to download.',
        },
        {
          ar: 'تُحذف هذه البيانات بحذف التطبيق، أو من «الإعدادات ← الخصوصية وحذف البيانات». ويمكنك تصدير نسخة احتياطية منها إلى ملف تحتفظ به أنت.',
          en: 'This data is deleted when you delete the app, or from Settings → Privacy & data. You can also export a backup file that you keep yourself.',
        },
        {
          ar: 'قد يُدرج نظام جهازك بيانات التطبيق ضمن نسخه الاحتياطية (iCloud أو Google) بحسب إعداداتك أنت، وذلك خارج تحكّم التطبيق.',
          en: 'Your device’s operating system may include the app’s data in its own backups (iCloud or Google) depending on your settings; this is outside the app’s control.',
        },
      ],
    },
    {
      heading: { ar: 'الموقع', en: 'Location' },
      paragraphs: [
        {
          ar: 'يُطلب إذن الموقع فقط عند اختيارك «استخدام موقعي»، ويُستخدم على الجهاز لحساب مواقيت الصلاة واتجاه القبلة، ولا نرسله إلينا. يحدّد التطبيق اسم مدينتك من قاعدة مدن مضمّنة فيه؛ وإن لم توجد مدينة قريبة فقد يستعين بخدمة تحديد الأماكن في نظام جهازك (Apple أو Google) لمعرفة اسمها.',
          en: 'Location permission is requested only when you choose “Use my location”. It is used on the device to compute prayer times and the Qibla, and is never sent to us. The city name comes from a city database built into the app; if no nearby city is found, your device’s own geocoding service (Apple or Google) may be used to look up the name.',
        },
        {
          ar: 'عند فتحك صفحة «المساجد القريبة» فقط، يُرسل التطبيق موقعًا تقريبيًا (مقرّبًا إلى نحو ١٠٠ متر) إلى خدمة Overpass العامة لخريطة الشارع المفتوحة (OpenStreetMap) لجلب المساجد المسجّلة حولك. لا يُرسل معه أي معرّف، ولا نحتفظ نحن بشيء منه، ويخضع لسياسة خصوصية تلك الخدمة.',
          en: 'Only when you open “Nearby mosques”, the app sends an approximate position (rounded to about 100 metres) to the public Overpass service of OpenStreetMap to fetch the mosques mapped around you. No identifier is sent with it, we keep nothing of it, and it is subject to that service’s privacy policy.',
        },
        {
          ar: 'يمكنك اختيار مدينتك يدويًا دون منح إذن الموقع.',
          en: 'You can pick your city manually without granting location permission.',
        },
        {
          ar: 'عدّاد الخطوات: عند استخدامك «خطواتك إلى المسجد» فقط يطلب التطبيق إذن النشاط البدني لعدّ خطواتك، ويبقى العدد وسجل مشاويرك على جهازك ولا يُرسل إلى أي جهة.',
          en: 'Step counter: only when you use “Steps to the mosque” does the app ask for motion & fitness (activity recognition) permission to count your steps. The count and your walks stay on your device and are never sent anywhere.',
        },
        {
          ar: '«صامت في المسجد» (أندرويد): إن فعّلته ومنحت التطبيق صلاحية «عدم الإزعاج»، يشغّل الوضع قبل الإقامة ويعيده بعد الصلاة، ويجري ذلك كله على جهازك.',
          en: '“Silent at the mosque” (Android): if you turn it on and grant Do Not Disturb access, the app switches Do Not Disturb on before the iqama and back after the prayer, entirely on your device.',
        },
      ],
    },
    {
      heading: { ar: 'الإشعارات', en: 'Notifications' },
      paragraphs: [
        {
          ar: 'تُجدول تنبيهات الأذان والأذكار والتذكيرات محليًا على جهازك. لا نستخدم خوادم إشعارات ولا نجمع معرّف جهازك.',
          en: 'Adhan, adhkar and reminder notifications are scheduled locally on your device. We do not use notification servers or collect your device identifier.',
        },
      ],
    },
    {
      heading: { ar: 'الخدمات الخارجية', en: 'Third-party services' },
      paragraphs: [
        {
          ar: 'عند طلبك فقط يتصل التطبيق بهذه الجهات: Quran.com (التلاوات والتفاسير الإضافية والترجمات)، وGitHub/jsDelivr (تحميل كتب الحديث)، وYouTube (بث الحرمين)، وmp3quran.net (الإذاعات). وتُفتح مواقع الفتاوى الرسمية ومنصة «إحسان» في المتصفح.',
          en: 'Only when you ask for it, the app connects to: Quran.com (recitations, additional tafsir and translations), GitHub/jsDelivr (hadith book downloads), YouTube (Haramain live streams) and mp3quran.net (radio). Official fatwa sites and the Ehsan platform open in your browser.',
        },
        {
          ar: 'تتلقى هذه الجهات عنوان IP وبيانات الطلب كأي اتصال بالإنترنت، وتخضع لسياسات الخصوصية الخاصة بها.',
          en: 'These services receive your IP address and the request like any internet connection, and are governed by their own privacy policies.',
        },
      ],
    },
    {
      heading: { ar: 'الختمة الجماعية (اختيارية)', en: 'Group khatma (optional)' },
      paragraphs: [
        {
          ar: 'إذا أنشأت ختمة جماعية أو انضممت إليها، يُحفظ في خادم التطبيق (Supabase، في منطقة مومباي) اسم الختمة، والاسم الذي تكتبه لنفسك، والأجزاء التي تختارها وحالة قراءتها، ورمز عشوائي يميّز جهازك. يرى هذه المعلومات كل من لديه رمز الختمة أو رابطها. لا نطلب بريدًا ولا رقمًا ولا حسابًا.',
          en: 'If you create or join a group khatma, the app’s server (Supabase, Mumbai region) stores the khatma’s name, the name you enter for yourself, the juz you take and whether they are read, and a random code that identifies your device. Anyone with the khatma’s code or link can see this. No email, phone number or account is asked for.',
        },
        {
          ar: 'يحذف منشئ الختمة الختمة وكل ما فيها متى شاء، ويستطيع كل مشارك ترك جزئه. لطلب حذف أي بيانات أخرى راسلنا على بريد الدعم.',
          en: 'The creator can delete the khatma and everything in it at any time, and any member can give back their juz. To ask for any other data to be deleted, write to the support email.',
        },
      ],
    },
    {
      heading: { ar: 'الحساب والمزامنة (اختياري)', en: 'Account and sync (optional)' },
      paragraphs: [
        {
          ar: 'إذا توفّرت ميزة الحساب وفعّلتها، يُحفظ بريدك الإلكتروني ونسخة من بياناتك في قاعدة بيانات محمية (Supabase) لا يصل إليها غيرك، لمزامنتها بين أجهزتك. يمكنك حذف الحساب وكل بياناته من التطبيق في أي وقت.',
          en: 'If the account feature is available and you turn it on, your email and a copy of your data are stored in a protected database (Supabase) that only you can access, to sync between your devices. You can delete the account and all of its data from the app at any time.',
        },
      ],
    },
    {
      heading: { ar: 'ما لا نفعله', en: 'What we do not do' },
      paragraphs: [
        {
          ar: 'لا نعرض إعلانات، ولا نستخدم أدوات تتبّع أو تحليلات، ولا نبيع بياناتك أو نشاركها مع أحد.',
          en: 'We show no ads, use no trackers or analytics, and never sell or share your data.',
        },
      ],
    },
    {
      heading: { ar: 'الأطفال', en: 'Children' },
      paragraphs: [
        {
          ar: 'التطبيق مناسب لجميع الأعمار، ولا يجمع بيانات من أي مستخدم، بمن فيهم الأطفال.',
          en: 'The app is suitable for all ages and collects no data from any user, including children.',
        },
      ],
    },
    {
      heading: { ar: 'التغييرات على هذه السياسة', en: 'Changes to this policy' },
      paragraphs: [
        {
          ar: 'إذا عدّلنا هذه السياسة نشرنا النسخة المحدّثة هنا مع تاريخ سريانها.',
          en: 'If we change this policy, we will publish the updated version here with its effective date.',
        },
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  id: 'terms',
  title: { ar: 'شروط الاستخدام', en: 'Terms of Use' },
  updated: UPDATED,
  sections: [
    {
      heading: { ar: 'القبول', en: 'Acceptance' },
      paragraphs: [
        {
          ar: 'باستخدامك تطبيق «مع الله» فإنك توافق على هذه الشروط. إن لم توافق عليها فلا تستخدم التطبيق.',
          en: 'By using «Ma Allah» you agree to these terms. If you do not agree, please do not use the app.',
        },
      ],
    },
    {
      heading: { ar: 'طبيعة المحتوى', en: 'About the content' },
      paragraphs: [
        {
          ar: 'التطبيق مرجع للقرآن الكريم والتفسير والأذكار والأحاديث، وكل نص شرعي فيه منقول من مصدر موثّق مذكور في «المصادر والتوثيق»؛ لا يُكتب يدويًا ولا يُولَّد بالذكاء الاصطناعي. نبذل جهدنا في الدقة، فإن لاحظت خطأً فأبلغنا ليُراجع من مصدره.',
          en: 'The app is a reference for the Quran, tafsir, adhkar and hadith. Every religious text in it comes from a documented source listed under “Sources”; none is typed by hand or generated by AI. We work hard on accuracy; if you notice an error, please tell us so it can be checked against its source.',
        },
      ],
    },
    {
      heading: { ar: 'ليس فتوى', en: 'Not a fatwa service' },
      paragraphs: [
        {
          ar: 'التطبيق لا يُصدر فتاوى ولا أحكامًا شرعية. قسم الفتاوى يحيلك إلى المواقع الرسمية لأهل العلم، وفي مسائلك الخاصة يُرجع إلى العلماء مباشرة.',
          en: 'The app does not issue fatwas or religious rulings. The fatwa section refers you to the official websites of scholars; for your own questions, consult scholars directly.',
        },
      ],
    },
    {
      heading: { ar: 'المواقيت والتقويم والقبلة', en: 'Prayer times, calendar and Qibla' },
      paragraphs: [
        {
          ar: 'مواقيت الصلاة حسابات فلكية بحسب الطريقة التي تختارها، وقد تختلف قليلًا عن تقويم مسجدك أو الجهات الرسمية في بلدك. والتاريخ الهجري محسوب وفق تقويم أم القرى، ويُعتمد في دخول الشهور على إعلان رؤية الهلال الرسمي. واتجاه القبلة يعتمد على دقة حساسات جهازك ومعايرتها.',
          en: 'Prayer times are astronomical calculations based on the method you choose and may differ slightly from your mosque’s timetable or the official authorities in your country. Hijri dates follow the Umm al-Qura calendar; the start of months follows official moon-sighting announcements. The Qibla direction depends on the accuracy and calibration of your device’s sensors.',
        },
      ],
    },
    {
      heading: { ar: 'التنبيهات', en: 'Notifications' },
      paragraphs: [
        {
          ar: 'تعتمد التنبيهات على إعدادات جهازك (الأذونات، والوضع الصامت، وتوفير الطاقة)، فلا نضمن وصول كل تنبيه في وقته في جميع الأحوال.',
          en: 'Notifications depend on your device settings (permissions, silent mode, battery saving), so we cannot guarantee that every notification arrives on time in every situation.',
        },
      ],
    },
    {
      heading: { ar: 'الخدمات والروابط الخارجية', en: 'External services and links' },
      paragraphs: [
        {
          ar: 'البث المباشر والإذاعات ومواقع الفتاوى ومنصة التبرع تقدّمها جهات أخرى وتخضع لشروطها، ولسنا مسؤولين عن محتواها أو عن توفّرها.',
          en: 'Live streams, radio, fatwa websites and the donation platform are provided by others and governed by their terms; we are not responsible for their content or availability.',
        },
      ],
    },
    {
      heading: { ar: 'التبرع', en: 'Donations' },
      paragraphs: [
        {
          ar: 'يتم التبرع مباشرة عبر منصة «إحسان» الوطنية الرسمية. التطبيق لا يجمع أموالًا ولا يعالج أي مدفوعات ولا يطلب بيانات بطاقات.',
          en: 'Donations are made directly on the official national Ehsan platform. The app does not collect money, process payments or ask for card details.',
        },
      ],
    },
    {
      heading: { ar: 'الملكية الفكرية', en: 'Intellectual property' },
      paragraphs: [
        {
          ar: 'نصوص المصادر مملوكة لأصحابها وتُستخدم وفق تراخيصها المذكورة في «المصادر والتوثيق». أما تصميم التطبيق وشعاره وبرمجته فهي لمالك التطبيق.',
          en: 'Source texts belong to their owners and are used under the licences listed under “Sources”. The app’s design, logo and code belong to the app’s owner.',
        },
      ],
    },
    {
      heading: { ar: 'الاستخدام المقبول', en: 'Acceptable use' },
      paragraphs: [
        {
          ar: 'لا يجوز استخدام التطبيق أو محتواه في تحريف النصوص الشرعية أو نسبتها إلى غير مصدرها، أو في أي غرض مخالف للأنظمة.',
          en: 'You may not use the app or its content to alter religious texts, attribute them to the wrong source, or for any unlawful purpose.',
        },
      ],
    },
    {
      heading: { ar: 'إخلاء المسؤولية', en: 'Disclaimer' },
      paragraphs: [
        {
          ar: 'يُقدَّم التطبيق «كما هو». وفي حدود ما تسمح به الأنظمة، لا نتحمّل مسؤولية أي ضرر ينتج عن استخدامه أو عن تعذّر استخدامه.',
          en: 'The app is provided “as is”. To the extent permitted by law, we are not liable for any damage arising from using it or being unable to use it.',
        },
      ],
    },
    {
      heading: { ar: 'تعديل الشروط', en: 'Changes to these terms' },
      paragraphs: [
        {
          ar: 'قد نحدّث هذه الشروط، وننشر النسخة المحدّثة هنا مع تاريخ سريانها. استمرارك في استخدام التطبيق يعني موافقتك عليها.',
          en: 'We may update these terms and will publish the new version here with its effective date. Continuing to use the app means you accept them.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS } as const;
