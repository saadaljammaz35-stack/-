'use client';
import { Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

export function PrintButton() {
  const { locale } = useI18n();
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer className="size-4" /> {locale === 'ar' ? 'طباعة / حفظ PDF' : 'Print / save PDF'}</button>;
}
