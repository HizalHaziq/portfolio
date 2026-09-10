/**
 * Navigation — sticky header state, active-section highlighting (IO),
 * mobile menu, smooth anchor handling, back-to-top.
 */

import { qs, qsa } from './utils.js';

export function initNav(sections) {
  const header = qs('#site-header');
  const toggle = qs('#menu-toggle');
  const mobileNav = qs('#mobile-nav');

  /* header border once scrolled */
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* active section indicator */
  const links = qsa('[data-section]');
  const byId = new Map(links.map((l) => [l.dataset.section, l]));

  if ('IntersectionObserver' in window && sections.length) {
    const IO = window.IntersectionObserver;
    const visible = new Map();
    const observer = new IO(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = null;
        let bestRatio = 0;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) {
          links.forEach((l) => l.classList.toggle('is-active', l.dataset.section === best));
          const current = byId.get(best);
          if (current && current.closest('.main-nav')) current.setAttribute('aria-current', 'true');
          links.forEach((l) => {
            if (l !== current) l.removeAttribute('aria-current');
          });
        }
      },
      { rootMargin: '-25% 0px -45% 0px', threshold: [0, 0.15, 0.4, 0.75] }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  /* mobile menu */
  const setMenu = (open) => {
    if (!toggle || !mobileNav) return;
    mobileNav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle?.addEventListener('click', () => {
    setMenu(mobileNav.hidden);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav && !mobileNav.hidden) {
      setMenu(false);
      toggle?.focus();
    }
  });

  /* close mobile menu when navigating + handle data-nav clicks */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav && mobileNav && !mobileNav.hidden) setMenu(false);
  });

  /* back to top */
  qs('#to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
