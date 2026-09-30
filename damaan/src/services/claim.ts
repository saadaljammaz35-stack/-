import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { category } from '../domain/categories';
import { formatLongDate, formatShortDate, fromISODate, humanDuration } from '../domain/dates';
import { deadlinesFor, type DeadlineKind } from '../domain/deadlines';
import { formatMoney } from '../domain/money';
import type { Receipt } from '../domain/receipt';
import { imageAsDataUri } from './files';
import type { Settings } from './settings';

export type ClaimKind = DeadlineKind;

const CLAIM_TITLES: Record<ClaimKind, string> = {
  warranty: 'مطالبة بتفعيل الضمان',
  return: 'طلب استرجاع وإرجاع المبلغ',
  exchange: 'طلب استبدال',
};

const CLAIM_REQUESTS: Record<ClaimKind, string> = {
  warranty: 'إصلاح المنتج أو استبداله بموجب الضمان الساري.',
  return: 'استرجاع المنتج وإعادة المبلغ المدفوع بالكامل.',
  exchange: 'استبدال المنتج بآخر سليم من النوع نفسه.',
};

export type ClaimInput = {
  receipt: Receipt;
  kind: ClaimKind;
  /** What is wrong, in the person's own words. */
  problem: string;
  settings: Settings;
};

/** A short human-quotable reference: `DMN-260930-4F2A`. */
export function claimReference(receipt: Receipt, now: Date = new Date()): string {
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const tail = receipt.id.slice(-4).toUpperCase();
  return `DMN-${stamp}-${tail}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A plain-text version of the claim, for pasting into WhatsApp — which is how
 * most people in the Gulf actually reach a shop's customer service.
 */
export function claimMessage({ receipt, kind, problem, settings }: ClaimInput, now: Date = new Date()): string {
  const deadline = deadlinesFor(receipt, now).find((entry) => entry.kind === kind);
  const lines = [
    `${CLAIM_TITLES[kind]} — ${claimReference(receipt, now)}`,
    '',
    `المتجر: ${receipt.merchant}`,
    `المنتج: ${receipt.item || category(receipt.categoryId).label}`,
    `تاريخ الشراء: ${formatShortDate(fromISODate(receipt.purchaseDate))}`,
    `المبلغ: ${formatMoney(receipt.totalMinor)}`,
  ];

  if (receipt.serial) lines.push(`الرقم التسلسلي: ${receipt.serial}`);
  if (deadline?.endsOn) lines.push(`تنتهي مدة ${deadline.label}: ${formatShortDate(deadline.endsOn)}`);

  lines.push('', `المشكلة: ${problem || 'غير محددة'}`, '', `المطلوب: ${CLAIM_REQUESTS[kind]}`);

  if (settings.ownerName) lines.push('', `مقدّم الطلب: ${settings.ownerName}`);
  if (settings.ownerPhone) lines.push(`للتواصل: ${settings.ownerPhone}`);

  lines.push('', 'مرفق صورة الفاتورة.');
  return lines.join('\n');
}

function claimHtml({ receipt, kind, problem, settings }: ClaimInput, imageTags: string, now: Date): string {
  const cat = category(receipt.categoryId);
  const deadline = deadlinesFor(receipt, now).find((entry) => entry.kind === kind);

  const rows: [string, string][] = [
    ['المتجر / البائع', receipt.merchant || '—'],
    ['المنتج', receipt.item || cat.label],
    ['الفئة', cat.label],
    ['تاريخ الشراء', formatLongDate(fromISODate(receipt.purchaseDate))],
    ['المبلغ المدفوع', formatMoney(receipt.totalMinor)],
    ['مدة الضمان', humanDuration(receipt.warrantyMonths)],
  ];

  if (receipt.serial) rows.push(['الرقم التسلسلي', receipt.serial]);
  if (deadline?.endsOn) {
    rows.push([
      `نهاية مدة ${deadline.label}`,
      `${formatLongDate(deadline.endsOn)}${deadline.daysLeft >= 0 ? ` (باقي ${deadline.daysLeft} يوم)` : ' (منتهية)'}`,
    ]);
  }

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const claimant = [settings.ownerName, settings.ownerPhone].filter(Boolean).map(escapeHtml).join(' — ');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(CLAIM_TITLES[kind])}</title>
<style>
  :root { --ink:#111113; --muted:#6b6b70; --line:#dedee3; --accent:#5856D6; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "SF Arabic", "Geeza Pro", system-ui, sans-serif;
    color: var(--ink); margin: 0; padding: 40px 44px; line-height: 1.7; font-size: 13.5px;
  }
  header { display:flex; justify-content:space-between; align-items:flex-start;
           border-bottom:2px solid var(--accent); padding-bottom:14px; margin-bottom:26px; }
  h1 { font-size: 21px; margin: 0 0 4px; }
  .ref { font-size: 11.5px; color: var(--muted); }
  .brand { font-size: 12px; color: var(--accent); font-weight: 700; text-align: left; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: var(--muted); margin: 26px 0 10px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 9px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { width: 34%; font-weight: 600; color: var(--muted); font-size: 12.5px; }
  .problem { background:#f6f6f9; border-radius:10px; padding:14px 16px; white-space:pre-wrap; }
  .request { border-inline-start:3px solid var(--accent); padding-inline-start:14px; font-weight:600; }
  .images { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; }
  .images img { max-width: 47%; border:1px solid var(--line); border-radius:8px; }
  footer { margin-top:34px; padding-top:12px; border-top:1px solid var(--line);
           font-size:10.5px; color:var(--muted); display:flex; justify-content:space-between; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(CLAIM_TITLES[kind])}</h1>
      <div class="ref">المرجع ${escapeHtml(claimReference(receipt, now))} · ${escapeHtml(formatLongDate(now))}</div>
    </div>
    <div class="brand">ضَمان</div>
  </header>

  <h2>بيانات المشترى</h2>
  <table>${tableRows}</table>

  <h2>وصف المشكلة</h2>
  <div class="problem">${escapeHtml(problem || 'لم يُذكر وصف.')}</div>

  <h2>المطلوب</h2>
  <p class="request">${escapeHtml(CLAIM_REQUESTS[kind])}</p>

  ${claimant ? `<h2>مقدّم الطلب</h2><p>${claimant}</p>` : ''}

  ${imageTags ? `<h2>صورة الفاتورة</h2><div class="images">${imageTags}</div>` : ''}

  <footer>
    <span>حُرِّر بواسطة تطبيق ضَمان</span>
    <span>${escapeHtml(claimReference(receipt, now))}</span>
  </footer>
</body>
</html>`;
}

/**
 * Renders the claim to a PDF in the cache directory and returns its URI.
 * Up to two receipt images are embedded; more than that bloats the file for
 * no added proof.
 */
export async function buildClaimPdf(input: ClaimInput, now: Date = new Date()): Promise<string> {
  const dataUris = await Promise.all(input.receipt.images.slice(0, 2).map((name) => imageAsDataUri(name)));
  const imageTags = dataUris
    .filter((uri): uri is string => uri !== null)
    .map((uri) => `<img src="${uri}" alt="صورة الفاتورة" />`)
    .join('');

  const { uri } = await Print.printToFileAsync({
    html: claimHtml(input, imageTags, now),
    base64: false,
  });

  return uri;
}

/** Builds the PDF and hands it to the share sheet. */
export async function shareClaimPdf(input: ClaimInput): Promise<void> {
  const uri = await buildClaimPdf(input);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('المشاركة غير متاحة على هذا الجهاز');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: CLAIM_TITLES[input.kind],
    UTI: 'com.adobe.pdf',
  });
}
