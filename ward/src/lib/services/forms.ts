import { z } from 'zod';

/**
 * Coercions shared by every write endpoint. HTML forms send strings ("" for empty fields);
 * JSON clients send real types. Both normalize to the same values here.
 */
export const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();
export const reqText = (min: number, max: number) => z.string().trim().min(min).max(max);
export const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable()).optional();
export const optNumber = (min = 0, max = 1e9) => z.preprocess((v) => (emptyToNull(v) === null ? null : Number(v)), z.number().min(min).max(max).nullable()).optional();
export const optDate = z.preprocess(
  (v) => {
    const x = emptyToNull(v);
    if (x === null) return null;
    // <input type="datetime-local"> sends wall-clock time without a zone: WARD runs on Riyadh time (UTC+3, no DST).
    const raw = String(x);
    const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw) ? `${raw}+03:00` : raw);
    return Number.isNaN(d.getTime()) ? 'invalid' : d.toISOString();
  },
  z.string().datetime().nullable(),
).optional();
export const optDay = z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()).optional();
export const checkbox = z.preprocess((v) => v === true || v === 'on' || v === 'true' || v === '1', z.boolean());
export const lines = (maxItems: number, maxLen: number) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((s) => String(s).trim()).filter(Boolean),
    z.array(z.string().max(maxLen)).max(maxItems),
  );
