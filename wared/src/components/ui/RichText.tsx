import { Fragment, type ReactNode } from 'react';

/*
 * Renders the small Markdown subset used in show notes and articles (paragraphs, ## headings, > quotes,
 * - / 1. lists, **bold**, *italic* and [links](https://…)) as React elements. Raw HTML is never rendered,
 * so editor input cannot inject markup or scripts.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[1] && match[2]) {
      const external = match[2].startsWith('http');
      nodes.push(
        <a key={key} href={match[2]} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(<strong key={key}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={key}>{match[4]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function withBreaks(text: string, key: string): ReactNode[] {
  return text.split('\n').flatMap((line, i, arr) => [
    <Fragment key={`${key}-l${i}`}>{inline(line, `${key}-${i}`)}</Fragment>,
    ...(i < arr.length - 1 ? [<br key={`${key}-br${i}`} />] : []),
  ]);
}

export function RichText({ text, className = 'prose-wared', lang, dir }: { text: string; className?: string; lang?: string; dir?: 'rtl' | 'ltr' }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className} lang={lang} dir={dir}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.startsWith('### ')) return <h3 key={key}>{inline(block.slice(4), key)}</h3>;
        if (block.startsWith('## ')) return <h2 key={key}>{inline(block.slice(3), key)}</h2>;
        if (block.split('\n').every((l) => l.startsWith('>'))) {
          return <blockquote key={key}>{withBreaks(block.split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n'), key)}</blockquote>;
        }
        const lines = block.split('\n');
        if (lines.every((l) => /^[-•]\s+/.test(l))) {
          return (
            <ul key={key}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^[-•]\s+/, ''), `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
          return (
            <ol key={key}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\d+[.)]\s+/, ''), `${key}-${i}`)}</li>
              ))}
            </ol>
          );
        }
        return <p key={key}>{withBreaks(block, key)}</p>;
      })}
    </div>
  );
}
