import type { Locale } from '@/lib/i18n/config';

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

/*
 * Starting drafts written for how this codebase actually handles data. They are not legal advice: have them
 * reviewed against the Saudi Personal Data Protection Law (PDPL) and your company details before launch.
 */
const privacy: Record<Locale, LegalDoc> = {
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: نوفمبر 2026',
    intro: 'نحترم خصوصيتك. توضح هذه السياسة البيانات التي يجمعها موقع وارد، ولماذا، وكيف نحميها، وما حقوقك تجاهها.',
    sections: [
      {
        heading: 'البيانات التي تقدمها لنا',
        body: 'عند الاشتراك في النشرة البريدية نحفظ بريدك الإلكتروني ولغتك المفضلة وحالة الاشتراك. وعند مراسلتنا عبر نماذج التواصل أو الرعاية أو الانضمام للفريق نحفظ ما تكتبه في النموذج (مثل الاسم والبريد والرسالة) لنرد عليك ونتابع طلبك.',
      },
      {
        heading: 'إحصائيات الاستخدام',
        body: 'نقيس الزيارات وتشغيل الحلقات بأداة داخلية دون أدوات تتبع من أطراف ثالثة ودون ملفات تعريف ارتباط إعلانية. نسجل نوع الحدث (مثل مشاهدة صفحة أو بدء تشغيل حلقة)، والصفحة، ونوع الجهاز بشكل عام، والدولة، والموقع الذي أتيت منه. لا نخزّن عنوان IP الخاص بك.\n\nينشئ متصفحك معرّفًا عشوائيًا مجهول الهوية يُحفظ في التخزين المحلي للمتصفح، نستخدمه لحساب عدد المستمعين وحفظ موضع استماعك. إذا فعّلت إشارة «عدم التتبع» أو «Global Privacy Control» في متصفحك فلن نربط الأحداث بهذا المعرّف.',
      },
      {
        heading: 'التخزين المحلي في متصفحك',
        body: 'نحفظ في متصفحك تفضيلات مثل المظهر (فاتح أو داكن) وموضع الاستماع وسرعة التشغيل، حتى تكمل من حيث توقفت. تستطيع حذفها في أي وقت من إعدادات المتصفح.',
      },
      {
        heading: 'المحتوى المضمّن من منصات أخرى',
        body: 'قد تحتوي بعض الصفحات على مشغلات من يوتيوب أو سبوتيفاي أو آبل بودكاست. لا يُحمَّل مشغل يوتيوب إلا بعد أن تضغط عليه. عند استخدامك هذه المشغلات تطبَّق سياسات الخصوصية الخاصة بتلك المنصات.',
      },
      {
        heading: 'لماذا نستخدم بياناتك',
        body: 'نستخدم البيانات لإرسال النشرة لمن اشترك فيها، والرد على الرسائل والطلبات، وتحسين المحتوى وتجربة الموقع، وحماية الموقع من إساءة الاستخدام. لا نبيع بياناتك الشخصية لأي جهة.',
      },
      {
        heading: 'أين تُحفظ البيانات ومن يصل إليها',
        body: 'تُحفظ البيانات لدى مزودي خدمات سحابية نتعامل معهم لتشغيل الموقع (استضافة الموقع وقاعدة البيانات وإرسال البريد). يصل إليها فريق وارد المخوَّل فقط وبحسب صلاحية كل شخص، وتُسجَّل العمليات الإدارية في سجل تدقيق.',
      },
      {
        heading: 'مدة الاحتفاظ',
        body: 'نحتفظ ببيانات النشرة ما دام اشتراكك قائمًا، وبرسائل التواصل والطلبات بالقدر اللازم لمتابعتها. تُحذف سجلات الحماية من إساءة الاستخدام تلقائيًا خلال يوم.',
      },
      {
        heading: 'حقوقك',
        body: 'يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها، وإلغاء الاشتراك في النشرة في أي وقت عبر الرابط الموجود في كل رسالة. لأي طلب يتعلق بالخصوصية راسلنا عبر صفحة «تواصل معنا».',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: November 2026',
    intro: 'We respect your privacy. This policy explains what data the Wared website collects, why, how we protect it, and your rights.',
    sections: [
      {
        heading: 'Data you give us',
        body: 'When you subscribe to the newsletter we store your email address, preferred language and subscription status. When you contact us through the contact, sponsorship or careers forms we store what you write in the form (such as name, email and message) so we can reply and follow up.',
      },
      {
        heading: 'Usage statistics',
        body: 'We measure visits and episode plays with our own first-party tool, without third-party trackers or advertising cookies. We record the event type (such as a page view or an episode play), the page, a broad device category, the country and the referring website. We do not store your IP address.\n\nYour browser creates a random, anonymous identifier kept in its local storage, which we use to count listeners and save your listening position. If your browser sends a Do Not Track or Global Privacy Control signal, we do not attach events to that identifier.',
      },
      {
        heading: 'Local storage in your browser',
        body: 'We store preferences such as theme (light or dark), listening position and playback speed in your browser so you can pick up where you left off. You can clear them at any time in your browser settings.',
      },
      {
        heading: 'Embedded content from other platforms',
        body: 'Some pages include players from YouTube, Spotify or Apple Podcasts. The YouTube player only loads after you click it. When you use these players, those platforms’ own privacy policies apply.',
      },
      {
        heading: 'Why we use your data',
        body: 'To send the newsletter to subscribers, reply to messages and requests, improve our content and website, and protect the site from abuse. We do not sell your personal data.',
      },
      {
        heading: 'Where data is stored and who can access it',
        body: 'Data is stored with the cloud providers we use to run the website (hosting, database and email delivery). Only authorised Wared team members can access it, according to their role, and administrative actions are recorded in an audit log.',
      },
      {
        heading: 'Retention',
        body: 'We keep newsletter data while your subscription is active, and messages and requests for as long as needed to handle them. Abuse-protection records are deleted automatically within a day.',
      },
      {
        heading: 'Your rights',
        body: 'You can ask to access, correct or delete your data, and unsubscribe from the newsletter at any time using the link in every email. For any privacy request, contact us through the Contact page.',
      },
    ],
  },
};

const terms: Record<Locale, LegalDoc> = {
  ar: {
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث: نوفمبر 2026',
    intro: 'باستخدامك موقع وارد فإنك توافق على هذه الشروط. نرجو قراءتها بعناية.',
    sections: [
      {
        heading: 'المحتوى وحقوقه',
        body: 'جميع الحلقات والنصوص والصور والتصاميم والعلامات المنشورة على وارد مملوكة لوارد أو لأصحابها المرخِّصين، ومحمية بموجب أنظمة الملكية الفكرية. يُسمح لك بالاستماع والمشاهدة والمشاركة عبر الروابط للاستخدام الشخصي، ولا يجوز إعادة نشر المحتوى أو تعديله أو استخدامه تجاريًا دون إذن مكتوب.',
      },
      {
        heading: 'الآراء الواردة في المحتوى',
        body: 'الآراء التي يطرحها الضيوف تعبّر عن أصحابها ولا تمثل بالضرورة رأي وارد. المحتوى للمعرفة والنقاش ولا يُعد استشارة مهنية أو طبية أو قانونية أو مالية.',
      },
      {
        heading: 'المحتوى المدعوم',
        body: 'نوضح بشكل صريح أي محتوى مدعوم أو برعاية جهة ما، ولا يتدخل الرعاة في المحتوى التحريري.',
      },
      {
        heading: 'الاستخدام المقبول',
        body: 'يُمنع استخدام الموقع بأي طريقة تضر به أو بمستخدميه، بما في ذلك محاولة الوصول غير المصرح به، أو إرسال رسائل مزعجة عبر النماذج، أو جمع البيانات آليًا بشكل يثقل على الخدمة.',
      },
      {
        heading: 'روابط ومنصات خارجية',
        body: 'قد يحتوي الموقع على روابط أو مشغلات من منصات خارجية. لا نتحمل مسؤولية محتوى تلك المنصات أو سياساتها.',
      },
      {
        heading: 'التعديلات',
        body: 'قد نحدّث هذه الشروط من وقت لآخر، ويسري التحديث من تاريخ نشره في هذه الصفحة.',
      },
      {
        heading: 'النظام المطبق',
        body: 'تخضع هذه الشروط لأنظمة المملكة العربية السعودية.',
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: November 2026',
    intro: 'By using the Wared website you agree to these terms. Please read them carefully.',
    sections: [
      {
        heading: 'Content and rights',
        body: 'All episodes, text, images, designs and marks published on Wared are owned by Wared or its licensors and protected by intellectual property laws. You may listen, watch and share links for personal use. You may not republish, modify or commercially use the content without written permission.',
      },
      {
        heading: 'Opinions in our content',
        body: 'Opinions expressed by guests are their own and do not necessarily represent Wared. Content is for information and discussion and is not professional, medical, legal or financial advice.',
      },
      {
        heading: 'Sponsored content',
        body: 'We clearly disclose any sponsored content. Sponsors do not influence editorial content.',
      },
      {
        heading: 'Acceptable use',
        body: 'Do not use the site in any way that harms it or its users, including attempting unauthorised access, sending spam through the forms, or automated scraping that burdens the service.',
      },
      {
        heading: 'External links and platforms',
        body: 'The site may include links to or players from external platforms. We are not responsible for their content or policies.',
      },
      {
        heading: 'Changes',
        body: 'We may update these terms from time to time. Updates apply from the date they are published on this page.',
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws of the Kingdom of Saudi Arabia.',
      },
    ],
  },
};

export const legal = { privacy, terms };
