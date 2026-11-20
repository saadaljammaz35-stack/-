/** Simple bilingual legal page (privacy / terms) in the store's paper style. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { h: string; p: string[] }[] }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-espresso-500">{updated}</p>
      <div className="paper mt-6 space-y-6 rounded-[2rem] p-6 sm:p-8">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.p.map((x) => <p key={x} className="mt-2 leading-relaxed text-espresso-700">{x}</p>)}
          </section>
        ))}
      </div>
    </article>
  );
}
