import ar from '../ar';
import en from '../en';
import i18n from '../index';

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leafKeys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
// Plural variants differ per language (Arabic has 6 forms, English 2-3).
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');

describe('translations', () => {
  it('English covers every Arabic key', () => {
    const arKeys = new Set(leafKeys(ar).map(base));
    const enKeys = new Set(leafKeys(en as Record<string, unknown>).map(base));
    const missing = [...arKeys].filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('uses all six Arabic plural forms correctly', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.t('common.items', { count: 0 })).toBe('لا توجد أغراض');
    expect(i18n.t('common.items', { count: 1 })).toBe('غرض واحد');
    expect(i18n.t('common.items', { count: 2 })).toBe('غرضان');
    expect(i18n.t('common.items', { count: 5 })).toBe('5 أغراض');
    expect(i18n.t('common.items', { count: 11 })).toBe('11 غرضاً');
    expect(i18n.t('common.items', { count: 100 })).toBe('100 غرض');
  });

  it('switches to English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('common.items', { count: 3 })).toBe('3 items');
    expect(i18n.t('home.question')).toBe('What are you looking for today?');
    await i18n.changeLanguage('ar');
  });

  it('never applies letter-spacing to Arabic copy (no zero-width tricks in strings)', () => {
    const all = leafKeys(ar).map((k) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ar) as string);
    expect(all.some((s) => /[​-‍]/.test(s))).toBe(false);
  });
});
