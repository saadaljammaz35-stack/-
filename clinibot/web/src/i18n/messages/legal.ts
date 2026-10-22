import type { Namespace } from "../types";

// Arabic is the primary text. Copy rules are enforced by
// src/components/marketing/copyGate.test.ts. These pages describe what the
// software actually does; they make no claim of compliance or certification.

export default {
  ar: {
    privacyTitle: "سياسة الخصوصية",
    privacyIntro: "كيف يتعامل CliniBot مع البيانات، وأين تُحفظ، ومن يعالجها، وكيف تمارس حقوقك.",
    termsTitle: "شروط الاستخدام",
    termsIntro: "الشروط التي تحكم استخدام عيادتك لخدمة CliniBot.",
    lastUpdated: "آخر تحديث: {date}",
    tocTitle: "المحتويات",
    languageNote: "هذه الصفحة متاحة بالعربية والإنجليزية، وعند اختلاف النصين يُعتمد النص العربي.",
    backToTop: "العودة إلى المحتويات",
    contactFormLink: "نموذج التواصل",
    seeAlsoTerms: "اقرأ أيضاً {link}.",
    seeAlsoPrivacy: "اقرأ أيضاً {link}.",

    // Privacy policy
    p_who_title: "من نحن",
    p_who_1:
      "CliniBot خدمة برمجية تقدّم للعيادات في المملكة العربية السعودية مساعد استقبال يعمل بالذكاء الاصطناعي، يرد على المرضى عبر محادثة الموقع وواتساب للأعمال، ويسجّل طلبات المواعيد، ويحوّل المحادثات لفريق العيادة.",
    p_who_2:
      "توضح هذه السياسة البيانات التي نتعامل معها، ولماذا، وأين تُحفظ، ومن يعالجها، وكيف تمارس حقوقك. وتنطبق على موقع CliniBot ولوحة التحكم ومحادثات المرضى مع مساعدي العيادات.",
    p_roles_title: "دور العيادة ودور CliniBot",
    p_roles_1:
      "كل عيادة تستخدم CliniBot هي التي تقرر كيف تُستخدم بيانات مرضاها ولأي غرض، ويعالج CliniBot هذه البيانات نيابةً عن العيادة ووفق إعداداتها. لذلك توجَّه أسئلة المرضى عن بياناتهم أولاً إلى العيادة التي راسلوها.",
    p_roles_2:
      "CliniBot مسؤول مباشرةً عن بيانات حسابات العيادات وفرق عملها، وعن طلبات العروض التوضيحية المرسلة من هذا الموقع.",
    p_data_title: "البيانات التي نجمعها",
    p_data_intro: "نجمع ما يلزم لتشغيل الخدمة فقط:",
    p_data_staff:
      "حسابات فريق العيادة: الاسم والبريد الإلكتروني والدور في العيادة. لا تُحفظ كلمات المرور بصيغة مقروءة.",
    p_data_messages:
      "رسائل المرضى: نص المحادثات مع المساعد في محادثة الموقع أو واتساب، وردود المساعد وفريق العيادة.",
    p_data_appointments:
      "طلبات المواعيد: الاسم ورقم الجوال فقط، مع الخدمة المطلوبة والتاريخ والوقت المفضلين. لا يطلب المساعد رقم الهوية أو الإقامة أو التأمين أو التاريخ المرضي.",
    p_data_whatsapp: "بيانات واتساب: رقم واتساب المريض واسم ملفه الشخصي كما يرسلهما واتساب.",
    p_data_logs:
      "سجلات تقنية: أوقات الطلبات ورموز الأخطاء ومعرّفات تقنية تساعدنا على تشخيص الأعطال ومنع إساءة الاستخدام. لا تتضمن هذه السجلات نص الرسائل، ولتحديد عدد الطلبات المسموح بها نستخدم بصمة مشفّرة لعنوان IP بدلاً من العنوان نفسه.",
    p_data_demo:
      "طلبات العرض التوضيحي: اسم العيادة واسمك ورقم جوالك، والبريد الإلكتروني والمدينة ونوع العيادة ورسالتك إن أدخلتها.",
    p_data_sensitive:
      "قد يكتب المريض معلومات صحية في المحادثة دون أن تُطلب منه، لذلك نعامل كل محادثة على أنها قد تحتوي بيانات حساسة.",
    p_purpose_title: "لماذا نستخدم البيانات",
    p_purpose_intro: "نستخدم البيانات للأغراض التالية:",
    p_purpose_1: "الرد على أسئلة المرضى من معلومات العيادة المعتمدة.",
    p_purpose_2: "تسجيل طلبات المواعيد وإيصالها لفريق العيادة لتأكيدها.",
    p_purpose_3: "تحويل المحادثات إلى فريق العيادة عند الحاجة.",
    p_purpose_4: "تشغيل حسابات العيادات وإدارة الفريق والصلاحيات.",
    p_purpose_5: "حماية الخدمة: منع إساءة الاستخدام وتشخيص الأعطال والاحتفاظ بسجل للعمليات المهمة.",
    p_purpose_6: "التواصل مع من يطلب عرضاً توضيحياً بخصوص طلبه.",
    p_purpose_none: "لا نبيع البيانات الشخصية، ولا نستخدم محادثات المرضى في الإعلانات.",
    p_where_title: "أين تُحفظ البيانات ومن يعالجها",
    p_where_intro: "نعتمد على مزوّدين لتقديم الخدمة، ونشاركهم ما يلزم لذلك فقط:",
    p_where_db:
      "قاعدة البيانات وتسجيل الدخول: تستضيفهما شركة Supabase على خوادم في فرانكفورت بألمانيا، أي خارج المملكة العربية السعودية.",
    p_where_ai:
      "الردود الآلية: يولّدها نموذج Claude من شركة Anthropic. يُرسَل إليه نص رسالة المريض وما سبقها في المحادثة، ومعلومات العيادة المعتمدة اللازمة للرد.",
    p_where_whatsapp:
      "رسائل واتساب: تنقلها شركة Meta عبر منصة واتساب للأعمال، وتخضع لشروط Meta وسياساتها.",
    p_where_email:
      "البريد الإلكتروني: نستخدم مزوّد خدمة بريد لإرسال رسائل الحساب، مثل تأكيد التسجيل واستعادة كلمة المرور ودعوات الفريق.",
    p_where_hosting:
      "استضافة الموقع: يُقدَّم الموقع ولوحة التحكم عبر مزوّد استضافة، يصله عنوان IP الخاص بجهازك وبيانات متصفحك مع كل طلب لصفحة.",
    p_where_transfer: "قد تُعالَج البيانات لدى هؤلاء المزوّدين خارج المملكة.",
    p_retention_title: "مدة الاحتفاظ بالبيانات",
    p_retention_intro:
      "تحدد كل عيادة مدة الاحتفاظ ببيانات مرضاها من إعداداتها. والقيم الافتراضية هي:",
    p_retention_messages: "الرسائل: 180 يوماً.",
    p_retention_appointments: "طلبات المواعيد: 365 يوماً.",
    p_retention_audit: "سجل النشاط: سنتان، دون بيانات شخصية للمرضى.",
    p_retention_demo: "طلبات العرض التوضيحي: سنة واحدة.",
    p_retention_purge:
      "تُحذف البيانات تلقائياً كل يوم عند انتهاء مدتها. وعندما يحذف مالك العيادة عيادته تُحذف بياناتها، باستثناء سجل النشاط الذي يبقى حتى انتهاء مدته.",
    p_rights_title: "حقوق المرضى وكيف تمارسها",
    p_rights_intro: "يمكنك التحكم في بياناتك بالطرق التالية:",
    p_rights_webchat:
      "محادثة الموقع: احذف محادثتك ورسائلك في أي وقت من زر الحذف داخل نافذة المحادثة.",
    p_rights_whatsapp:
      "واتساب: أرسل «حذف بياناتي» أو DELETE MY DATA لحذف رسائلك في المحادثة، أو أرسل «إيقاف» أو STOP لإيقاف الرسائل الآلية.",
    p_rights_appointments:
      "طلبات المواعيد: يبقى طلبك محفوظاً لدى العيادة لتتابعه، ويمكنك أن تطلب منها حذفه أو تصحيحه.",
    p_rights_clinic:
      "للوصول إلى بياناتك أو تصحيحها أو أي طلب آخر، تواصل مع العيادة التي راسلتها، فهي صاحبة القرار في معالجة بياناتك، ونحن نساعدها في تنفيذ طلبك.",
    p_rights_staff:
      "يستطيع أفراد فريق العيادة تغيير كلمة المرور من «نسيت كلمة المرور» في صفحة تسجيل الدخول، ولتغيير الاسم أو البريد الإلكتروني في حسابك تواصل معنا (انظر «التواصل معنا» أدناه). ويستطيع مالك العيادة حذف العيادة وجميع بياناتها من الإعدادات.",
    p_security_title: "كيف نحمي البيانات",
    p_security_intro: "من الإجراءات التي نطبقها:",
    p_security_1: "عزل بيانات كل عيادة عن غيرها داخل قاعدة البيانات.",
    p_security_2: "صلاحيات حسب الدور: مالك ومدير وموظف استقبال.",
    p_security_3:
      "تشفير الاتصال بين المتصفح والخوادم، وتشفير البيانات المخزنة لدى مزوّد الاستضافة.",
    p_security_4: "حفظ بيانات ربط واتساب الخاصة بكل عيادة مشفّرة.",
    p_security_5: "سجل نشاط للعمليات المهمة داخل كل عيادة.",
    p_security_6: "حدود لعدد الطلبات لمنع إساءة الاستخدام.",
    p_security_incident:
      "لا يوجد نظام آمن تماماً. إذا علمنا بحادثة تمس البيانات فسنُبلغ العيادات المتأثرة دون تأخير.",
    p_medical_title: "CliniBot ليس خدمة طبية",
    p_medical_1:
      "لا يقدم CliniBot استشارات طبية ولا تشخيصاً ولا علاجاً، ولا يصلح لحالات الطوارئ. في الطوارئ اتصل على 997 أو توجّه إلى أقرب قسم طوارئ.",
    p_changes_title: "التغييرات على هذه السياسة",
    p_changes_1:
      "قد نحدّث هذه السياسة عند تغيّر الخدمة أو مزوّديها. سنغيّر تاريخ «آخر تحديث» أعلى الصفحة، ونُبلغ العيادات بالتغييرات الجوهرية قبل سريانها.",
    p_contact_title: "التواصل معنا",
    p_contact_email: "لأسئلة الخصوصية راسلنا على {email}.",
    p_contact_form: "لأسئلة الخصوصية استخدم {form} في صفحتنا الرئيسية.",
    p_contact_clinic: "إذا كان سؤالك عن بيانات أرسلتها إلى عيادة، فتواصل مع العيادة أولاً.",

    // Terms of service
    t_service_title: "وصف الخدمة",
    t_service_1:
      "CliniBot خدمة اشتراك للعيادات توفر مساعد استقبال يعمل بالذكاء الاصطناعي، يرد على المرضى عبر محادثة الموقع وواتساب للأعمال من معلومات تعتمدها العيادة، ويسجّل طلبات المواعيد، ويحوّل المحادثات لفريق العيادة، مع لوحة تحكم لمتابعة ذلك.",
    t_service_2:
      "عند إنشاء حساب أو استخدام الخدمة فإنك توافق على هذه الشروط عن نفسك وعن العيادة التي تمثلها.",
    t_accounts_title: "الحسابات والأدوار",
    t_accounts_1:
      "يجب أن تكون بيانات التسجيل صحيحة، وأنت مسؤول عن سرية كلمة المرور وعن النشاط الذي يتم عبر حسابك.",
    t_accounts_2:
      "لكل عيادة ثلاثة أدوار: المالك والمدير يديران إعدادات العيادة ومعلوماتها وفريقها، ولا يملك تغيير الأدوار أو حذف العيادة إلا المالك. أما موظف الاستقبال فيتابع المحادثات وطلبات المواعيد.",
    t_accounts_3: "العيادة مسؤولة عمّن تمنحهم الوصول، وعن إزالة من لم يعد يعمل لديها.",
    t_clinic_title: "مسؤوليات العيادة",
    t_clinic_intro: "تلتزم العيادة بما يلي:",
    t_clinic_1:
      "دقة المعلومات المعتمدة: الخدمات والأسعار وساعات العمل والإجابات التي تُدخلها هي ما يعتمد عليه المساعد، فحافظ عليها محدّثة.",
    t_clinic_2:
      "الاستخدام المشروع: استخدام الخدمة وفق الأنظمة المعمول بها في المملكة، ومنها أنظمة حماية البيانات الشخصية والأنظمة الصحية، وعدم استخدامها لرسائل مضللة أو مزعجة.",
    t_clinic_3:
      "إشعار المرضى: إبلاغ المرضى بأن مساعداً آلياً يرد عليهم وبكيفية معالجة بياناتهم. يعرض CliniBot إشعاراً افتراضياً تستطيع تعديله، وتبقى العيادة مسؤولة عن مضمونه.",
    t_clinic_4:
      "سياسات واتساب: الالتزام بسياسات Meta لواتساب للأعمال، ومنها الحصول على موافقة المريض قبل الرسائل التي تبدؤها العيادة، واحترام طلبات إيقاف الرسائل.",
    t_clinic_5: "متابعة المحادثات المحوّلة وطلبات المواعيد في وقت مناسب.",
    t_ai_title: "حدود الذكاء الاصطناعي",
    t_ai_1:
      "قد يخطئ المساعد أو يفهم الرسالة على غير المقصود، رغم القيود التي نضعها عليه. راجع المحادثات بانتظام.",
    t_ai_2: "لا يقدم المساعد نصيحة طبية ولا يشخّص ولا يصف علاجاً، ولا يغني عن الطبيب.",
    t_ai_3:
      "الخدمة غير مخصصة للطوارئ. في الطوارئ يجب الاتصال على 997 أو التوجه إلى أقرب قسم طوارئ.",
    t_appointments_title: "المواعيد",
    t_appointments_1:
      "ما يسجّله المساعد يبقى طلب موعد حتى يؤكده فريق العيادة للمريض. والعيادة وحدها مسؤولة عن قبول الطلبات وتحديد المواعيد.",
    t_fees_title: "التجربة والرسوم",
    t_fees_1:
      "تبدأ كل عيادة بتجربة مجانية لمدة 14 يوماً تتضمن عدداً محدوداً من الردود الآلية. وبعد انتهائها يتوقف المساعد عن الرد الآلي حتى يُفعَّل الاشتراك.",
    t_fees_2: "الأسعار المعروضة مقترحة، بالريال السعودي، ولا تشمل ضريبة القيمة المضافة بنسبة 15%.",
    t_fees_3:
      "الدفع الإلكتروني غير متاح بعد. سنتواصل معك لتفعيل الاشتراك، ولن نحصّل أي مبلغ دون اتفاق معك على السعر وطريقة الدفع.",
    t_fees_4:
      "لكل باقة حد شهري للردود الآلية وعدد مستخدمي الفريق. عند بلوغ حد الردود يتوقف الرد الآلي، ويُبلَّغ المريض بأن فريق الاستقبال سيرد عليه.",
    t_fees_5: "رسوم محادثات واتساب تفرضها Meta بشكل منفصل.",
    t_data_title: "معالجة البيانات",
    t_data_1:
      "نعالج بيانات المرضى نيابةً عن العيادة ووفق إعداداتها، كما توضح {privacy}. والعيادة مسؤولة عن وجود أساس نظامي لمعالجة بيانات مرضاها.",
    t_availability_title: "توفر الخدمة",
    t_availability_1:
      "نعمل على أن تبقى الخدمة متاحة، لكننا لا نضمن خلوها من الانقطاع أو الأخطاء. تعتمد الخدمة على مزوّدين آخرين مثل Supabase وAnthropic وMeta، وقد تتأثر بأعطالهم أو بأعمال الصيانة.",
    t_liability_title: "حدود المسؤولية",
    t_liability_1:
      "تُقدَّم الخدمة بحالتها. وفي الحدود التي تسمح بها الأنظمة، لا نتحمل المسؤولية عن الأضرار غير المباشرة، ولا عن الأضرار الناتجة عن معلومات غير دقيقة أدخلتها العيادة، أو عن قرارات اتُّخذت بناءً على ردود المساعد دون مراجعة فريق العيادة.",
    t_termination_title: "الإيقاف والإنهاء وحذف البيانات",
    t_termination_1:
      "تستطيع التوقف عن استخدام الخدمة في أي وقت، ويستطيع مالك العيادة حذفها من الإعدادات، فتُحذف بياناتها ومحادثاتها وطلباتها.",
    t_termination_2:
      "يجوز لنا إيقاف حساب أو إنهاؤه عند مخالفة هذه الشروط أو إساءة استخدام الخدمة، ونُبلغك قبل ذلك متى أمكن.",
    t_termination_3: "بعد الإنهاء تُحذف بيانات العيادة وفق مدد الاحتفاظ الموضحة في سياسة الخصوصية.",
    t_law_title: "النظام الواجب التطبيق",
    t_law_1:
      "تخضع هذه الشروط لأنظمة المملكة العربية السعودية وتُفسَّر وفقاً لها، وتختص الجهات القضائية في المملكة بالنظر في أي نزاع ينشأ عنها.",
    t_changes_title: "التغييرات على الشروط",
    t_changes_1:
      "قد نعدّل هذه الشروط. سنغيّر تاريخ «آخر تحديث» ونُبلغ العيادات بالتغييرات الجوهرية قبل سريانها، واستمرارك في استخدام الخدمة بعد ذلك يعني موافقتك عليها.",
    t_contact_title: "التواصل معنا",
    t_contact_email: "لأي سؤال عن هذه الشروط راسلنا على {email}.",
    t_contact_form: "لأي سؤال عن هذه الشروط استخدم {form} في صفحتنا الرئيسية.",
  },
  en: {
    privacyTitle: "Privacy Policy",
    privacyIntro:
      "How CliniBot handles data, where it is stored, who processes it, and how to use your rights.",
    termsTitle: "Terms of Service",
    termsIntro: "The terms that govern your clinic's use of CliniBot.",
    lastUpdated: "Last updated: {date}",
    tocTitle: "Contents",
    languageNote:
      "This page is available in Arabic and English. If the two versions differ, the Arabic text applies.",
    backToTop: "Back to contents",
    contactFormLink: "contact form",
    seeAlsoTerms: "See also our {link}.",
    seeAlsoPrivacy: "See also our {link}.",

    p_who_title: "Who we are",
    p_who_1:
      "CliniBot is software that gives clinics in Saudi Arabia an AI receptionist. It replies to patients on the website chat and WhatsApp Business, records appointment requests, and hands conversations to the clinic's team.",
    p_who_2:
      "This policy explains which data we handle, why, where it is stored, who processes it, and how to use your rights. It covers the CliniBot website, the dashboard, and patients' conversations with clinics' assistants.",
    p_roles_title: "The clinic's role and CliniBot's role",
    p_roles_1:
      "Each clinic that uses CliniBot decides how and why its patients' data is used, and CliniBot processes that data on the clinic's behalf and according to its settings. So patients' questions about their data go first to the clinic they contacted.",
    p_roles_2:
      "CliniBot is directly responsible for clinic account and team data, and for demo requests sent from this website.",
    p_data_title: "Data we collect",
    p_data_intro: "We collect only what the service needs:",
    p_data_staff:
      "Clinic staff accounts: name, email address and role in the clinic. Passwords are never stored in readable form.",
    p_data_messages:
      "Patients' messages: the text of conversations with the assistant on the website chat or WhatsApp, and the replies from the assistant and the clinic's team.",
    p_data_appointments:
      "Appointment requests: only the name and mobile number, with the requested service and the preferred date and time. The assistant never asks for national ID, iqama or insurance numbers, or medical history.",
    p_data_whatsapp:
      "WhatsApp data: the patient's WhatsApp number and profile name, as WhatsApp sends them.",
    p_data_logs:
      "Technical logs: request times, error codes and technical identifiers that help us diagnose faults and prevent abuse. These logs exclude message content, and for rate limiting we use a one-way encrypted fingerprint of the IP address instead of the address itself.",
    p_data_demo:
      "Demo requests: the clinic name, your name and mobile number, and your email, city, clinic type and message if you enter them.",
    p_data_sensitive:
      "Patients may write health information in a chat without being asked, so we treat every conversation as possibly containing sensitive data.",
    p_purpose_title: "Why we use data",
    p_purpose_intro: "We use data to:",
    p_purpose_1: "Answer patients' questions from the clinic's approved information.",
    p_purpose_2: "Record appointment requests and pass them to the clinic's team to confirm.",
    p_purpose_3: "Hand conversations to the clinic's team when needed.",
    p_purpose_4: "Run clinic accounts and manage teams and permissions.",
    p_purpose_5:
      "Protect the service: prevent abuse, diagnose faults and keep a record of important actions.",
    p_purpose_6: "Contact people who request a demo about their request.",
    p_purpose_none:
      "We do not sell personal data, and we do not use patients' conversations for advertising.",
    p_where_title: "Where data is stored and who processes it",
    p_where_intro:
      "We rely on providers to run the service and share with them only what that requires:",
    p_where_db:
      "Database and sign-in: hosted by Supabase on servers in Frankfurt, Germany, which is outside Saudi Arabia.",
    p_where_ai:
      "AI replies: generated by Anthropic's Claude model. It receives the text of the patient's message, the earlier messages in the conversation, and the clinic's approved information needed for the reply.",
    p_where_whatsapp:
      "WhatsApp messages: carried by Meta through the WhatsApp Business Platform, under Meta's own terms and policies.",
    p_where_email:
      "Email: we use an email delivery provider to send account emails such as sign-up confirmation, password resets and team invitations.",
    p_where_hosting:
      "Website hosting: the website and dashboard are served by a hosting provider, which receives your IP address and browser details with each page request.",
    p_where_transfer: "Data may be processed by these providers outside the Kingdom.",
    p_retention_title: "How long data is kept",
    p_retention_intro:
      "Each clinic sets how long its patients' data is kept in its settings. The defaults are:",
    p_retention_messages: "Messages: 180 days.",
    p_retention_appointments: "Appointment requests: 365 days.",
    p_retention_audit: "Activity log: 2 years, without patients' personal data.",
    p_retention_demo: "Demo requests: 1 year.",
    p_retention_purge:
      "Data is deleted automatically every day once its period ends. When a clinic owner deletes the clinic, its data is deleted, except the activity log, which stays until its own period ends.",
    p_rights_title: "Patients' rights and how to use them",
    p_rights_intro: "You can control your data in these ways:",
    p_rights_webchat:
      "Website chat: delete your conversation and messages at any time with the delete button in the chat window.",
    p_rights_whatsapp:
      "WhatsApp: send DELETE MY DATA (حذف بياناتي) to delete your messages in the conversation, or STOP (إيقاف) to stop automated messages.",
    p_rights_appointments:
      "Appointment requests: your request stays with the clinic so it can follow up, and you can ask the clinic to delete or correct it.",
    p_rights_clinic:
      "To access or correct your data, or for any other request, contact the clinic you messaged. The clinic decides how your data is processed, and we help it carry out your request.",
    p_rights_staff:
      "Clinic team members can change their password with 'Forgot password' on the sign-in page. To change the name or email on your account, contact us (see 'Contact us' below). The clinic owner can delete the clinic and all its data from the settings.",
    p_security_title: "How we protect data",
    p_security_intro: "Measures we apply include:",
    p_security_1:
      "Each clinic's data is kept separate from every other clinic's inside the database.",
    p_security_2: "Role-based permissions: owner, admin and receptionist.",
    p_security_3:
      "Encrypted connections between the browser and our servers, and encryption of stored data by the hosting provider.",
    p_security_4: "Each clinic's WhatsApp connection credentials are stored encrypted.",
    p_security_5: "An activity log of important actions in each clinic.",
    p_security_6: "Request limits to prevent abuse.",
    p_security_incident:
      "No system is perfectly secure. If we learn of an incident affecting data, we will inform the affected clinics without delay.",
    p_medical_title: "CliniBot is not a medical service",
    p_medical_1:
      "CliniBot does not give medical advice, diagnosis or treatment, and is not suitable for emergencies. In an emergency, call 997 or go to the nearest emergency department.",
    p_changes_title: "Changes to this policy",
    p_changes_1:
      'We may update this policy when the service or its providers change. We will change the "last updated" date at the top of this page and tell clinics about significant changes before they take effect.',
    p_contact_title: "Contact us",
    p_contact_email: "For privacy questions, email us at {email}.",
    p_contact_form: "For privacy questions, use the {form} on our home page.",
    p_contact_clinic:
      "If your question is about data you sent to a clinic, contact that clinic first.",

    t_service_title: "The service",
    t_service_1:
      "CliniBot is a subscription service for clinics. It provides an AI receptionist that replies to patients on the website chat and WhatsApp Business from information the clinic approves, records appointment requests and hands conversations to the clinic's team, with a dashboard to follow it all.",
    t_service_2:
      "By creating an account or using the service, you accept these terms for yourself and for the clinic you represent.",
    t_accounts_title: "Accounts and roles",
    t_accounts_1:
      "Your sign-up details must be accurate. You are responsible for keeping your password secret and for activity under your account.",
    t_accounts_2:
      "Each clinic has three roles. Owners and admins manage the clinic's settings, information and team, and only owners can change roles or delete the clinic. Receptionists follow up conversations and appointment requests.",
    t_accounts_3:
      "The clinic is responsible for who it gives access to, and for removing people who no longer work there.",
    t_clinic_title: "The clinic's responsibilities",
    t_clinic_intro: "The clinic agrees to:",
    t_clinic_1:
      "Keep its approved information accurate: the services, prices, working hours and answers you enter are what the assistant relies on, so keep them up to date.",
    t_clinic_2:
      "Use the service lawfully, under the regulations in force in the Kingdom, including personal data protection and health regulations, and never for misleading or unwanted messages.",
    t_clinic_3:
      "Inform patients that an automated assistant replies to them and how their data is handled. CliniBot shows a default notice you can edit, and the clinic remains responsible for its content.",
    t_clinic_4:
      "Follow Meta's WhatsApp Business policies, including getting patients' agreement before messages the clinic starts, and respecting requests to stop messages.",
    t_clinic_5: "Follow up handed-over conversations and appointment requests in good time.",
    t_ai_title: "Limits of AI",
    t_ai_1:
      "The assistant can make mistakes or misread a message, despite the limits we place on it. Review conversations regularly.",
    t_ai_2:
      "The assistant gives no medical advice, makes no diagnosis, suggests no treatment, and does not replace a doctor.",
    t_ai_3:
      "The service is not for emergencies. In an emergency, call 997 or go to the nearest emergency department.",
    t_appointments_title: "Appointments",
    t_appointments_1:
      "What the assistant records stays an appointment request until the clinic's team confirms it with the patient. Only the clinic is responsible for accepting requests and setting appointments.",
    t_fees_title: "Trial and fees",
    t_fees_1:
      "Every clinic starts with a 14-day free trial that includes a limited number of AI replies. When it ends, the assistant stops replying automatically until a subscription is activated.",
    t_fees_2: "Prices shown are proposed, in Saudi riyals, and exclude 15% VAT.",
    t_fees_3:
      "Online payment isn't available yet. We will contact you to activate your subscription and will not charge anything without agreeing the price and payment method with you.",
    t_fees_4:
      "Each plan has a monthly limit of AI replies and staff users. When the reply limit is reached, automated replies stop and the patient is told the reception team will reply.",
    t_fees_5: "WhatsApp conversation fees are charged separately by Meta.",
    t_data_title: "Data processing",
    t_data_1:
      "We process patients' data on the clinic's behalf and according to its settings, as described in our {privacy}. The clinic is responsible for having a lawful basis to process its patients' data.",
    t_availability_title: "Availability",
    t_availability_1:
      "We work to keep the service available, but we cannot promise it will be free of interruptions or errors. The service depends on other providers such as Supabase, Anthropic and Meta, and can be affected by their outages or by maintenance.",
    t_liability_title: "Limitation of liability",
    t_liability_1:
      "The service is provided as is. To the extent the law allows, we are not liable for indirect damage, for damage caused by inaccurate information the clinic entered, or for decisions made on the assistant's replies without review by the clinic's team.",
    t_termination_title: "Suspension, termination and data deletion",
    t_termination_1:
      "You can stop using the service at any time, and the clinic owner can delete the clinic from the settings, which deletes its data, conversations and requests.",
    t_termination_2:
      "We may suspend or close an account that breaks these terms or misuses the service, and will tell you beforehand where possible.",
    t_termination_3:
      "After termination, the clinic's data is deleted according to the retention periods in the privacy policy.",
    t_law_title: "Governing law",
    t_law_1:
      "These terms are governed by and interpreted under the laws of the Kingdom of Saudi Arabia, and the courts of the Kingdom have jurisdiction over any dispute arising from them.",
    t_changes_title: "Changes to these terms",
    t_changes_1:
      'We may change these terms. We will update the "last updated" date and tell clinics about significant changes before they take effect. Continuing to use the service after that means you accept them.',
    t_contact_title: "Contact us",
    t_contact_email: "For any question about these terms, email us at {email}.",
    t_contact_form: "For any question about these terms, use the {form} on our home page.",
  },
} satisfies Namespace;
