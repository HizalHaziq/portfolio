/**
 * Scroll-reveal animations via IntersectionObserver.
 * With prefers-reduced-motion, CSS already disables the animation —
 * this module simply marks everything visible.
 */

import { qsa, prefersReducedMotion } from './utils.js';

export function initReveal() {
  const items = qsa('.reveal');
  if (!items.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }

  const IO = window.IntersectionObserver;
  const observer = new IO(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );

  items.forEach((el) => observer.observe(el));
}
