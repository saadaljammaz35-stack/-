'use client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { browserDb } from '@/lib/supabase/browser';
import { useI18n } from '@/lib/i18n/client';

export function SignOut() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={async () => { await browserDb().auth.signOut(); router.refresh(); }}>
      <LogOut className="size-4" /> {t.account.signOut}
    </button>
  );
}
