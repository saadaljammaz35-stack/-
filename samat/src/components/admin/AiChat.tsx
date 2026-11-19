'use client';
import { useEffect, useRef, useState } from 'react';
import { Bot, Check, Loader2, Send, ShieldAlert, X } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';

interface Pending { id: string; summary_ar: string; summary_en: string; state?: 'confirmed' | 'cancelled' | 'failed' }
interface Msg { role: 'user' | 'assistant'; content: string; tools?: string[]; pending?: Pending[] }

/** Lightweight markdown: bold and bullet lines only (no HTML injection). */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 leading-relaxed">
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line);
        const parts = line.replace(/^\s*[-•*]\s+/, '').split(/(\*\*[^*]+\*\*)/g).map((p, k) =>
          p.startsWith('**') && p.endsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <span key={k}>{p.replace(/^#+\s*/, '')}</span>);
        return line.trim() === '' ? <div key={i} className="h-1" /> : bullet ? <div key={i} className="flex gap-2"><span>•</span><span>{parts}</span></div> : <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

export function AiChat({ configured }: { configured: boolean }) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text.trim() }];
    setMsgs(next); setInput(''); setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === 'ai_not_configured' ? a.ai.notConfigured : t.errors[json.error as keyof typeof t.errors] ?? a.common.error);
      setMsgs([...next, { role: 'assistant', content: json.text || '…', tools: json.tools, pending: json.pending }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : a.common.error);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (mi: number, p: Pending, decision: 'confirm' | 'cancel') => {
    const res = await fetch('/api/admin/ai/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, decision }) });
    const state: Pending['state'] = !res.ok ? 'failed' : decision === 'confirm' ? 'confirmed' : 'cancelled';
    setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, pending: x.pending?.map((y) => (y.id === p.id ? { ...y, state } : y)) } : x)));
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col rounded-[2rem] bg-espresso-900 text-cream-100 shadow-lift" data-testid="ai-chat">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {!configured && <p className="rounded-2xl bg-warn-500/20 p-4 text-sm">{a.ai.notConfigured}</p>}
        {msgs.length === 0 && (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-400/20 text-gold-400"><Bot className="size-7" /></span>
            <p className="mx-auto mt-3 max-w-lg text-sm text-cream-200/70">{a.ai.subtitle}</p>
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {a.ai.suggestions.map((s) => <button key={s} type="button" className="chip bg-cream-100/10 px-4 py-2 hover:bg-cream-100/20" onClick={() => send(s)} disabled={!configured}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-cream-100 text-espresso-900' : 'glass-dark'}`}>
              {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
              {m.pending?.map((p) => (
                <div key={p.id} className="mt-3 rounded-2xl border border-gold-400/50 bg-gold-400/10 p-3" data-testid="ai-pending">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-gold-400"><ShieldAlert className="size-4" /> {a.ai.pending}</p>
                  <p className="mt-1 font-semibold">{locale === 'ar' ? p.summary_ar : p.summary_en}</p>
                  {p.state ? <p className="mt-2 text-xs">{p.state === 'confirmed' ? `✓ ${a.ai.confirmed}` : p.state === 'cancelled' ? a.ai.cancelled : a.common.error}</p> : (
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn btn-sm btn-cream" onClick={() => decide(i, p, 'confirm')} data-testid="ai-confirm"><Check className="size-4" /> {a.ai.confirm}</button>
                      <button type="button" className="btn btn-sm border border-cream-100/20" onClick={() => decide(i, p, 'cancel')}><X className="size-4" /> {a.ai.cancel}</button>
                    </div>
                  )}
                </div>
              ))}
              {m.tools && m.tools.length > 0 && <p className="mt-2 text-[10px] text-cream-200/50" dir="ltr">data: {m.tools.join(', ')}</p>}
            </div>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-sm text-cream-200/70"><Loader2 className="size-4 animate-spin" /> {a.ai.thinking}</p>}
        {error && <p role="alert" className="rounded-2xl bg-danger-500/20 p-3 text-sm">{error}</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-cream-100/10 p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input className="field flex-1 text-espresso-900" value={input} onChange={(e) => setInput(e.target.value)} placeholder={a.ai.placeholder} disabled={!configured || busy} maxLength={4000} data-testid="ai-input" />
        <button className="btn btn-cream" disabled={!configured || busy || !input.trim()}><Send className="size-4" /> {a.ai.send}</button>
      </form>
    </div>
  );
}
