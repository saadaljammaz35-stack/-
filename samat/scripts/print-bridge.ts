// SAMAT LAN print bridge — runs on a computer in the branch, on the same network as the printer.
//   SAMAT_URL=https://your-site PRINT_BRIDGE_TOKEN=... PRINTER_HOST=192.168.1.50 [PRINTER_PORT=9100] npm run print-bridge
// Pulls queued "network printer" jobs, renders the receipt to a 1-bit image (Arabic shaped by the OS
// fonts through sharp/librsvg) and sends ESC/POS raster bytes to the printer's raw port 9100.
import net from 'node:net';
import sharp from 'sharp';
import { EscPos, PRINTER_DOTS } from '../src/lib/printing/escpos.ts';

const URL_BASE = process.env.SAMAT_URL ?? 'http://localhost:3000';
const TOKEN = process.env.PRINT_BRIDGE_TOKEN ?? '';
const HOST = process.env.PRINTER_HOST ?? '';
const PORT = Number(process.env.PRINTER_PORT ?? 9100);
if (!TOKEN || !HOST) throw new Error('Set PRINT_BRIDGE_TOKEN and PRINTER_HOST');

type Receipt = { kind: string; order: { number: number; pickupCode: string; customerName: string; notes: string | null }; invoice: { number: string } | null;
  seller: { name: string; vat: string | null }; items: { qty: number; nameAr: string; bread: string | null; lineTotal: number; notes: string | null; mods: { action: string; nameAr: string; qty: number }[] }[];
  totals: { vat: number; total: number } };

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function receiptSvg(r: Receipt, width: number): { svg: string; height: number } {
  const lines: { t: string; size: number; bold?: boolean; align?: 'middle' | 'end' }[] = [];
  const kitchen = r.kind === 'kitchen_ticket';
  lines.push({ t: kitchen ? 'ورقة المطبخ' : r.seller.name, size: 30, bold: true, align: 'middle' });
  if (!kitchen && r.seller.vat) lines.push({ t: `الرقم الضريبي ${r.seller.vat}`, size: 20, align: 'middle' });
  if (!kitchen && r.invoice) lines.push({ t: `فاتورة ضريبية مبسطة ${r.invoice.number}`, size: 20, align: 'middle' });
  lines.push({ t: `#${r.order.number}  ·  ${r.order.pickupCode}`, size: kitchen ? 44 : 32, bold: true, align: 'middle' });
  lines.push({ t: r.order.customerName, size: 22, align: 'middle' });
  for (const i of r.items) {
    lines.push({ t: `${i.qty}× ${i.nameAr}${kitchen ? '' : `   ${(i.lineTotal / 100).toFixed(2)}`}`, size: kitchen ? 30 : 24, bold: true });
    if (i.bread) lines.push({ t: `الخبز: ${i.bread}`, size: 22 });
    for (const m of i.mods) lines.push({ t: `${m.action === 'removed' ? '✕ بدون' : '+'} ${m.nameAr}${m.qty > 1 && m.action !== 'removed' ? ` ×${m.qty}` : ''}`, size: kitchen ? 26 : 20, bold: kitchen && m.action === 'removed' });
    if (i.notes) lines.push({ t: `ملاحظة: ${i.notes}`, size: 20 });
  }
  if (r.order.notes) lines.push({ t: `ملاحظات: ${r.order.notes}`, size: 22, bold: true });
  if (!kitchen) {
    lines.push({ t: `الضريبة ${(r.totals.vat / 100).toFixed(2)}`, size: 22 });
    lines.push({ t: `الإجمالي ${(r.totals.total / 100).toFixed(2)} ر.س`, size: 30, bold: true });
  }
  let y = 10;
  const body = lines.map((l) => {
    y += l.size * 1.45;
    const x = l.align === 'middle' ? width / 2 : width - 8;
    return `<text x="${x}" y="${y}" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" text-anchor="${l.align === 'middle' ? 'middle' : 'start'}" direction="rtl" font-family="Noto Sans Arabic, Tahoma, DejaVu Sans, sans-serif">${esc(l.t)}</text>`;
  }).join('');
  const height = Math.ceil(y + 30);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`, height };
}

function send(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host: HOST, port: PORT }, () => s.end(Buffer.from(bytes)));
    s.setTimeout(15000, () => { s.destroy(); reject(new Error('printer timeout')); });
    s.on('close', () => resolve());
    s.on('error', reject);
  });
}

async function tick() {
  const res = await fetch(`${URL_BASE}/api/print-bridge`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`bridge HTTP ${res.status}`);
  const { jobs } = (await res.json()) as { jobs: { id: string; format: '80mm' | '58mm'; receipt: Receipt }[] };
  for (const j of jobs) {
    try {
      const dots = PRINTER_DOTS[j.format === '58mm' ? '58mm' : '80mm'];
      const { svg, height } = receiptSvg(j.receipt, dots);
      const { data, info } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
      await send(new EscPos().init().raster(data, info.width, height, 1).feed(4).cut().bytes());
      await fetch(`${URL_BASE}/api/print-bridge`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id, ok: true }) });
      console.log('printed', j.id);
    } catch (e) {
      await fetch(`${URL_BASE}/api/print-bridge`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id, ok: false, error: String(e) }) });
      console.error('failed', j.id, e);
    }
  }
}

console.log(`SAMAT print bridge → ${HOST}:${PORT}`);
for (;;) {
  await tick().catch((e) => console.error(e.message));
  await new Promise((r) => setTimeout(r, 3000));
}
