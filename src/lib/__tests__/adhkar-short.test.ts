import { fromSahihayn } from '../adhkar-short';

describe('short adhkar', () => {
  it('keeps what al-Bukhari or Muslim reported', () => {
    expect(fromSahihayn('أخرجه البخاري (4008)، ومسلم (807).')).toBe(true);
    expect(fromSahihayn('مسلم، 4/ 2088، برقم 2723.')).toBe(true);
    expect(fromSahihayn('صحيح البخاري: 6404، صحيح مسلم: 2693')).toBe(true);
    expect(fromSahihayn('البخاري مع ((الفتح)) (11/101)')).toBe(true);
  });
  it('leaves out other books, even when they mention al-Bukhari later', () => {
    expect(fromSahihayn('أخرجه أبو داود، 4/ 317، برقم 5069، والبخاري في الأدب المفرد')).toBe(false);
    expect(fromSahihayn('أخرجه الحاكم، 1/562')).toBe(false);
    expect(fromSahihayn('الترمذي، 5/ 466، برقم 3391')).toBe(false);
  });
});
