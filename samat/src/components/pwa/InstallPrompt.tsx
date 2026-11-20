'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { Logo } from '@/components/brand/Logo';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = 'samat_install_dismissed';

/** "Add SAMAT to your home screen": Android/desktop install button, iPhone instructions. */
export function InstallPrompt() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const home = usePathname() === '/';

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = 0;
    try { dismissed = Number(localStorage.getItem(KEY) ?? 0); } catch { /* private mode */ }
    if (standalone || Date.now() - dismissed < 14 * 864e5) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)) {
      setIos(true);
      timer = setTimeout(() => setShow(true), 4000);
    }
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (timer) clearTimeout(timer); };
  }, []);

  if (!show || !home) return null;
  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  return (
    <div className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-50 mx-auto max-w-md" role="dialog" aria-label={t.pwa.title} data-testid="install-prompt">
      <div className="glass-dark flex items-start gap-3 rounded-[1.6rem] p-4 text-cream-100 shadow-lift">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream-100 text-espresso-900"><Logo variant="icon" height={30} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.pwa.title}</p>
          <p className="mt-0.5 text-sm text-cream-200/80">{ios ? t.pwa.ios : t.pwa.text}</p>
          {ios ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-gold-400"><Share className="size-4" /> {t.pwa.iosHint}</p> : (
            <button type="button" className="btn btn-sm btn-cream mt-3" onClick={async () => { if (!evt) return; await evt.prompt(); await evt.userChoice; close(); }}>
              <Download className="size-4" /> {t.pwa.install}
            </button>
          )}
        </div>
        <button type="button" className="p-1 text-cream-200/70" onClick={close} aria-label={t.common.close}><X className="size-5" /></button>
      </div>
    </div>
  );
}
