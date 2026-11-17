import type { CategoryId, ColorId, RoomId } from '@/domain/categories';

/**
 * The dialect lexicon is plain JSON-compatible data so it can be versioned and
 * delivered from the backend (table `dialect_lexicons`) without rebuilding the app.
 * The bundled copy below is the offline baseline; remote versions extend it.
 */
export type DialectId = 'najdi' | 'hijazi' | 'sharqi' | 'janoubi' | 'shamali';

export interface ItemConcept {
  id: string;
  category: CategoryId;
  /** A concept that groups several things ("أغراض السفر") instead of naming one object. */
  tag?: boolean;
  /** Names a whole category ("ملابس", "أجهزة"): every item in that category matches. */
  generic?: boolean;
  /** A broader concept this one belongs to (car_key -> keys). */
  parent?: string;
  terms: string[];
}

export interface PlaceConcept {
  id: string;
  kind: 'room' | 'furniture' | 'container' | 'vehicle';
  room?: RoomId;
  terms: string[];
}

export interface DialectLexicon {
  version: number;
  markers: {
    find: string[];
    want: string[];
    placementVerbs: string[];
    listContents: string[];
    history: string[];
    recent: string[];
    smalltalk: string[];
    /** "what" question words; with a place and no item they mean "list what's there". */
    whatQuestion: string[];
    /** Generic words for "things/stuff" that never name an item on their own. */
    generic: string[];
  };
  locatives: string[];
  fillers: string[];
  items: ItemConcept[];
  places: PlaceConcept[];
  colors: { id: ColorId; terms: string[] }[];
  time: { id: TimeRefId; terms: string[] }[];
  dialectMarkers: Record<DialectId, string[]>;
}

export type TimeRefId = 'today' | 'yesterday' | 'day_before' | 'this_week' | 'last_week' | 'recent';

export const BUNDLED_LEXICON: DialectLexicon = {
  version: 1,
  markers: {
    find: [
      'وين', 'وينه', 'وينها', 'وينهم', 'وينو', 'فين', 'فينه', 'فينها', 'فينو', 'فينهم', 'اين', 'وين راح', 'وين راحت',
      'وين صار', 'وين صارت', 'وين اختفى', 'وين اختفت', 'دور', 'دورلي', 'دور لي', 'دوري لي', 'ابحث', 'ابحث عن', 'بحث',
      'طلع لي', 'طلعلي', 'طلعي لي', 'وريني', 'ورني', 'وريني وين', 'شوف لي', 'شوفلي', 'جيب لي', 'جيبلي', 'تعرف وين',
      'تدري وين', 'داري وين', 'داري', 'مدري وين', 'ما ادري وين', 'مادري وين', 'نسيت وين', 'ناسي وين', 'ضاع', 'ضايع',
      'ضايعه', 'ضيعت', 'ضاعت', 'مفقود', 'افتقد', 'لاقي', 'ما لقيت', 'مالقيت', 'where', 'wheres', 'where is', 'where are',
      'find', 'search', 'locate', 'show me', 'lost', 'ادور', 'ادور على', 'دورت', 'دورت على', 'قلبت', 'اقلب', 'ادوره',
    ],
    want: ['ابي', 'ابغى', 'ابغا', 'ابغي', 'بغيت', 'ودي', 'اشتي', 'اشتهي', 'بدي', 'اريد', 'محتاج', 'احتاج', 'want', 'need'],
    placementVerbs: [
      'حطيت', 'حطيته', 'حطيتها', 'حطيتهم', 'حاط', 'حاطه', 'حاطها', 'حطينا', 'خليت', 'خليته', 'خليتها', 'خليتهم', 'مخلي',
      'دسيت', 'دسيته', 'دسيتها', 'داس', 'خبيت', 'خبيته', 'خبيتها', 'خشيت', 'خشيته', 'خشيتها', 'رميت', 'رميته', 'شلت',
      'شلته', 'شلتها', 'وديت', 'وديته', 'وديتها', 'نسيت', 'نسيته', 'نسيتها', 'تركت', 'تركته', 'تركتها', 'رتبت', 'رتبته',
      'صفطت', 'صفطته', 'صورت', 'صورته', 'صورتها', 'سجلت', 'سجلته', 'سجلتها', 'دسيتهم', 'put', 'left', 'leave', 'kept',
      'placed', 'store', 'stored', 'photographed', 'حطيتو', 'خليتو', 'وديتو', 'دسيتو', 'حطيتوه', 'رحت حطيته',
    ],
    listContents: [
      'وش في', 'وش فيه', 'وش فيها', 'وش عندي في', 'وش عندي ب', 'وش عندي', 'وش داخل', 'وش اللي في', 'وش حطيت في',
      'وش موجود في', 'وش موجود', 'ايش في', 'ايش فيه', 'ايش فيها', 'ايش عندي في', 'ايش عندي', 'ايش داخل', 'ايش موجود',
      'ايش اللي في', 'ايش حطيت في', 'شنو في', 'شنو فيه', 'شنو عندي', 'شنهو في', 'شنهو اللي في', 'شو في', 'شو فيه',
      'شو عندي', 'ويش في', 'ويش فيه', 'ويش عندي', 'ويش داخل', 'وشو في', 'اعرض اللي في', 'عطني اللي في',
      'طلع لي اللي في', 'الاغراض اللي في', 'whats in', 'what is in', 'what do i have in',
      'contents of', 'items in',
    ],
    history: [
      'وين كان', 'وين كانت', 'وين كانو', 'وين كنت حاط', 'وين كنت حاطه', 'وين كنت حاطها', 'سجل', 'سجل المواقع',
      'فين كان', 'فين كانت', 'فين كانو', 'فين كنت حاط', 'فين كنت حاطه', 'وين كان قبل', 'اماكن', 'تنقلات',
      'تاريخ', 'المواقع السابقه', 'الاماكن السابقه', 'قبل وين', 'وش الاماكن اللي', 'history', 'where was', 'previous',
    ],
    recent: [
      'اخر شي', 'اخر شي حطيته', 'اخر الاغراض', 'اخر غرض', 'اخر شيء', 'وش اخر', 'اخر ما سجلت', 'اخر اشياء',
      'last item', 'recent', 'latest',
    ],
    smalltalk: [
      'السلام عليكم', 'سلام', 'مرحبا', 'هلا', 'هلا والله', 'اهلين', 'شكرا', 'مشكور', 'يعطيك العافيه', 'كم الساعه',
      'وش الوقت', 'كم الوقت', 'وش اسمك', 'hello', 'hi', 'thanks', 'thank you', 'what time is it',
    ],
    whatQuestion: ['وش', 'ايش', 'شنو', 'شنهو', 'شو', 'ويش', 'وشو', 'شنهي', 'what', 'whats'],
    generic: [
      'اشياء', 'الاشياء', 'اغراض', 'الاغراض', 'اغراضي', 'حاجات', 'الحاجات', 'حاجاتي', 'اغراضنا', 'كل شي', 'كل الاغراض',
      'محتويات', 'things', 'stuff', 'items', 'everything',
    ],
  },
  locatives: [
    'في', 'ب', 'بـ', 'داخل', 'جوا', 'جوه', 'جوات', 'عند', 'فوق', 'تحت', 'جنب', 'يم', 'على', 'ع', 'ورا', 'قدام', 'بين',
    'in', 'inside', 'on', 'under', 'at', 'near', 'behind',
  ],
  fillers: [
    'يا', 'ياخي', 'يارجال', 'يا رجال', 'طيب', 'لو سمحت', 'لوسمحت', 'الله يخليك', 'الله يعافيك', 'الله يسعدك', 'تكفى',
    'تكفين', 'بليز', 'ممكن', 'هاه', 'ها', 'يعني', 'اللي', 'الي', 'حق', 'حقي', 'حقتي', 'حقنا', 'حقه', 'حقها', 'مالي',
    'مالتي', 'تبعي', 'تبعتي', 'خاصتي', 'لي', 'انا', 'عندي', 'عندنا', 'هذا', 'هذي', 'ذا', 'ذي', 'هاذا', 'هاذي',
    'هذاك', 'هذيك', 'ذاك', 'ذيك', 'من', 'عن', 'مع', 'او', 'و', 'ثم', 'كان', 'كانت', 'قد', 'اذا', 'اني', 'انه',
    'شي', 'شيء', 'الشي', 'اشوف', 'اعرف', 'ابي اعرف', 'ابغى اعرف', 'قول لي', 'قولي', 'قل لي', 'ليش', 'زين', 'بس', 'مرة', 'مره', 'حيل', 'واجد', 'كذا', 'كدا', 'جذي', 'الحين', 'دحين',
    'ذلحين', 'هسه', 'هسا', 'توي', 'كمان', 'بعد', 'برضو', 'برضه', 'هو', 'هي', 'هم', 'the', 'a', 'an', 'my', 'is',
    'are', 'was', 'i', 'did', 'do', 'of', 'to', 'for', 'please', 'me', 'can', 'you', 'it', 'its', 'that', 'this',
    'have', 'mine', 'كل', 'قبل', 'هنا', 'هناك', 'حقت', 'تبع', 'مال', 'ماني', 'مانيب', 'انا ما', 'ابد', 'ابدا', 'والله',
    'الله', 'وين ما', 'حاولت', 'البيت كله',
  ],
  items: [
    { id: 'earphones', category: 'electronics', terms: ['سماعه', 'سماعات', 'سماعة اذن', 'سماعات اذن', 'سماعه بلوتوث', 'ايربودز', 'ايربود', 'ايربودس', 'اير بودز', 'بودز', 'هيدفون', 'هيدفونز', 'هيدسيت', 'سماعه راس', 'airpods', 'airpod', 'earbuds', 'earphones', 'earphone', 'headphones', 'headphone', 'headset', 'buds'] },
    { id: 'watch', category: 'accessories', terms: ['ساعه', 'ساعات', 'ساعه يد', 'ابل واتش', 'سمارت واتش', 'الساعه الذكيه', 'watch', 'apple watch', 'smartwatch'] },
    { id: 'car_key', category: 'keys', parent: 'keys', terms: ['مفتاح السياره', 'مفاتيح السياره', 'مفتاح الموتر', 'مفتاح الوانيت', 'مفتاح الجيب', 'سويتش', 'سويتش السياره', 'ريموت السياره', 'car key', 'car keys'] },
    { id: 'keys', category: 'keys', terms: ['مفتاح', 'مفاتيح', 'مفتاح البيت', 'مفاتيح البيت', 'مفتاح الشقه', 'مفتاح الباب', 'ميداليه', 'ميداليه مفاتيح', 'key', 'keys', 'keychain'] },
    { id: 'charger', category: 'electronics', terms: ['شاحن', 'شواحن', 'كيبل', 'كابل', 'سلك', 'سلك الشاحن', 'سلك شحن', 'راس الشاحن', 'راس شاحن', 'فيش', 'فيشه', 'محول', 'charger', 'cable', 'adapter', 'usb c', 'lightning'] },
    { id: 'power_bank', category: 'electronics', parent: 'charger', terms: ['باور بانك', 'بور بانك', 'باوربانك', 'شاحن متنقل', 'power bank', 'powerbank'] },
    { id: 'phone', category: 'electronics', terms: ['جوال', 'جوالات', 'تلفون', 'تليفون', 'موبايل', 'ايفون', 'سامسونج', 'phone', 'iphone', 'mobile', 'smartphone'] },
    { id: 'tablet', category: 'electronics', terms: ['ايباد', 'اباد', 'تابلت', 'ipad', 'tablet'] },
    { id: 'laptop', category: 'electronics', terms: ['لابتوب', 'لاب توب', 'كمبيوتر', 'ماك بوك', 'ماك', 'laptop', 'macbook', 'computer'] },
    { id: 'remote', category: 'electronics', terms: ['ريموت', 'ريموت التلفزيون', 'ريموت الشاشه', 'ريموت المكيف', 'كنترول', 'ريموت كنترول', 'remote', 'remote control'] },
    { id: 'game_controller', category: 'electronics', terms: ['يد البلايستيشن', 'يد بلايستيشن', 'يد بلاي', 'يد التحكم', 'جويستك', 'بلايستيشن', 'بلاستيشن', 'اكس بوكس', 'نينتندو', 'controller', 'joystick', 'playstation', 'ps5', 'xbox', 'nintendo'] },
    { id: 'camera', category: 'electronics', terms: ['كاميرا', 'كامرا', 'كاميره', 'camera', 'gopro'] },
    { id: 'speaker', category: 'electronics', terms: ['سبيكر', 'مكبر صوت', 'سماعه خارجيه', 'speaker'] },
    { id: 'storage_drive', category: 'electronics', terms: ['فلاش', 'فلاشه', 'هارد', 'هارديسك', 'هارد ديسك', 'usb', 'flash drive', 'hard drive', 'ssd'] },
    { id: 'electronics', category: 'electronics', generic: true, terms: ['اجهزه', 'الاجهزه', 'اجهزتي', 'الكترونيات', 'devices', 'electronics', 'gadgets'] },
    { id: 'battery', category: 'household', terms: ['بطاريه', 'بطاريات', 'حجر', 'حجار', 'حجر ريموت', 'battery', 'batteries'] },
    { id: 'glasses', category: 'accessories', terms: ['نظاره', 'نظارات', 'نظاره شمسيه', 'نظاره شمس', 'نظاره طبيه', 'نظارتي', 'عدسات', 'glasses', 'sunglasses', 'eyeglasses'] },
    { id: 'wallet', category: 'accessories', terms: ['محفظه', 'محافظ', 'بوك', 'البوك', 'جزدان', 'بوكي', 'wallet'] },
    { id: 'ring', category: 'accessories', terms: ['خاتم', 'خواتم', 'دبله', 'محبس', 'ring'] },
    { id: 'necklace', category: 'accessories', parent: 'jewelry', terms: ['سلسال', 'سلسله', 'عقد ذهب', 'necklace'] },
    { id: 'bracelet', category: 'accessories', parent: 'jewelry', terms: ['اسواره', 'اساور', 'غويشه', 'bracelet'] },
    { id: 'earrings', category: 'accessories', parent: 'jewelry', terms: ['حلق', 'اقراط', 'earrings'] },
    { id: 'jewelry', category: 'accessories', terms: ['ذهب', 'مجوهرات', 'ذهبي كله', 'jewelry', 'jewellery'] },
    { id: 'perfume', category: 'accessories', terms: ['عطر', 'عطور', 'دهن عود', 'دهن العود', 'دهن', 'perfume', 'oud', 'fragrance'] },
    { id: 'incense', category: 'household', terms: ['بخور', 'مبخره', 'مبخر', 'معمول', 'incense', 'bakhoor'] },
    { id: 'misbaha', category: 'accessories', terms: ['مسبحه', 'سبحه', 'مسباح', 'misbaha', 'prayer beads'] },
    { id: 'thobe', category: 'clothing', terms: ['ثوب', 'ثياب', 'ثوبي', 'ثوب ابيض', 'دشداشه', 'كندوره', 'thobe', 'thawb'] },
    { id: 'shemagh', category: 'clothing', terms: ['شماغ', 'شمغ', 'غتره', 'thobe headdress', 'shemagh', 'ghutra'] },
    { id: 'igal', category: 'clothing', terms: ['عقال', 'igal', 'agal'] },
    { id: 'cap', category: 'clothing', terms: ['طاقيه', 'كاب', 'كاسكيته', 'قبعه', 'cap', 'hat'] },
    { id: 'abaya', category: 'clothing', terms: ['عبايه', 'عبايات', 'عباه', 'abaya'] },
    { id: 'headscarf', category: 'clothing', terms: ['طرحه', 'شيله', 'نقاب', 'حجاب', 'hijab', 'scarf'] },
    { id: 'bisht', category: 'clothing', terms: ['بشت', 'مشلح', 'bisht'] },
    { id: 'shirt', category: 'clothing', terms: ['قميص', 'تيشيرت', 'تي شيرت', 'تشيرت', 'فنيله', 'بلوزه', 'shirt', 'tshirt', 't shirt', 'blouse'] },
    { id: 'pants', category: 'clothing', terms: ['بنطلون', 'بنطال', 'جينز', 'سروال', 'pants', 'jeans', 'trousers'] },
    { id: 'jacket', category: 'clothing', terms: ['جاكيت', 'جاكت', 'كوت', 'فروه', 'هودي', 'jacket', 'coat', 'hoodie'] },
    { id: 'dress', category: 'clothing', terms: ['فستان', 'فساتين', 'جلابيه', 'dress'] },
    { id: 'pajamas', category: 'clothing', terms: ['بيجامه', 'بجامه', 'pajamas', 'pyjamas'] },
    { id: 'clothes', category: 'clothing', generic: true, terms: ['ملابس', 'لبس', 'هدوم', 'ملابسي', 'clothes', 'clothing', 'outfit'] },
    { id: 'sneakers', category: 'shoes', parent: 'shoes', terms: ['كوتش', 'جوتي', 'سنيكرز', 'رياضي', 'sneakers', 'trainers'] },
    { id: 'sandals', category: 'shoes', parent: 'shoes', terms: ['نعال', 'زنوبه', 'شبشب', 'صندل', 'شبشب', 'sandals', 'slippers', 'flip flops'] },
    { id: 'boots', category: 'shoes', parent: 'shoes', terms: ['بوت', 'جزمه بوت', 'boots'] },
    { id: 'shoes', category: 'shoes', generic: true, terms: ['جزمه', 'جزم', 'حذاء', 'احذيه', 'شوز', 'shoes', 'shoe'] },
    { id: 'suitcase', category: 'bags', terms: ['شنطه سفر', 'شنطه السفر', 'حقيبه سفر', 'حقيبه السفر', 'suitcase', 'luggage'] },
    { id: 'bag', category: 'bags', terms: ['شنطه', 'شنط', 'حقيبه', 'حقائب', 'شنطه ظهر', 'شنطه يد', 'backpack', 'bag', 'handbag'] },
    { id: 'passport', category: 'documents', terms: ['جواز', 'جواز السفر', 'جوازات', 'باسبور', 'passport'] },
    { id: 'national_id', category: 'documents', terms: ['هويه', 'الهويه الوطنيه', 'بطاقه', 'بطاقه الاحوال', 'بطاقه الهويه', 'id', 'id card', 'national id'] },
    { id: 'iqama', category: 'documents', terms: ['اقامه', 'الاقامه', 'iqama', 'residence permit'] },
    { id: 'driving_license', category: 'documents', terms: ['رخصه', 'رخصه القياده', 'رخصه السياقه', 'رخصه السواقه', 'license', 'driving license'] },
    { id: 'car_registration', category: 'documents', terms: ['استماره', 'استماره السياره', 'registration'] },
    { id: 'bank_card', category: 'documents', terms: ['بطاقه', 'بطاقه صراف', 'بطاقه مدى', 'مدى', 'بطاقه البنك', 'بطاقه ائتمان', 'فيزا', 'credit card', 'bank card', 'visa'] },
    { id: 'documents', category: 'documents', generic: true, terms: ['اوراق', 'ورق', 'اوراق رسميه', 'ملف', 'ملفات', 'مستندات', 'documents', 'papers', 'file'] },
    { id: 'certificate', category: 'documents', terms: ['شهاده', 'شهادات', 'certificate', 'diploma'] },
    { id: 'invoice', category: 'documents', terms: ['فواتير', 'فاتوره', 'ضمان', 'كرت الضمان', 'invoice', 'receipt', 'warranty'] },
    { id: 'cash', category: 'documents', terms: ['فلوس', 'كاش', 'نقود', 'بيزات', 'cash', 'money'] },
    { id: 'book', category: 'books', terms: ['كتاب', 'كتب', 'روايه', 'روايات', 'book', 'books', 'novel'] },
    { id: 'quran', category: 'books', terms: ['مصحف', 'quran', 'mushaf'] },
    { id: 'notebook', category: 'books', terms: ['دفتر', 'دفاتر', 'مذكره', 'كشكول', 'notebook'] },
    { id: 'pen', category: 'other', terms: ['قلم', 'اقلام', 'pen', 'pencil'] },
    { id: 'lego', category: 'toys', parent: 'toy', terms: ['ليغو', 'ليقو', 'مكعبات', 'lego'] },
    { id: 'doll', category: 'toys', parent: 'toy', terms: ['دميه', 'دبدوب', 'عروسه', 'باربي', 'doll', 'teddy'] },
    { id: 'toy', category: 'toys', generic: true, terms: ['لعبه', 'العاب', 'لعب', 'سياره لعبه', 'toy', 'toys'] },
    { id: 'screwdriver', category: 'tools', parent: 'tools', terms: ['مفك', 'مفكات', 'screwdriver'] },
    { id: 'drill', category: 'tools', parent: 'tools', terms: ['دريل', 'شنيور', 'drill'] },
    { id: 'hammer', category: 'tools', parent: 'tools', terms: ['مطرقه', 'شاكوش', 'hammer'] },
    { id: 'pliers', category: 'tools', parent: 'tools', terms: ['زراديه', 'كماشه', 'بنسه', 'pliers'] },
    { id: 'wrench', category: 'tools', parent: 'tools', terms: ['مفتاح ربط', 'مفتاح انجليزي', 'مفتاح شق', 'wrench', 'spanner'] },
    { id: 'tape_measure', category: 'tools', parent: 'tools', terms: ['متر', 'شريط قياس', 'tape measure'] },
    { id: 'tools', category: 'tools', generic: true, terms: ['عده', 'عدتي', 'عده الصيانه', 'ادوات', 'tools', 'toolbox'] },
    { id: 'medicine', category: 'household', terms: ['دواء', 'دوا', 'ادويه', 'علاج', 'حبوب', 'بنادول', 'medicine', 'pills'] },
    { id: 'makeup', category: 'accessories', terms: ['مكياج', 'ميك اب', 'روج', 'makeup', 'lipstick'] },
    { id: 'dallah', category: 'household', terms: ['دله', 'دلة القهوه', 'dallah', 'coffee pot'] },
    { id: 'thermos', category: 'household', terms: ['ترمس', 'حافظه', 'thermos', 'flask'] },
    { id: 'cups', category: 'household', terms: ['فناجيل', 'فناجين', 'بيالات', 'كاسات', 'cups', 'mugs'] },
    { id: 'prayer_mat', category: 'household', terms: ['سجاده', 'سجاده صلاه', 'سجادة الصلاه', 'prayer mat', 'prayer rug'] },
    { id: 'gift', category: 'other', terms: ['هديه', 'هدايا', 'gift', 'present'] },
    { id: 'travel', category: 'other', tag: true, terms: ['اغراض السفر', 'اغراض سفر', 'حاجات السفر', 'اغراض الرحله', 'اغراض الطياره', 'travel', 'travel stuff', 'travel items'] },
    { id: 'camping', category: 'other', tag: true, terms: ['اغراض الكشته', 'عده الكشته', 'كشته', 'اغراض البر', 'عده البر', 'خيمه', 'camping', 'camping gear'] },
    { id: 'school', category: 'other', tag: true, terms: ['اغراض المدرسه', 'شنطه المدرسه', 'اغراض الدراسه', 'school', 'school stuff'] },
  ],
  places: [
    { id: 'bedroom', kind: 'room', room: 'bedroom', terms: ['غرفه النوم', 'غرفه نومي', 'غرفتي', 'غرفه', 'حجره', 'حجرتي', 'bedroom', 'my room'] },
    { id: 'kids_room', kind: 'room', room: 'kids_room', terms: ['غرفه العيال', 'غرفه الاطفال', 'غرفه الاولاد', 'غرفه البنات', 'غرفه البزارين', 'kids room'] },
    { id: 'majlis', kind: 'room', room: 'majlis', terms: ['مجلس', 'مجلس الرجال', 'مجلس الحريم', 'المجلس', 'majlis'] },
    { id: 'living', kind: 'room', room: 'living', terms: ['صاله', 'صالون', 'ليوان', 'الصاله', 'living room', 'lounge'] },
    { id: 'kitchen', kind: 'room', room: 'kitchen', terms: ['مطبخ', 'المطبخ', 'kitchen'] },
    { id: 'bathroom', kind: 'room', room: 'bathroom', terms: ['حمام', 'دوره المياه', 'دوره مياه', 'bathroom', 'toilet'] },
    { id: 'storage', kind: 'room', room: 'storage', terms: ['مستودع', 'مخزن', 'غرفه الخزين', 'store room', 'storage'] },
    { id: 'garage', kind: 'room', room: 'garage', terms: ['كراج', 'قراج', 'مظله', 'مظلة السياره', 'garage'] },
    { id: 'roof', kind: 'room', room: 'roof', terms: ['سطح', 'حوش', 'ملحق', 'حديقه', 'roof', 'yard', 'garden'] },
    { id: 'car', kind: 'vehicle', room: 'car', terms: ['سياره', 'سيارتي', 'موتر', 'وانيت', 'جيب', 'car'] },
    { id: 'trunk', kind: 'container', room: 'car', terms: ['دبه', 'دبه السياره', 'شنطه السياره', 'trunk'] },
    { id: 'glovebox', kind: 'container', room: 'car', terms: ['طبلون', 'تابلوه', 'درج السياره', 'glovebox', 'glove box'] },
    { id: 'drawer', kind: 'container', terms: ['درج', 'ادراج', 'دروج', 'جرار', 'drawer', 'drawers'] },
    { id: 'wardrobe', kind: 'furniture', terms: ['دولاب', 'كبت', 'كبتات', 'خزانه', 'خزانه الملابس', 'دولاب الملابس', 'wardrobe', 'closet', 'cabinet', 'cupboard'] },
    { id: 'shelf', kind: 'furniture', terms: ['رف', 'رفوف', 'ارفف', 'مكتبه', 'shelf', 'shelves', 'bookcase'] },
    { id: 'box', kind: 'container', terms: ['صندوق', 'صناديق', 'كرتون', 'كرتونه', 'كراتين', 'علبه', 'box', 'container'] },
    { id: 'desk', kind: 'furniture', room: 'office', terms: ['مكتب', 'المكتب', 'طاوله المكتب', 'desk', 'office'] },
    { id: 'table', kind: 'furniture', terms: ['طاوله', 'طاولات', 'table'] },
    { id: 'nightstand', kind: 'furniture', terms: ['كومدينه', 'كومودينو', 'كمودينه', 'كوميدينو', 'nightstand', 'bedside table'] },
    { id: 'dresser', kind: 'furniture', terms: ['تسريحه', 'dresser', 'vanity'] },
    { id: 'bed', kind: 'furniture', terms: ['سرير', 'bed'] },
    { id: 'sofa', kind: 'furniture', terms: ['كنب', 'كنبه', 'sofa', 'couch'] },
    { id: 'entrance', kind: 'room', terms: ['مدخل', 'باب', 'الباب', 'عند الباب', 'entrance', 'door'] },
    { id: 'safe', kind: 'container', terms: ['خزنه', 'safe'] },
    { id: 'bag_place', kind: 'container', terms: ['شنطه', 'حقيبه'] },
  ],
  colors: [
    { id: 'white', terms: ['ابيض', 'بيضاء', 'بيضا', 'بيض', 'white'] },
    { id: 'black', terms: ['اسود', 'سوداء', 'سودا', 'سود', 'black'] },
    { id: 'gray', terms: ['رمادي', 'رماديه', 'رصاصي', 'رصاصيه', 'gray', 'grey'] },
    { id: 'silver', terms: ['فضي', 'فضيه', 'silver'] },
    { id: 'gold', terms: ['ذهبي', 'ذهبيه', 'golden'] },
    { id: 'beige', terms: ['بيج', 'سكري', 'كريمي', 'beige', 'cream'] },
    { id: 'brown', terms: ['بني', 'بنيه', 'عودي', 'brown'] },
    { id: 'red', terms: ['احمر', 'حمراء', 'حمرا', 'red'] },
    { id: 'pink', terms: ['وردي', 'ورديه', 'زهري', 'بمبي', 'pink'] },
    { id: 'orange', terms: ['برتقالي', 'برتقاليه', 'orange'] },
    { id: 'yellow', terms: ['اصفر', 'صفراء', 'صفرا', 'yellow'] },
    { id: 'green', terms: ['اخضر', 'خضراء', 'خضرا', 'green'] },
    { id: 'blue', terms: ['ازرق', 'زرقاء', 'زرقا', 'سماوي', 'blue'] },
    { id: 'navy', terms: ['كحلي', 'كحليه', 'navy'] },
    { id: 'purple', terms: ['بنفسجي', 'بنفسجيه', 'موف', 'purple'] },
  ],
  time: [
    { id: 'today', terms: ['اليوم', 'الصبح', 'الصباح', 'هالصباح', 'today', 'this morning'] },
    { id: 'yesterday', terms: ['امس', 'البارح', 'البارحه', 'امس الليل', 'yesterday', 'last night'] },
    { id: 'day_before', terms: ['قبل امس', 'اول امس', 'قبل يومين', 'day before yesterday'] },
    { id: 'this_week', terms: ['هالاسبوع', 'هذا الاسبوع', 'الاسبوع هذا', 'this week'] },
    { id: 'last_week', terms: ['الاسبوع الماضي', 'الاسبوع اللي فات', 'الاسبوع اللي راح', 'قبل اسبوع', 'last week'] },
    { id: 'recent', terms: ['قبل شوي', 'توني', 'توه', 'قبل شوية', 'just now', 'recently'] },
  ],
  dialectMarkers: {
    najdi: ['وش', 'ابي', 'الحين', 'يم', 'البارح', 'توني', 'شلت', 'شلته', 'ودي', 'مدري', 'وشلون', 'تكفى', 'دسيت', 'دسيته'],
    hijazi: ['فين', 'فينو', 'ايش', 'ابغى', 'ابغا', 'دحين', 'جوا', 'كدا', 'مره', 'جرار', 'كوتش', 'برضو', 'زي'],
    sharqi: ['شنو', 'شنهو', 'مالي', 'مالتي', 'شلون', 'جذي', 'هني', 'خشيت', 'خشيته', 'واجد', 'بيزات'],
    janoubi: ['اشتي', 'ويش', 'ذلحين', 'وشو', 'حقيه', 'ابغي'],
    shamali: ['شو', 'بدي', 'هسه', 'هسا', 'اشلون', 'زين', 'هسع'],
  },
};
