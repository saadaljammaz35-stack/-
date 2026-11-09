'use client';

import { useEffect } from 'react';

const SELECTOR = '.reveal, .split, .ink-draw, .ink-rule';

/**
 * One IntersectionObserver for the whole site. Elements opt in with the
 * `reveal`, `split` or `ink-draw` class (see globals.css) and receive
 * `is-in` once they scroll into view. Works for server components and for
 * content added later (route changes, dialogs) through a MutationObserver.
 */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    const observe = (root: ParentNode) => {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.classList.contains('is-in')) io.observe(el);
      });
    };
    observe(document);

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR) && !node.classList.contains('is-in')) io.observe(node);
          observe(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
