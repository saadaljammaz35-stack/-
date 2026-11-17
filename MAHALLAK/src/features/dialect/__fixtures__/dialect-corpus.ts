import type { DialectId } from '../lexicon';
import type { QueryIntent } from '../parser';

/**
 * Evaluation corpus. Every phrase is a text transcript, as speech-to-text would
 * produce it. Expectations:
 *  - `targets`: any of these item ids must rank first (find / history).
 *  - `places`: any of these place ids must be among the matched places (list).
 *  - `absent: true`: the item is NOT registered; the engine must return nothing
 *    rather than invent a result.
 *  - `rephrase: true`: the engine must ask the user to rephrase.
 *
 * Limitation: the phrases were written by the development team, not collected
 * from speakers of each region. They measure the text-understanding layer only,
 * not acoustic accuracy of the speech recognizer.
 */
export interface EvalCase {
  /** dev: used while building the lexicon. holdout: written afterwards, never tuned against. */
  set?: 'dev' | 'holdout';
  dialect: DialectId | 'mixed';
  text: string;
  intent: QueryIntent;
  targets?: string[];
  places?: string[];
  absent?: boolean;
  rephrase?: boolean;
}

const EARPHONES = ['i-airpods', 'i-sony'];
const WATCHES = ['i-apple-watch', 'i-casio'];
const TRAVEL = ['i-passport', 'i-suitcase', 'i-adapter'];
const DRAWERS = ['p-desk-drawer-2', 'p-desk-drawer-1', 'p-kitchen-drawer', 'p-tv-drawer', 'p-car-drawer'];
const CHARGERS = ['i-white-charger', 'i-laptop-charger', 'i-adapter'];

export const CORPUS: EvalCase[] = [
  // ---------------------------------------------------------------- Najdi
  { dialect: 'najdi', text: 'وين حطيت سماعتي؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'najdi', text: 'وين خليت مفتاح السيارة؟', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'najdi', text: 'ماني لاقي البوك', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'najdi', text: 'وين ودّيت الشماغ الأحمر', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'najdi', text: 'تكفى وش سويت بالشاحن الأبيض', intent: 'find_item', targets: ['i-white-charger'] },
  { dialect: 'najdi', text: 'أبي الثوب اللي صورته أمس', intent: 'find_item', targets: ['i-eid-thobe'] },
  { dialect: 'najdi', text: 'وش عندي في درج المكتب؟', intent: 'list_location', places: ['p-desk-drawer-2', 'p-desk-drawer-1'] },
  { dialect: 'najdi', text: 'وين دسّيت الجواز؟', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'najdi', text: 'البارح حطيت النظارة وين؟', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'najdi', text: 'وينه ريموت المكيف؟', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'najdi', text: 'مدري وين حطيت ساعتي', intent: 'find_item', targets: WATCHES },
  { dialect: 'najdi', text: 'وش في الخزنة', intent: 'list_location', places: ['p-safe'] },
  { dialect: 'najdi', text: 'وين أغراض الكشتة', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'najdi', text: 'وين حطيت يد البلايستيشن', intent: 'find_item', targets: ['i-controller'] },
  { dialect: 'najdi', text: 'وين المسباح؟', intent: 'find_item', targets: ['i-misbaha'] },
  { dialect: 'najdi', text: 'وين خليت شنطة السفر', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'najdi', text: 'ودي أعرف وين الهوية', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'najdi', text: 'وين حطيت الدواء', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'najdi', text: 'وين اللابتوب', intent: 'find_item', targets: ['i-laptop'] },
  { dialect: 'najdi', text: 'وين العباية السودا', intent: 'find_item', targets: ['i-abaya'] },
  { dialect: 'najdi', text: 'وين الليقو حق العيال', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'najdi', text: 'وين الباور بانك', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'najdi', text: 'وش اللي في الدولاب', intent: 'list_location', places: ['p-wardrobe'] },
  { dialect: 'najdi', text: 'وين الكتاب اللي كنت اقراه', intent: 'find_item', targets: ['i-novel'] },
  { dialect: 'najdi', text: 'وين حطيت الشنيور', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'najdi', text: 'وين دهن العود', intent: 'find_item', targets: ['i-oud'] },
  { dialect: 'najdi', text: 'وين حطيت السماعة السوني', intent: 'find_item', targets: ['i-sony'] },
  { dialect: 'najdi', text: 'أبي أغراض السفر', intent: 'find_item', targets: TRAVEL },
  { dialect: 'najdi', text: 'وين حطيت الجوال', intent: 'find_item', absent: true },
  { dialect: 'najdi', text: 'وين كان مفتاح السيارة قبل', intent: 'item_history', targets: ['i-car-key'] },

  // ---------------------------------------------------------------- Hijazi
  { dialect: 'hijazi', text: 'فين حطيت السماعة حقتي؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'hijazi', text: 'فين المفتاح حق البيت؟', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'hijazi', text: 'ايش فيه في الجرار حق المطبخ؟', intent: 'list_location', places: ['p-kitchen-drawer'] },
  { dialect: 'hijazi', text: 'فينو الشاحن الأبيض؟', intent: 'find_item', targets: ['i-white-charger'] },
  { dialect: 'hijazi', text: 'ابغى الجزدان', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'hijazi', text: 'دحين فين حطيت النظارة؟', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'hijazi', text: 'فين خليت الجوال؟', intent: 'find_item', absent: true },
  { dialect: 'hijazi', text: 'فين الكوتش الأبيض؟', intent: 'find_item', targets: ['i-sneakers'] },
  { dialect: 'hijazi', text: 'ابغا أعرف فين جواز السفر', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'hijazi', text: 'فين ودّيت الريموت؟', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'hijazi', text: 'فين الثوب الأبيض؟', intent: 'find_item', targets: ['i-eid-thobe'] },
  { dialect: 'hijazi', text: 'فين العباية؟', intent: 'find_item', targets: ['i-abaya'] },
  { dialect: 'hijazi', text: 'فين حطيتو الشماغ؟', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'hijazi', text: 'ايش عندي في الدولاب؟', intent: 'list_location', places: ['p-wardrobe'] },
  { dialect: 'hijazi', text: 'فين يد البلاي؟', intent: 'find_item', targets: ['i-controller'] },
  { dialect: 'hijazi', text: 'فين الساعة الأبل؟', intent: 'find_item', targets: ['i-apple-watch'] },
  { dialect: 'hijazi', text: 'فين المسبحة', intent: 'find_item', targets: ['i-misbaha'] },
  { dialect: 'hijazi', text: 'فين شنطة السفر الكبيرة', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'hijazi', text: 'فين حطيت الهوية', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'hijazi', text: 'ابغى البنادول', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'hijazi', text: 'فين اللعب حق البزارين؟', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'hijazi', text: 'فين الدريل', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'hijazi', text: 'فين حطيت اللابتوب حقي', intent: 'find_item', targets: ['i-laptop'] },
  { dialect: 'hijazi', text: 'فين الخيمة حقت البر', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'hijazi', text: 'ايش في الرف حق الكتب', intent: 'list_location', places: ['p-books'] },
  { dialect: 'hijazi', text: 'فين المحول حق السفر', intent: 'find_item', targets: ['i-adapter'] },
  { dialect: 'hijazi', text: 'فين حطيت الكاميرا', intent: 'find_item', absent: true },
  { dialect: 'hijazi', text: 'ايش آخر شي حطيته؟', intent: 'recent' },
  { dialect: 'hijazi', text: 'مرة دورت على الباور بانك فينو', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'hijazi', text: 'فين كانت الساعة قبل', intent: 'item_history', targets: WATCHES },

  // ---------------------------------------------------------------- Eastern (Sharqi: Dammam, Ahsa, Qatif)
  { dialect: 'sharqi', text: 'وين حطيت السماعة مالتي؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'sharqi', text: 'شنو في الكبت؟', intent: 'list_location', places: ['p-wardrobe'] },
  { dialect: 'sharqi', text: 'وين خشيت المفتاح؟', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'sharqi', text: 'وين الشاحن مالي الأبيض', intent: 'find_item', targets: ['i-white-charger'] },
  { dialect: 'sharqi', text: 'ابي البوك', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'sharqi', text: 'شنهو اللي في درج المطبخ؟', intent: 'list_location', places: ['p-kitchen-drawer'] },
  { dialect: 'sharqi', text: 'وين حطيت الساعة؟', intent: 'find_item', targets: WATCHES },
  { dialect: 'sharqi', text: 'وينه الجواز؟', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'sharqi', text: 'وين خليت النظارة الشمسية', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'sharqi', text: 'وين يد البلايستيشن؟', intent: 'find_item', targets: ['i-controller'] },
  { dialect: 'sharqi', text: 'وين الغترة الحمرا', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'sharqi', text: 'ابي ثوبي الرصاصي', intent: 'find_item', targets: ['i-winter-thobe'] },
  { dialect: 'sharqi', text: 'وين حطيت الدهن', intent: 'find_item', targets: ['i-oud'] },
  { dialect: 'sharqi', text: 'شنو عندي في السيارة؟', intent: 'list_location', places: ['p-glovebox', 'p-car-drawer'] },
  { dialect: 'sharqi', text: 'وين ودّيت الدريل', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'sharqi', text: 'وين العباية مالتي', intent: 'find_item', targets: ['i-abaya'] },
  { dialect: 'sharqi', text: 'وين الريموت', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'sharqi', text: 'واجد دورت على الباور بانك وين هو؟', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'sharqi', text: 'وين أغراض السفر', intent: 'find_item', targets: TRAVEL },
  { dialect: 'sharqi', text: 'وين الهوية', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'sharqi', text: 'وين الكتاب', intent: 'find_item', targets: ['i-novel'] },
  { dialect: 'sharqi', text: 'وين الليقو', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'sharqi', text: 'وين المسبحة', intent: 'find_item', targets: ['i-misbaha'] },
  { dialect: 'sharqi', text: 'وين حطيت اللابتوب', intent: 'find_item', targets: ['i-laptop'] },
  { dialect: 'sharqi', text: 'وين شنطة السفر', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'sharqi', text: 'وين الخيمة', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'sharqi', text: 'وين الدوا', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'sharqi', text: 'وين حطيت الآيباد', intent: 'find_item', absent: true },
  { dialect: 'sharqi', text: 'شلون ألقى مفتاح السيارة', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'sharqi', text: 'وين كان الجواز قبل', intent: 'item_history', targets: ['i-passport'] },

  // ---------------------------------------------------------------- Southern (Janoubi: Asir, Jazan, Najran, Baha)
  { dialect: 'janoubi', text: 'اشتي السماعة حقي وين هي؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'janoubi', text: 'ويش في الدرج؟', intent: 'list_location', places: DRAWERS },
  { dialect: 'janoubi', text: 'وين حطيت المفتاح ذلحين؟', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'janoubi', text: 'ويش سويت بالشاحن؟', intent: 'find_item', targets: CHARGERS },
  { dialect: 'janoubi', text: 'اشتي البوك', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'janoubi', text: 'وين خليت النظارة؟', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'janoubi', text: 'وين الثوب حق العيد؟', intent: 'find_item', targets: ['i-eid-thobe'] },
  { dialect: 'janoubi', text: 'وين الجواز حقي؟', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'janoubi', text: 'وين الساعة؟', intent: 'find_item', targets: WATCHES },
  { dialect: 'janoubi', text: 'ويش عندي في الكومدينة؟', intent: 'list_location', places: ['p-nightstand'] },
  { dialect: 'janoubi', text: 'وين حطيت الشماغ؟', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'janoubi', text: 'وين العباية؟', intent: 'find_item', targets: ['i-abaya'] },
  { dialect: 'janoubi', text: 'وين المسبحة حقي؟', intent: 'find_item', targets: ['i-misbaha'] },
  { dialect: 'janoubi', text: 'وين الريموت؟', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'janoubi', text: 'وين البطاقة؟', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'janoubi', text: 'اشتي اغراض السفر', intent: 'find_item', targets: TRAVEL },
  { dialect: 'janoubi', text: 'وين الشنيور', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'janoubi', text: 'وين الدهن العود', intent: 'find_item', targets: ['i-oud'] },
  { dialect: 'janoubi', text: 'وين البلايستيشن', intent: 'find_item', targets: ['i-controller'] },
  { dialect: 'janoubi', text: 'وين الباور بانك', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'janoubi', text: 'وين اللابتوب', intent: 'find_item', targets: ['i-laptop'] },
  { dialect: 'janoubi', text: 'وين الدواء', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'janoubi', text: 'وين الليقو', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'janoubi', text: 'وين الخيمة', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'janoubi', text: 'ويش في المستودع', intent: 'list_location', places: ['p-storage'] },
  { dialect: 'janoubi', text: 'وين حطيت الجزمة', intent: 'find_item', targets: ['i-sneakers'] },
  { dialect: 'janoubi', text: 'وين الكتاب', intent: 'find_item', targets: ['i-novel'] },
  { dialect: 'janoubi', text: 'وين الفلوس؟', intent: 'find_item', absent: true },
  { dialect: 'janoubi', text: 'وشو اللي في الطبلون', intent: 'list_location', places: ['p-glovebox'] },
  { dialect: 'janoubi', text: 'هيه وين راح المفتاح حق السيارة', intent: 'find_item', targets: ['i-car-key'] },

  // ---------------------------------------------------------------- Northern (Shamali: Hail, Jouf, Tabuk, Northern Borders)
  { dialect: 'shamali', text: 'وين حاط السماعة؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'shamali', text: 'شو في الدرج؟', intent: 'list_location', places: DRAWERS },
  { dialect: 'shamali', text: 'بدي المفتاح وينه؟', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'shamali', text: 'وين الشاحن الأبيض هسه؟', intent: 'find_item', targets: ['i-white-charger'] },
  { dialect: 'shamali', text: 'وين المحفظة؟', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'shamali', text: 'وين النظارة؟', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'shamali', text: 'شو عندي في الدولاب؟', intent: 'list_location', places: ['p-wardrobe'] },
  { dialect: 'shamali', text: 'وين الجواز؟', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'shamali', text: 'وين الساعة؟', intent: 'find_item', targets: WATCHES },
  { dialect: 'shamali', text: 'وين حطيت الشماغ الأحمر', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'shamali', text: 'وين العباية السودا', intent: 'find_item', targets: ['i-abaya'] },
  { dialect: 'shamali', text: 'وين المسباح', intent: 'find_item', targets: ['i-misbaha'] },
  { dialect: 'shamali', text: 'وين الريموت حق المكيف', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'shamali', text: 'بدي أعرف وين الهوية', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'shamali', text: 'وين أغراض الكشتة', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'shamali', text: 'وين الدريل', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'shamali', text: 'وين العطر', intent: 'find_item', targets: ['i-oud'] },
  { dialect: 'shamali', text: 'وين يد التحكم', intent: 'find_item', targets: ['i-controller'] },
  { dialect: 'shamali', text: 'وين الباور بانك', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'shamali', text: 'وين اللابتوب', intent: 'find_item', targets: ['i-laptop'] },
  { dialect: 'shamali', text: 'وين الدوا', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'shamali', text: 'وين ألعاب العيال', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'shamali', text: 'وين الكتاب', intent: 'find_item', targets: ['i-novel'] },
  { dialect: 'shamali', text: 'وين شنطة السفر', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'shamali', text: 'وين مفتاح السيارة', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'shamali', text: 'شو في الخزنة', intent: 'list_location', places: ['p-safe'] },
  { dialect: 'shamali', text: 'وين حطيت الكوتش', intent: 'find_item', targets: ['i-sneakers'] },
  { dialect: 'shamali', text: 'وين الطابعة؟', intent: 'find_item', absent: true },
  { dialect: 'shamali', text: 'اشلون ألقى ثوبي الأبيض', intent: 'find_item', targets: ['i-eid-thobe'] },
  { dialect: 'shamali', text: 'وين كانت العباية قبل', intent: 'item_history', targets: ['i-abaya'] },

  // ---------------------------------------------------------------- Noise, speech-to-text artefacts, English, negatives
  { dialect: 'mixed', text: 'السلام عليكم', intent: 'smalltalk' },
  { dialect: 'mixed', text: 'كم الساعة؟', intent: 'smalltalk' },
  { dialect: 'mixed', text: 'شكراً', intent: 'smalltalk' },
  { dialect: 'mixed', text: 'اممم', intent: 'unknown', rephrase: true },
  { dialect: 'mixed', text: 'طيب', intent: 'unknown', rephrase: true },
  { dialect: 'mixed', text: 'وين', intent: 'unknown', rephrase: true },
  { dialect: 'mixed', text: 'وين حطيت', intent: 'unknown', rephrase: true },
  { dialect: 'mixed', text: 'وين حطيت سماعه تي', intent: 'find_item', targets: EARPHONES },
  { dialect: 'mixed', text: 'ويييين حطيييت المفتاااح', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'mixed', text: 'وينحطيت الشاحن', intent: 'find_item', targets: CHARGERS },
  { dialect: 'mixed', text: 'where is my wallet', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'mixed', text: "what's in the drawer", intent: 'list_location', places: DRAWERS },
  { dialect: 'mixed', text: 'وين الـ AirPods', intent: 'find_item', targets: ['i-airpods'] },
  { dialect: 'mixed', text: 'where are my car keys', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'mixed', text: 'وين البطارية حق الريموت', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'mixed', text: 'وين حطيت المفك', intent: 'find_item', absent: true },
  { dialect: 'mixed', text: 'الجو حلو اليوم', intent: 'unknown', rephrase: true },
];

/**
 * Held-out phrases, written after the lexicon was tuned on CORPUS and never used
 * to change it. Their success rate is the honest estimate of real-world accuracy
 * for the text layer.
 */
export const HOLDOUT: EvalCase[] = (
  [
  { dialect: 'najdi', text: 'وين رحت حطيت سماعات الاذن', intent: 'find_item', targets: EARPHONES },
  { dialect: 'najdi', text: 'المفاتيح وين راحت؟', intent: 'find_item', targets: ['i-house-keys', 'i-car-key'] },
  { dialect: 'najdi', text: 'شفت البوك حقي؟', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'najdi', text: 'ياخي وين ثوبي الأبيض اللي للعيد', intent: 'find_item', targets: ['i-eid-thobe'] },
  { dialect: 'najdi', text: 'ما ادري وش سويت بالنظارة', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'najdi', text: 'وش عندي بالكومدينة', intent: 'list_location', places: ['p-nightstand'] },
  { dialect: 'najdi', text: 'وين حاط عدة البر', intent: 'find_item', targets: ['i-tent'] },
  { dialect: 'najdi', text: 'الشنطة الكبيرة حقت السفر وينها', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'najdi', text: 'وين جوازي', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'najdi', text: 'وين علبة البنادول', intent: 'find_item', targets: ['i-panadol'] },
  { dialect: 'najdi', text: 'وين ساعة الكاسيو', intent: 'find_item', targets: ['i-casio'] },
  { dialect: 'najdi', text: 'وش في درج السيارة', intent: 'list_location', places: ['p-car-drawer'] },

  { dialect: 'hijazi', text: 'فين راحت السماعات حقتي', intent: 'find_item', targets: EARPHONES },
  { dialect: 'hijazi', text: 'ابغى اعرف فين الشاحن حق اللابتوب', intent: 'find_item', targets: ['i-laptop-charger'] },
  { dialect: 'hijazi', text: 'فين الجزمة الرياضية', intent: 'find_item', targets: ['i-sneakers'] },
  { dialect: 'hijazi', text: 'ايش في الصندوق حق الالعاب', intent: 'list_location', places: ['p-kids-box'] },
  { dialect: 'hijazi', text: 'فين الكرت حق البنك', intent: 'find_item', absent: true },
  { dialect: 'hijazi', text: 'دحين فين الشماغ الأحمر حقي', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'hijazi', text: 'فين خليت مفاتيح الموتر', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'hijazi', text: 'فين القلم', intent: 'find_item', absent: true },
  { dialect: 'hijazi', text: 'عندي ايش في الطبلون', intent: 'list_location', places: ['p-glovebox'] },
  { dialect: 'hijazi', text: 'فين الريموت حق التلفزيون', intent: 'find_item', targets: ['i-ac-remote'] },
  { dialect: 'hijazi', text: 'فين حطيت العقال', intent: 'find_item', absent: true },
  { dialect: 'hijazi', text: 'فين كتاب ساق البامبو', intent: 'find_item', targets: ['i-novel'] },

  { dialect: 'sharqi', text: 'وين السماعات اللي اشتريتها', intent: 'find_item', targets: EARPHONES },
  { dialect: 'sharqi', text: 'شنو اللي في الخزانة', intent: 'list_location', places: ['p-wardrobe'] },
  { dialect: 'sharqi', text: 'وين المفاتيح مالت البيت', intent: 'find_item', targets: ['i-house-keys'] },
  { dialect: 'sharqi', text: 'ابي اعرف وين حطيت الدهن العود', intent: 'find_item', targets: ['i-oud'] },
  { dialect: 'sharqi', text: 'وين صارت الساعة الأبل', intent: 'find_item', targets: ['i-apple-watch'] },
  { dialect: 'sharqi', text: 'وين الجواز مالي', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'sharqi', text: 'وين قطعة الليقو', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'sharqi', text: 'شنو في الملحق', intent: 'list_location', places: ['p-annex'] },
  { dialect: 'sharqi', text: 'وين الشاحن المتنقل', intent: 'find_item', targets: ['i-powerbank'] },
  { dialect: 'sharqi', text: 'وين الكاب', intent: 'find_item', absent: true },
  { dialect: 'sharqi', text: 'ودي اعرف وين البشت', intent: 'find_item', absent: true },
  { dialect: 'sharqi', text: 'وين كيبل الايفون', intent: 'find_item', targets: ['i-white-charger'] },

  { dialect: 'janoubi', text: 'وين السماعه اللي حقي ذلحين', intent: 'find_item', targets: EARPHONES },
  { dialect: 'janoubi', text: 'اشتي المفتاح حق الموتر', intent: 'find_item', targets: ['i-car-key'] },
  { dialect: 'janoubi', text: 'ويش عندي في الصاله', intent: 'list_location', places: ['p-entrance', 'p-shoe-cabinet', 'p-books'] },
  { dialect: 'janoubi', text: 'وين الثوب الشتوي', intent: 'find_item', targets: ['i-winter-thobe'] },
  { dialect: 'janoubi', text: 'وين النظاره السودا', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'janoubi', text: 'وين حطيت الهويه حقي', intent: 'find_item', targets: ['i-id-card'] },
  { dialect: 'janoubi', text: 'وين المصحف', intent: 'find_item', absent: true },
  { dialect: 'janoubi', text: 'اشتي الشنطه', intent: 'find_item', targets: ['i-suitcase'] },
  { dialect: 'janoubi', text: 'ويش في الدبه', intent: 'list_location', absent: true },
  { dialect: 'janoubi', text: 'وين البخور', intent: 'find_item', absent: true },
  { dialect: 'janoubi', text: 'وين ساعتي الفضيه', intent: 'find_item', targets: ['i-casio'] },
  { dialect: 'janoubi', text: 'وين يد البلايستيشن حقت العيال', intent: 'find_item', targets: ['i-controller'] },

  { dialect: 'shamali', text: 'وين حاطط السماعات', intent: 'find_item', targets: EARPHONES },
  { dialect: 'shamali', text: 'بدي ساعتي هسه', intent: 'find_item', targets: WATCHES },
  { dialect: 'shamali', text: 'شو في المجلس', intent: 'list_location', places: ['p-majlis-table', 'p-majlis-shelf', 'p-tv-drawer'] },
  { dialect: 'shamali', text: 'وين صارت المحفظة البنية', intent: 'find_item', targets: ['i-wallet'] },
  { dialect: 'shamali', text: 'وين الشماغ', intent: 'find_item', targets: ['i-shemagh'] },
  { dialect: 'shamali', text: 'وين خليت الدريل حق بوش', intent: 'find_item', targets: ['i-drill'] },
  { dialect: 'shamali', text: 'اشلون الاقي الجواز', intent: 'find_item', targets: ['i-passport'] },
  { dialect: 'shamali', text: 'وين لعبة الليقو', intent: 'find_item', targets: ['i-lego'] },
  { dialect: 'shamali', text: 'وين حطيت الفلاش', intent: 'find_item', absent: true },
  { dialect: 'shamali', text: 'شو عندي في الكراج', intent: 'list_location', places: ['p-garage-shelf'] },
  { dialect: 'shamali', text: 'وين البوت', intent: 'find_item', absent: true },
  { dialect: 'shamali', text: 'وين العباية حقت الزواجات', intent: 'find_item', targets: ['i-abaya'] },

  { dialect: 'mixed', text: 'Where did I put my sunglasses', intent: 'find_item', targets: ['i-sunglasses'] },
  { dialect: 'mixed', text: 'وين ال charger الأبيض', intent: 'find_item', targets: ['i-white-charger'] },
  { dialect: 'mixed', text: 'وين حطيت سماعتي ؟؟', intent: 'find_item', targets: EARPHONES },
  { dialect: 'mixed', text: 'يا مَحَلّك وين المفتاح', intent: 'find_item', targets: ['i-house-keys', 'i-car-key'] },
  { dialect: 'mixed', text: 'اهلين', intent: 'smalltalk' },
  ] satisfies EvalCase[]
).map((c) => ({ ...c, set: 'holdout' as const }));
