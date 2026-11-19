export type GatewayStatus = 'initiated' | 'authorized' | 'paid' | 'failed' | 'voided' | 'refunded' | 'unknown';

export interface GatewayPayment {
  id: string;
  status: GatewayStatus;
  amount: number;          // halalas
  currency: string;
  capturedAmount: number;
  refundedAmount: number;
  method: string | null;   // creditcard / applepay / stcpay
  scheme: string | null;   // mada / visa / mastercard
  last4: string | null;
  message: string | null;
  live: boolean | null;
  metadata: Record<string, string>;
}

export interface PaymentGateway {
  readonly name: 'moyasar' | 'simulator';
  fetchPayment(id: string): Promise<GatewayPayment>;
  capture(id: string, amount?: number): Promise<GatewayPayment>;
  void(id: string): Promise<GatewayPayment>;
  refund(id: string, amount?: number): Promise<GatewayPayment>;
}

export class GatewayError extends Error {
  constructor(message: string, public httpStatus?: number) {
    super(message);
  }
}
