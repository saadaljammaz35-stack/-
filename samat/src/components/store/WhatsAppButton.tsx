'use client';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/client';

/** Floating "chat with the branch on WhatsApp" button (hidden on pages with a bottom action bar). */
export function WhatsAppButton({ number }: { number: string }) {
  const { t } = useI18n();
  const path = usePathname();
  if (/^\/(p|cart|checkout|pay)(\/|$)/.test(path)) return null;
  const href = `https://wa.me/${number.replace(/^\+/, '')}?text=${encodeURIComponent(t.common.whatsappHello)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t.common.whatsapp} data-testid="whatsapp"
      className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] end-4 z-40 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition-transform hover:scale-105 active:scale-95">
      <svg viewBox="0 0 32 32" className="size-7" fill="currentColor" aria-hidden>
        <path d="M16.04 3C9.4 3 4 8.33 4 14.9c0 2.1.56 4.15 1.62 5.95L4 29l8.4-2.2a12.2 12.2 0 0 0 3.64.56C22.68 27.36 28 22.03 28 15.46 28 8.88 22.68 3 16.04 3Zm0 22.2c-1.12 0-2.24-.18-3.3-.55l-.24-.08-4.98 1.3 1.33-4.8-.16-.25a9.9 9.9 0 0 1-1.56-5.34c0-5.43 4.5-9.85 10.02-9.85 5.5 0 9.9 4.42 9.9 9.85 0 5.43-4.48 9.72-9.99 9.72Zm5.48-7.37c-.3-.15-1.78-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.46-2.42-1.48-.9-.79-1.5-1.77-1.67-2.07-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.49-.5-.67-.5h-.58c-.2 0-.52.08-.8.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.1 3.17 5.08 4.45.71.3 1.27.49 1.7.62.71.22 1.36.19 1.88.12.57-.09 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
      </svg>
    </a>
  );
}
