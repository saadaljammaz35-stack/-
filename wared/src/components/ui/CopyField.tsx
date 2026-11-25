'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function CopyField({ value }: { value: string }) {
  const { dict } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-full border border-line-strong ps-5">
      <code className="min-w-0 flex-1 truncate text-sm" dir="ltr">
        {value}
      </code>
      <button
        type="button"
        className="btn btn-primary min-h-11 shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked; the URL stays selectable.
          }
        }}
      >
        <span aria-live="polite">{copied ? dict.common.copied : 'RSS'}</span>
      </button>
    </div>
  );
}
