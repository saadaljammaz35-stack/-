import type { Metadata } from 'next';
import SahmCupRailDemo from '@/components/product-rail-gallery-demo';

export const metadata: Metadata = {
  title: 'أكواب سهم',
  description: 'أكواب سهم معلّقة على شماعة: مرّر عليها، اسحبها، واضغط عليها تشوف ظهرها.',
};

/**
 * The demo lives in its own client module because a page may only export the
 * default component and Next's route config; `CUP_ITEMS` would break the
 * build if it were exported from here.
 */
export default function Page(): React.JSX.Element {
  return (
    <main className="w-full">
      <SahmCupRailDemo />
    </main>
  );
}
