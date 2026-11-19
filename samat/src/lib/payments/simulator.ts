import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { GatewayError, type GatewayPayment, type GatewayStatus, type PaymentGateway } from './types';

// Local test gateway. Stateless: the "payment id" carries the simulated result, signed with a
// server secret so the browser cannot forge one. Refused in production (see env.simulatorAllowed).

type SimPayload = { a: number; s: 'paid' | 'authorized' | 'failed'; o: string; r: string; t: number };

function key(): string {
  return createHmac('sha256', 'samat-simulator').update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev').digest('hex');
}

export function createSimulatedPaymentId(p: SimPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = createHmac('sha256', key()).update(body).digest('base64url');
  return `sim_${body}_${sig}`;
}

function parse(id: string): SimPayload {
  const m = /^sim_([A-Za-z0-9_-]+)_([A-Za-z0-9_-]+)$/.exec(id);
  if (!m) throw new GatewayError('unknown simulated payment', 404);
  const expected = createHmac('sha256', key()).update(m[1]).digest();
  const given = Buffer.from(m[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new GatewayError('bad signature', 400);
  return JSON.parse(Buffer.from(m[1], 'base64url').toString());
}

function toPayment(id: string, p: SimPayload, status: GatewayStatus = p.s): GatewayPayment {
  return {
    id, status, amount: p.a, currency: 'SAR',
    capturedAmount: status === 'paid' ? p.a : 0,
    refundedAmount: status === 'refunded' ? p.a : 0,
    method: 'creditcard', scheme: 'mada', last4: '0000',
    message: status === 'failed' ? 'Simulated decline' : null, live: false,
    metadata: { order_id: p.o, payment_row_id: p.r },
  };
}

export class SimulatorGateway implements PaymentGateway {
  readonly name = 'simulator' as const;
  async fetchPayment(id: string) { return toPayment(id, parse(id)); }
  async capture(id: string) {
    const p = parse(id);
    if (p.s !== 'authorized') throw new GatewayError('payment is not authorized');
    return toPayment(id, p, 'paid');
  }
  async void(id: string) { return toPayment(id, parse(id), 'voided'); }
  async refund(id: string) { return toPayment(id, parse(id), 'refunded'); }
}
