import type { LegalDoc } from '@/content/legal';
import { PageHeader } from './blocks';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHeader title={doc.title} intro={doc.intro}>
        <p className="mt-6 text-sm text-muted">{doc.updated}</p>
      </PageHeader>
      <div className="container-page">
        <div className="max-w-3xl space-y-12 border-t border-line pt-12">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-4 text-2xl font-bold">{section.heading}</h2>
              {section.body.split('\n\n').map((p, i) => (
                <p key={i} className="mt-3 text-lg leading-9 text-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
