/**
 * Hero typing effect — respects prefers-reduced-motion (renders statically).
 */

import { prefersReducedMotion } from './utils.js';

export function initTyped() {
  const el = document.getElementById('typed');
  if (!el) return;

  const roles = (el.dataset.roles || '').split('|').filter(Boolean);
  if (!roles.length || prefersReducedMotion()) {
    el.textContent = el.dataset.reducedText || roles[0] || '';
    return;
  }

  let role = 0;
  let chars = roles[0].length; // start fully typed, then erase
  let phase = 'hold';
  let holdUntil = performance.now() + 1800;

  function tick(now) {
    const word = roles[role];

    if (phase === 'hold') {
      if (now >= holdUntil) phase = 'erase';
    } else if (phase === 'erase') {
      chars -= 1;
      el.textContent = word.slice(0, Math.max(0, chars));
      if (chars <= 0) {
        phase = 'type';
        role = (role + 1) % roles.length;
        requestAnimationFrame(tick);
        return;
      }
      setTimeout(() => requestAnimationFrame(tick), 32);
      return;
    } else if (phase === 'type') {
      const next = roles[role];
      chars += 1;
      el.textContent = next.slice(0, chars);
      if (chars >= next.length) {
        phase = 'hold';
        holdUntil = now + 2400;
        requestAnimationFrame(tick);
        return;
      }
      setTimeout(() => requestAnimationFrame(tick), 62);
      return;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
