import type { ClaimKind } from '../services/claim';

/**
 * The typed shape of every route's parameters. Expo Router hands params over as
 * strings, so each screen parses them through the helpers below rather than
 * trusting the URL.
 */
export type ReceiptRouteParams = { id: string };

export type ClaimRouteParams = { id: string; kind: ClaimKind };

/** `/receipt/form` with no id means "new receipt". */
export type ReceiptFormRouteParams = { id?: string };

const CLAIM_KINDS: ClaimKind[] = ['warranty', 'return', 'exchange'];

export function asClaimKind(value: unknown): ClaimKind {
  return typeof value === 'string' && (CLAIM_KINDS as string[]).includes(value)
    ? (value as ClaimKind)
    : 'warranty';
}

export function asId(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
