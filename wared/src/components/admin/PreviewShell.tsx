import type { ReactNode } from 'react';
import { I18nProvider } from '@/components/I18nProvider';
import { PlayerBar } from '@/components/player/PlayerBar';
import { PlayerProvider } from '@/components/player/PlayerProvider';
import { getDictionary } from '@/lib/i18n';

/** Wraps a preview in the same client providers as the public site, with a clear "preview" banner. */
export function PreviewShell({ status, children }: { status: string; children: ReactNode }) {
  return (
    <I18nProvider locale="ar" dict={getDictionary('ar')}>
      <PlayerProvider>
        <div className="-mx-4 mb-10 bg-sand px-4 py-2.5 text-center text-sm font-medium text-ink sm:-mx-6 lg:-mx-12">
          معاينة — الحالة: {status}. هذه الصفحة لا تظهر للجمهور قبل النشر.
        </div>
        {children}
        <PlayerBar />
      </PlayerProvider>
    </I18nProvider>
  );
}
