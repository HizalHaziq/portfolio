/**
 * Interactive timeline — scroll progress line + active milestone highlight.
 */

import { qs, qsa, prefersReducedMotion } from './utils.js';

export function initTimeline() {
  const wrap = qs('#timeline');
  const bar = qs('#timeline-progress-bar');
  const items = qsa('.tl-item');
  if (!wrap || !items.length) return;

  /* progress line */
  const onScroll = () => {
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height;
    const passed = Math.min(Math.max(vh * 0.55 - rect.top, 0), total);
    if (bar) bar.style.height = `${(passed / total) * 100}%`;
  };
  if (!prefersReducedMotion()) {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (bar) {
    bar.style.height = '100%';
  }

  /* active milestone: the item nearest the viewport centre */
  if ('IntersectionObserver' in window) {
    const IO = window.IntersectionObserver;
    const observer = new IO(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-active', entry.isIntersecting);
        }
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: 0 }
    );
    items.forEach((el) => observer.observe(el));
  }
}
