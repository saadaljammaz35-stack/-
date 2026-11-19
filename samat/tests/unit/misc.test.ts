import { describe, expect, it } from 'vitest';
import { normalizeSaudiPhone, maskPhone } from '@/lib/phone';
import { formatMoney, toHalalas } from '@/lib/money';
import { decodeTlv, zatcaTlvBase64 } from '@/lib/invoice/zatca';
import { EscPos } from '@/lib/printing/escpos';
import { sniffReceipt } from '@/lib/payments/receipt';
import { normalizeMoyasar, mapMoyasarStatus, MoyasarGateway } from '@/lib/payments/moyasar';
import { createSimulatedPaymentId, SimulatorGateway } from '@/lib/payments/simulator';
import { customerSms, staffNewOrderEmail, type OrderForMessage } from '@/lib/notify/templates';
import { fromDbError } from '@/lib/errors';

describe('phone', () => {
  it.each([['0501234567', '+966501234567'], ['501234567', '+966501234567'], ['+966 50 123 4567', '+966501234567'], ['00966501234567', '+966501234567'], ['٠٥٠١٢٣٤٥٦٧', '+966501234567']])('%s → %s', (i, o) => {
    expect(normalizeSaudiPhone(i)).toBe(o);
  });
  it.each(['0401234567', '12345', '05012345678', ''])('rejects %s', (i) => expect(normalizeSaudiPhone(i)).toBeNull());
  it('masks', () => expect(maskPhone('+966501234567')).toBe('+96650•••567'));
});

describe('money', () => {
  it('formats both locales', () => {
    expect(formatMoney(2850, 'ar')).toBe('28.50 ر.س');
    expect(formatMoney(123456, 'en')).toBe('SAR 1,234.56');
  });
  it('converts SAR to halalas without float drift', () => expect(toHalalas('19.99')).toBe(1999));
});

describe('ZATCA phase-1 QR', () => {
  it('encodes the five TLV fields', () => {
    const b64 = zatcaTlvBase64({ sellerName: 'سماط', vatNumber: '300000000000003', timestamp: new Date('2026-11-19T10:00:00Z'), total: 11500, vat: 1500 });
    expect(decodeTlv(b64)).toEqual({ 1: 'سماط', 2: '300000000000003', 3: '2026-11-19T10:00:00Z', 4: '115.00', 5: '15.00' });
  });
});

describe('ESC/POS raster', () => {
  it('packs 1-bit rows with a GS v 0 header and cuts', () => {
    const w = 16, h = 2;
    const px = new Uint8Array(w * h).fill(255);
    px[0] = 0; px[w + 15] = 0; // first pixel row 0, last pixel row 1
    const bytes = new EscPos().init().raster(px, w, h, 1).cut().bytes();
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...bytes.slice(2, 10)]).toEqual([0x1d, 0x76, 0x30, 0, 2, 0, 2, 0]);
    expect([...bytes.slice(10, 14)]).toEqual([0x80, 0x00, 0x00, 0x01]);
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
});

describe('receipt upload sniffing', () => {
  it('identifies real types and rejects disguised files', () => {
    expect(sniffReceipt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(sniffReceipt(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))?.mime).toBe('image/png');
    expect(sniffReceipt(new TextEncoder().encode('%PDF-1.7'))?.mime).toBe('application/pdf');
    expect(sniffReceipt(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  });
});

describe('Moyasar adapter', () => {
  it('maps statuses', () => {
    expect(mapMoyasarStatus('captured')).toBe('paid');
    expect(mapMoyasarStatus('authorized')).toBe('authorized');
    expect(mapMoyasarStatus('weird')).toBe('unknown');
  });
  it('normalizes a payment without storing the card number', () => {
    const p = normalizeMoyasar({ id: 'pay_1', status: 'paid', amount: 2800, currency: 'SAR', metadata: { order_id: 'o' }, source: { type: 'creditcard', company: 'mada', number: '4201-32XX-XXXX-1234' } });
    expect(p).toMatchObject({ status: 'paid', capturedAmount: 2800, scheme: 'mada', last4: '1234', metadata: { order_id: 'o' } });
    expect(JSON.stringify(p)).not.toContain('4201');
  });
  it('fetches with Basic auth and surfaces API errors', async () => {
    const calls: [string, RequestInit][] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ message: 'Invalid' }), { status: 401 });
    }) as unknown as typeof fetch;
    const g = new MoyasarGateway('sk_test_x', fake);
    await expect(g.capture('pay_1')).rejects.toThrow('Invalid');
    expect(calls[0][0]).toBe('https://api.moyasar.com/v1/payments/pay_1/capture');
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('sk_test_x:').toString('base64')}`);
  });
});

describe('payment simulator', () => {
  it('rejects forged ids', async () => {
    const id = createSimulatedPaymentId({ a: 100, s: 'paid', o: 'o1', r: 'r1', t: 1 });
    await expect(new SimulatorGateway().fetchPayment(id)).resolves.toMatchObject({ status: 'paid', amount: 100 });
    const forged = id.replace(/\.[^.]+$/, '.AAAA');
    await expect(new SimulatorGateway().fetchPayment(forged)).rejects.toThrow();
  });
});

describe('notifications', () => {
  const o: OrderForMessage = {
    id: 'x', order_number: 42, pickup_code: 'K7P4QM', tracking_token: 'tok', customer_name: '<b>Ali</b>', customer_phone: '+966500000000', customer_email: null,
    locale: 'ar', status: 'ready', payment_status: 'paid', subtotal: 2800, discount_total: 0, vat_amount: 365, total: 2800, notes: null, reject_reason: null,
    created_at: new Date().toISOString(), items: [],
  };
  it('uses the agreed Najdi copy', () => {
    expect(customerSms('ready', o, 'https://x/t/tok')).toContain('طلبك جاهز يا هلا، تفضل استلمه من الفرع.');
    expect(customerSms('order_received', o, 'u')).toContain('وصلنا طلبك يا هلا! ننتظر تأكيد المطعم.');
  });
  it('escapes customer-provided text in staff e-mails', () => {
    expect(staffNewOrderEmail(o, 'https://x').html).toContain('&lt;b&gt;Ali&lt;/b&gt;');
  });
});

describe('db error mapping', () => {
  it('maps SAMAT codes and hides internal errors', () => {
    expect(fromDbError({ message: 'SAMAT:out_of_stock', details: '{"items":[]}', code: 'P0001', hint: '', name: 'x' } as never)).toMatchObject({ code: 'out_of_stock', status: 400 });
    expect(fromDbError({ message: 'SAMAT:forbidden', details: '', code: 'P0001', hint: '', name: 'x' } as never).status).toBe(403);
    expect(fromDbError(new Error('connection refused')).code).toBe('unknown');
  });
});
