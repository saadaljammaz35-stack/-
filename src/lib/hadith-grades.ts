// Arabic labels for the hadith grading data (grader names and grade terms as published
// in the source dataset). Shared by the data pipeline and the in-app book importer, so
// keep this file free of imports.

export const GRADERS: Record<string, string> = {
  'Al-Albani': 'الألباني',
  'Zubair Ali Zai': 'زبير علي زئي',
  'Shuaib Al Arnaut': 'شعيب الأرناؤوط',
  'Muhammad Muhyi Al-Din Abdul Hamid': 'محمد محيي الدين عبد الحميد',
  'Ahmad Muhammad Shakir': 'أحمد محمد شاكر',
  'Bashar Awad Maarouf': 'بشار عواد معروف',
  'Abu Ghuddah': 'عبد الفتاح أبو غدة',
  'Muhammad Fouad Abd al-Baqi': 'محمد فؤاد عبد الباقي',
  'Salim al-Hilali': 'سليم الهلالي',
};

// Longest phrases first so «Very Daif» wins over «Daif».
const GRADE_TERMS: [string, string][] = [
  ['Sahih - Agreed Upon', 'صحيح متفق عليه'],
  ['Sahih - Bukhari And Muslim', 'صحيح (البخاري ومسلم)'],
  ['Isnaad Sahih Agreed Upon', 'إسناده صحيح متفق عليه'],
  ['Agreed Upon', 'متفق عليه'],
  ['Sahih Bukhari', 'صحيح البخاري'],
  ['Sahih Muslim', 'صحيح مسلم'],
  ['Very Daif Isnaad', 'إسناده ضعيف جدًا'],
  ['Very Daif', 'ضعيف جدًا'],
  ['Hasan Sahih Isnaad', 'إسناده حسن صحيح'],
  ['Hasan Sahih', 'حسن صحيح'],
  ['Isnaad Hasan', 'إسناده حسن'],
  ['Isnaad Sahih', 'إسناده صحيح'],
  ['Sahih Isnaad', 'صحيح الإسناد'],
  ['Hasan Isnaad', 'حسن الإسناد'],
  ['Daif Isnaad', 'ضعيف الإسناد'],
  ['Sanad Daif', 'سنده ضعيف'],
  ['Lighairihi', 'لغيره'],
  ['Sahih Hadith', 'حديث صحيح'],
  ['Mutawatir', 'متواتر'],
  ['Mauquf', 'موقوف'],
  ['Muquf', 'موقوف'],
  ['Maqtu', 'مقطوع'],
  ['Mursal', 'مرسل'],
  ['Mawdu', 'موضوع'],
  ['Maudu', 'موضوع'],
  ['Munkar', 'منكر'],
  ['Shadh', 'شاذ'],
  ['Batil', 'باطل'],
  ['Matn', 'المتن'],
  ['Sahih', 'صحيح'],
  ['Hasan', 'حسن'],
  ['Daif', 'ضعيف'],
  ['Isnaad', 'الإسناد'],
  ['Sanad', 'السند'],
];

/** Translates a grade label; anything not fully covered keeps its original wording. */
export function translateGrade(grade: string): string {
  let out = grade.trim();
  for (const [en, ar] of GRADE_TERMS) out = out.split(en).join(ar);
  out = out.replace(/\s+-\s+/g, ' — ').replace(/\s+/g, ' ').trim();
  return /[A-Za-z]/.test(out) ? grade.trim() : out;
}

export type HadithGrade = { by: string; grade: string };

export function translateGrades(grades: { name: string; grade: string }[] | undefined): HadithGrade[] {
  return (grades ?? [])
    .filter((g) => g.grade && g.grade.trim() !== '-')
    .map((g) => ({ by: GRADERS[g.name] ?? g.name, grade: translateGrade(g.grade) }));
}

/** Rough strength bucket for colouring a grade chip. */
export function gradeTone(grade: string): 'sahih' | 'hasan' | 'daif' | 'other' {
  if (/موضوع|باطل|منكر|ضعيف/.test(grade)) return 'daif';
  if (/حسن/.test(grade) && !/صحيح/.test(grade)) return 'hasan';
  if (/صحيح|متفق/.test(grade)) return 'sahih';
  return 'other';
}
