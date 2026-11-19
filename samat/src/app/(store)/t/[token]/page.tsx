import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { getTrackedOrder } from '@/lib/orders/service';
import { getPublicSettings } from '@/lib/catalog';
import { getLocale } from '@/lib/i18n/server';
import { TrackView, type TrackedOrder } from '@/components/track/TrackView';

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [order, settings, locale] = await Promise.all([getTrackedOrder(token), getPublicSettings(), getLocale()]);
  if (!order) notFound();
  const o = order as unknown as TrackedOrder & { pickup_token: string };
  // The QR holds only an unguessable random token — no name, phone or order details.
  const qrSvg = ['awaiting_approval', 'accepted', 'preparing', 'ready'].includes(o.status)
    ? await QRCode.toString(`SAMAT:${o.pickup_token}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#2f231c', light: '#ffffff' } })
    : null;
  const { pickup_token: _omit, ...safe } = o;
  void _omit;
  return (
    <TrackView token={token} initial={safe} qrSvg={qrSvg}
      branch={{ name: locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en, address: locale === 'ar' ? settings.address_ar : settings.address_en, mapsUrl: settings.maps_url }} />
  );
}
