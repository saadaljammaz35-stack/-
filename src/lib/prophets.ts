// «الأنبياء في القرآن»: the twenty-five prophets named in the Quran, in their well-known order, with
// how to find the verses that name each. Names that are also ordinary words (صالح، هود، يحيى) are
// matched only in the phrases that name the prophet.

export type Prophet = { ar: string; en: string; /** Word forms (plain spelling) that name him. */ words: string[]; /** Phrases that name him. */ phrases: string[] };

export const PROPHETS: Prophet[] = [
  { ar: 'آدم', en: 'Adam', words: ['ادم'], phrases: [] },
  { ar: 'إدريس', en: 'Idris', words: ['ادريس'], phrases: [] },
  { ar: 'نوح', en: 'Nuh', words: ['نوح', 'نوحا'], phrases: [] },
  { ar: 'هود', en: 'Hud', words: [], phrases: ['اخاهم هودا', 'يا هود', 'نجينا هودا', 'قوم هود', 'اخوهم هود'] },
  { ar: 'صالح', en: 'Salih', words: [], phrases: ['اخاهم صالحا', 'يا صالح', 'نجينا صالحا', 'قوم صالح', 'اخوهم صالح'] },
  { ar: 'إبراهيم', en: 'Ibrahim', words: ['ابراهيم'], phrases: [] },
  { ar: 'لوط', en: 'Lut', words: ['لوط', 'لوطا'], phrases: [] },
  { ar: 'إسماعيل', en: 'Ismaʿil', words: ['اسماعيل'], phrases: [] },
  { ar: 'إسحاق', en: 'Ishaq', words: ['اسحاق'], phrases: [] },
  { ar: 'يعقوب', en: 'Yaʿqub', words: ['يعقوب'], phrases: [] },
  { ar: 'يوسف', en: 'Yusuf', words: ['يوسف'], phrases: [] },
  { ar: 'أيوب', en: 'Ayyub', words: ['ايوب'], phrases: [] },
  { ar: 'شعيب', en: 'Shuʿayb', words: ['شعيب', 'شعيبا'], phrases: [] },
  { ar: 'موسى', en: 'Musa', words: ['موسى'], phrases: [] },
  { ar: 'هارون', en: 'Harun', words: ['هارون'], phrases: [] },
  { ar: 'ذو الكفل', en: 'Dhul-Kifl', words: [], phrases: ['ذا الكفل'] },
  { ar: 'داود', en: 'Dawud', words: ['داود', 'داوود'], phrases: [] },
  { ar: 'سليمان', en: 'Sulayman', words: ['سليمان'], phrases: [] },
  { ar: 'إلياس', en: 'Ilyas', words: ['الياس'], phrases: ['ال ياسين'] },
  { ar: 'اليسع', en: 'al-Yasaʿ', words: ['اليسع'], phrases: [] },
  { ar: 'يونس', en: 'Yunus', words: ['يونس'], phrases: ['ذا النون', 'صاحب الحوت'] },
  { ar: 'زكريا', en: 'Zakariya', words: ['زكريا'], phrases: [] },
  { ar: 'يحيى', en: 'Yahya', words: [], phrases: ['بيحيى', 'وزكريا ويحيى', 'اسمه يحيى', 'يا يحيى', 'له يحيى'] },
  { ar: 'عيسى', en: 'ʿIsa', words: ['عيسى'], phrases: [] },
  { ar: 'محمد ﷺ', en: 'Muhammad ﷺ', words: ['محمد', 'احمد'], phrases: [] },
];

/** Letters that attach to the front of a name: و ف ل ب ك and their pairs. */
export const NAME_PREFIXES = ['', 'و', 'ف', 'ل', 'ب', 'ك', 'ول', 'فل', 'وب'];

/** SQL LIKE patterns over «' ' || text_simple || ' '» that find the verses naming a prophet. */
export function prophetPatterns(p: Prophet): string[] {
  return [...p.words.flatMap((w) => NAME_PREFIXES.map((x) => `% ${x}${w} %`)), ...p.phrases.map((ph) => `%${ph}%`)];
}
