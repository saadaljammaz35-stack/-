import 'server-only';
import { GatewayError, type GatewayPayment, type GatewayStatus, type PaymentGateway } from './types';

const API = 'https://api.moyasar.com/v1';

type MoyasarPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  captured?: number;
  refunded?: number;
  metadata?: Record<string, string> | null;
  source?: { type?: string; company?: string; number?: string; message?: string | null } | null;
  live?: boolean;
};

export function mapMoyasarStatus(s: string): GatewayStatus {
  switch (s) {
    case 'paid':
    case 'captured':
      return 'paid';
    case 'authorized':
      return 'authorized';
    case 'failed':
      return 'failed';
    case 'voided':
      return 'voided';
    case 'refunded':
      return 'refunded';
    case 'initiated':
      return 'initiated';
    default:
      return 'unknown';
  }
}

export function normalizeMoyasar(p: MoyasarPayment): GatewayPayment {
  const company = p.source?.company?.toLowerCase() ?? null;
  const digits = p.source?.number?.replace(/\D/g, '') ?? '';
  return {
    id: p.id,
    status: mapMoyasarStatus(p.status),
    amount: p.amount,
    currency: p.currency,
    capturedAmount: p.captured ?? (p.status === 'paid' ? p.amount : 0),
    refundedAmount: p.refunded ?? 0,
    method: p.source?.type ?? null,
    scheme: company === 'master' ? 'mastercard' : company,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    message: p.source?.message ?? null,
    live: typeof p.live === 'boolean' ? p.live : null,
    metadata: p.metadata ?? {},
  };
}

export class MoyasarGateway implements PaymentGateway {
  readonly name = 'moyasar' as const;

  constructor(private secretKey: string, private fetchImpl: typeof fetch = fetch) {
    if (!secretKey) throw new GatewayError('MOYASAR_SECRET_KEY is not set');
  }

  private async call(path: string, init?: { method?: string; body?: unknown }): Promise<GatewayPayment> {
    if (!/^[A-Za-z0-9_-]+$/.test(path.split('/')[2] ?? 'x')) throw new GatewayError('invalid payment id');
    const res = await this.fetchImpl(`${API}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as MoyasarPayment & { message?: string };
    if (!res.ok) throw new GatewayError(json.message ?? `Moyasar HTTP ${res.status}`, res.status);
    return normalizeMoyasar(json);
  }

  fetchPayment(id: string) {
    return this.call(`/payments/${id}`);
  }
  capture(id: string, amount?: number) {
    return this.call(`/payments/${id}/capture`, { method: 'POST', body: amount ? { amount } : undefined });
  }
  void(id: string) {
    return this.call(`/payments/${id}/void`, { method: 'POST' });
  }
  refund(id: string, amount?: number) {
    return this.call(`/payments/${id}/refund`, { method: 'POST', body: amount ? { amount } : undefined });
  }
}
