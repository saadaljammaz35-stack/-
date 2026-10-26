import nawawi from '../../../data/hadith/bundled/nawawi.json';
import { arabicDays, normalizeArabic, toArabicDigits, fromArabicDigits, stripDiacritics } from '../arabic';
import { gradeTone, translateGrade } from '../hadith-grades';
import { failedReferenceChecks, processEdition, type RawEdition } from '../hadith-import';

describe('arabic text', () => {
  it('normalizes for search', () => {
    expect(normalizeArabic('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).toBe('انما الاعمال بالنيات');
    expect(normalizeArabic('مُؤْمِنٍ كُرْبَةً')).toBe('مومن كربه');
    expect(normalizeArabic('عَلَى')).toBe('علي');
    expect(normalizeArabic('ٱلْحَمْدُ لِلَّهِ، رَبِّ!')).toBe('الحمد لله رب');
    expect(stripDiacritics('بِسْمِ')).toBe('بسم');
  });

  it('converts digits both ways', () => {
    expect(toArabicDigits(1448)).toBe('١٤٤٨');
    expect(fromArabicDigits('١٤٤٨')).toBe('1448');
  });
});

describe('hadith import', () => {
  it('imports the bundled Forty Nawawi with its reference check', () => {
    const { rows, skippedEmpty } = processEdition(nawawi as RawEdition);
    expect(rows).toHaveLength(42);
    expect(skippedEmpty).toBe(0);
    expect(failedReferenceChecks('nawawi', rows)).toEqual([]);
  });

  it('reports a numbering mismatch', () => {
    const { rows } = processEdition(nawawi as RawEdition);
    const shuffled = rows.map((r, i) => ({ ...r, n: i === 0 ? 99 : r.n }));
    expect(failedReferenceChecks('nawawi', shuffled)).toEqual(['nawawi 1: missing']);
  });

  it('translates grade labels without guessing', () => {
    expect(translateGrade('Hasan Sahih')).toBe('حسن صحيح');
    expect(translateGrade('Very Daif')).toBe('ضعيف جدًا');
    expect(translateGrade('Isnaad Sahih')).toBe('إسناده صحيح');
    expect(translateGrade('Sahih Lighairihi')).toBe('صحيح لغيره');
    expect(translateGrade('Something new')).toBe('Something new');
    expect(gradeTone('ضعيف جدًا')).toBe('daif');
    expect(gradeTone('حسن')).toBe('hasan');
    expect(gradeTone('حسن صحيح')).toBe('sahih');
  });
});

describe('arabic day counts', () => {
  it('agrees the noun with the number', () => {
    expect([1, 2, 3, 10, 11, 99, 100, 103, 111].map(arabicDays)).toEqual(['يوم واحد', 'يومان', '3 أيام', '10 أيام', '11 يومًا', '99 يومًا', '100 يوم', '103 أيام', '111 يومًا']);
  });
});
