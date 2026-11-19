/** Normalizes a Saudi mobile number to E.164 (+9665XXXXXXXX). Returns null when invalid. */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = (input || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '');
  let local: string | null = null;
  if (/^9665\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^009665\d{8}$/.test(digits)) local = digits.slice(5);
  else if (/^05\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^5\d{8}$/.test(digits)) local = digits;
  return local ? `+966${local}` : null;
}

export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 6)}•••${phone.slice(-3)}` : phone;
}
