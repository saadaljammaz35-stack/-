import { Check } from 'lucide-react';

/** Digital stamp card: one stamp per picked-up order; a full card gives bonus points. */
export function StampCard({ stamps, target, reward, title, text }: { stamps: number; target: number; reward: number; title: string; text: string }) {
  return (
    <section className="paper rounded-[2rem] p-5" data-testid="stamp-card">
      <p className="font-bold">{title}</p>
      <p className="mt-0.5 text-sm text-espresso-600">{text}</p>
      <ol className="mt-4 flex flex-wrap gap-2" aria-label={`${stamps} / ${target}`}>
        {Array.from({ length: target }, (_, i) => (
          <li key={i} className={`grid size-10 place-items-center rounded-full border-2 ${i < stamps ? 'border-terracotta-500 bg-terracotta-500 text-white' : i === target - 1 ? 'border-dashed border-gold-400 text-gold-500' : 'border-sand-300 text-espresso-300'}`}>
            {i < stamps ? <Check className="size-5" /> : i === target - 1 ? <span className="num text-xs font-bold">+{reward}</span> : <span className="num text-xs">{i + 1}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
