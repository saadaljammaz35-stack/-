// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from '@/components/ui/RichText';

describe('RichText', () => {
  it('renders the supported markdown subset', () => {
    const { container } = render(
      <RichText text={'## عنوان\n\nفقرة فيها **عريض** و[رابط](https://example.com).\n\n> اقتباس\n\n- أول\n- ثاني'} />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('عنوان');
    expect(container.querySelector('strong')?.textContent).toBe('عريض');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('blockquote')?.textContent).toBe('اقتباس');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('never renders raw HTML or javascript: links', () => {
    const { container } = render(<RichText text={'<script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1))'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });
});
