import type { CSSProperties, ElementType } from 'react';

/**
 * Splits a heading into words that rise out of a mask when revealed.
 * Words (never letters) are split so Arabic joining stays intact.
 */
export function SplitWords({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
  hero = false,
  id,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  /** Use the CSS hero keyframes instead of the scroll reveal. */
  hero?: boolean;
  id?: string;
}) {
  const words = text.split(' ');
  return (
    <Tag
      id={id}
      className={`${hero ? '' : 'split'} ${className}`}
      style={{ '--d': delay } as CSSProperties}
    >
      {words.map((word, i) => (
        <span key={i}>
          <span className="mask-line">
            <span className={hero ? 'hero-word' : ''} style={{ '--i': i } as CSSProperties}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
