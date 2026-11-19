/** The original SAMAT marks (vector-traced from the brand board), tinted with the current text colour. */
type Variant = 'full' | 'icon' | 'wordmark';
const SRC: Record<Variant, { src: string; ratio: number }> = {
  full: { src: '/brand/samat-logo.svg', ratio: 2240 / 2680 },
  icon: { src: '/brand/samat-icon.svg', ratio: 1265 / 1480 },
  wordmark: { src: '/brand/samat-wordmark.svg', ratio: 2185 / 1140 },
};

export function Logo({ variant = 'full', height = 40, className = '', title = 'SAMAT سماط' }: {
  variant?: Variant; height?: number; className?: string; title?: string;
}) {
  const { src, ratio } = SRC[variant];
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        height,
        width: Math.round(height * ratio),
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
