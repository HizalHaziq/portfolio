/**
 * Theme system — dark / light / system.
 * Persisted in localStorage ('theme'), applied pre-paint by the inline
 * bootstrap script in <head>; this module manages the UI + live changes.
 */

import { qs, qsa } from './utils.js';

const KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return ['light', 'dark', 'system'].includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-theme-pref', pref);
  qsa('[data-theme-choice]').forEach((btn) => {
    const on = btn.dataset.themeChoice === pref;
    btn.setAttribute('aria-checked', String(on));
    btn.tabIndex = on ? 0 : -1;
  });
  const sw = qs('#theme-switch');
  if (sw) sw.dataset.active = pref;
}

export function initTheme() {
  let pref = stored();
  apply(pref);

  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', () => {
    if (stored() === 'system') apply('system');
  });

  const sw = qs('#theme-switch');
  if (sw) {
    sw.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-theme-choice]');
      if (!choice) return;
      pref = choice.dataset.themeChoice;
      try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
      apply(pref);
    });

    // Roving tabindex + arrow keys inside the radiogroup.
    sw.addEventListener('keydown', (e) => {
      const order = ['light', 'system', 'dark'];
      const i = order.indexOf(stored());
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = order[(i + 1) % 3];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = order[(i + 2) % 3];
      if (next) {
        e.preventDefault();
        pref = next;
        try { localStorage.setItem(KEY, next); } catch { /* noop */ }
        apply(next);
        qs(`[data-theme-choice="${next}"]`)?.focus();
      }
    });
  }

  return {
    get: () => stored(),
    set(next) {
      pref = next;
      try { localStorage.setItem(KEY, next); } catch { /* noop */ }
      apply(next);
    },
    cycleDarkLight() {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    },
  };
}
