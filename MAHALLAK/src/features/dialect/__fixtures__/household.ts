import type { CategoryId, ColorId, RoomId } from '@/domain/categories';
import type { Item, Place } from '@/domain/models';

/**
 * A realistic Saudi household used only by tests and the dialect evaluation.
 * It is test data, never shipped as user data.
 */
const NOW = new Date('2026-11-17T18:00:00+03:00');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

function place(id: string, room: RoomId, spot: string, roomLabel: string | null = null): Place {
  return { id, room, roomLabel, spot, note: null, imageId: null, createdAt: daysAgo(40), updatedAt: daysAgo(40), deletedAt: null };
}

export const PLACES: Place[] = [
  place('p-desk-drawer-2', 'office', 'الدرج الثاني في المكتب'),
  place('p-desk-drawer-1', 'office', 'درج المكتب الأول'),
  place('p-desk-top', 'office', 'على المكتب'),
  place('p-wardrobe', 'bedroom', 'دولاب الملابس'),
  place('p-nightstand', 'bedroom', 'الكومدينة جنب السرير'),
  place('p-dresser', 'bedroom', 'التسريحة'),
  place('p-safe', 'bedroom', 'الخزنة'),
  place('p-entrance', 'living', 'علاقة المفاتيح عند الباب'),
  place('p-shoe-cabinet', 'living', 'جزامة المدخل'),
  place('p-kitchen-drawer', 'kitchen', 'درج المطبخ'),
  place('p-kitchen-shelf', 'kitchen', 'الرف العلوي'),
  place('p-majlis-table', 'majlis', 'طاولة المجلس'),
  place('p-majlis-shelf', 'majlis', 'رف المبخرة'),
  place('p-tv-drawer', 'majlis', 'درج التلفزيون'),
  place('p-glovebox', 'car', 'الطبلون'),
  place('p-car-drawer', 'car', 'درج السيارة'),
  place('p-garage-shelf', 'garage', 'رف العدة'),
  place('p-storage', 'storage', 'المستودع'),
  place('p-storage-box', 'storage', 'صندوق السفر'),
  place('p-kids-box', 'kids_room', 'صندوق الألعاب'),
  place('p-books', 'living', 'رف الكتب'),
  place('p-annex', 'roof', 'الملحق'),
];

interface Spec {
  id: string;
  name: string;
  category: CategoryId;
  color?: ColorId;
  keywords?: string[];
  tags?: string[];
  place: string;
  age: number;
}

const SPECS: Spec[] = [
  { id: 'i-airpods', name: 'سماعة AirPods', category: 'electronics', color: 'white', keywords: ['ايربودز'], place: 'p-desk-drawer-2', age: 3 },
  { id: 'i-sony', name: 'سماعة سوني الكبيرة', category: 'electronics', color: 'black', place: 'p-wardrobe', age: 30 },
  { id: 'i-house-keys', name: 'مفاتيح البيت', category: 'keys', place: 'p-entrance', age: 12 },
  { id: 'i-car-key', name: 'مفتاح السيارة', category: 'keys', color: 'black', place: 'p-nightstand', age: 2 },
  { id: 'i-white-charger', name: 'شاحن ايفون أبيض', category: 'electronics', color: 'white', place: 'p-kitchen-drawer', age: 5 },
  { id: 'i-laptop-charger', name: 'شاحن لابتوب', category: 'electronics', color: 'black', place: 'p-desk-drawer-1', age: 8 },
  { id: 'i-apple-watch', name: 'ساعة أبل', category: 'accessories', color: 'black', place: 'p-dresser', age: 6 },
  { id: 'i-casio', name: 'ساعة كاسيو', category: 'accessories', color: 'silver', place: 'p-dresser', age: 25 },
  { id: 'i-eid-thobe', name: 'ثوب العيد الأبيض', category: 'clothing', color: 'white', place: 'p-wardrobe', age: 1 },
  { id: 'i-winter-thobe', name: 'ثوب شتوي رصاصي', category: 'clothing', color: 'gray', place: 'p-wardrobe', age: 20 },
  { id: 'i-shemagh', name: 'شماغ أحمر', category: 'clothing', color: 'red', place: 'p-wardrobe', age: 15 },
  { id: 'i-passport', name: 'جواز السفر', category: 'documents', tags: ['travel'], place: 'p-safe', age: 60 },
  { id: 'i-suitcase', name: 'شنطة السفر الكبيرة', category: 'bags', tags: ['travel'], place: 'p-storage', age: 90 },
  { id: 'i-adapter', name: 'محول كهرباء للسفر', category: 'electronics', tags: ['travel'], place: 'p-storage-box', age: 90 },
  { id: 'i-wallet', name: 'المحفظة البنية', category: 'accessories', color: 'brown', place: 'p-majlis-table', age: 4 },
  { id: 'i-sunglasses', name: 'نظارة شمسية', category: 'accessories', color: 'black', place: 'p-glovebox', age: 9 },
  { id: 'i-powerbank', name: 'باور بانك أنكر', category: 'electronics', color: 'black', place: 'p-car-drawer', age: 11 },
  { id: 'i-drill', name: 'دريل بوش', category: 'tools', keywords: ['شنيور'], place: 'p-garage-shelf', age: 50 },
  { id: 'i-oud', name: 'دهن العود', category: 'accessories', place: 'p-majlis-shelf', age: 14 },
  { id: 'i-lego', name: 'ليقو العيال', category: 'toys', place: 'p-kids-box', age: 35 },
  { id: 'i-novel', name: 'رواية ساق البامبو', category: 'books', place: 'p-books', age: 70 },
  { id: 'i-ac-remote', name: 'ريموت المكيف', category: 'electronics', color: 'white', place: 'p-nightstand', age: 16 },
  { id: 'i-controller', name: 'يد البلايستيشن', category: 'electronics', color: 'white', place: 'p-tv-drawer', age: 7 },
  { id: 'i-id-card', name: 'الهوية الوطنية', category: 'documents', place: 'p-majlis-table', age: 4 },
  { id: 'i-misbaha', name: 'مسباح كهرمان', category: 'accessories', color: 'orange', place: 'p-glovebox', age: 22 },
  { id: 'i-tent', name: 'خيمة الكشتة', category: 'other', tags: ['camping'], place: 'p-annex', age: 120 },
  { id: 'i-panadol', name: 'بنادول', category: 'household', place: 'p-kitchen-shelf', age: 10 },
  { id: 'i-abaya', name: 'عباية سوداء', category: 'clothing', color: 'black', place: 'p-wardrobe', age: 13 },
  { id: 'i-sneakers', name: 'كوتش نايكي أبيض', category: 'shoes', color: 'white', place: 'p-shoe-cabinet', age: 18 },
  { id: 'i-laptop', name: 'لابتوب ماك بوك', category: 'electronics', color: 'silver', place: 'p-desk-top', age: 26 },
];

export const ITEMS: Item[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  nameEn: null,
  category: s.category,
  color: s.color ?? null,
  keywords: s.keywords ?? [],
  tags: s.tags ?? [],
  notes: null,
  favorite: false,
  originalImageId: null,
  cutoutImageId: null,
  currentLocationId: s.place,
  source: 'manual',
  createdAt: daysAgo(s.age),
  updatedAt: daysAgo(s.age),
  lastMovedAt: daysAgo(s.age),
  deletedAt: null,
}));

export const EVAL_NOW = NOW;

export function householdDocs() {
  const byId = new Map(PLACES.map((p) => [p.id, p]));
  return ITEMS.map((item) => ({ item, place: item.currentLocationId ? (byId.get(item.currentLocationId) ?? null) : null }));
}
