'use client';
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

export function Countdown({ until, label }: { until: string; label: string }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(until).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  const s = Math.max(0, Math.floor(left / 1000));
  return (
    <div className="text-end" title={label}>
      <p className="flex items-center justify-end gap-1 text-xs text-espresso-500"><Timer className="size-3.5" /> {label}</p>
      <p className={`num text-xl font-bold ${s < 120 ? 'text-danger-500' : ''}`} dir="ltr">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</p>
    </div>
  );
}
