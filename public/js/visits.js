/**
 * Privacy-friendly visitor counter — one GET per page load.
 * The server stores only daily salted hashes; no cookies, no fingerprints.
 */

import { qs, fetchJSON } from './utils.js';

export function initVisits() {
  const box = qs('#visit-counter');
  const totalEl = qs('#visit-total');
  const todayEl = qs('#visit-today');
  if (!box) return;

  fetchJSON('/api/visits', {}, 8000)
    .then((stats) => {
      if (stats.unavailable) return;
      totalEl.textContent = (stats.total ?? 0).toLocaleString();
      todayEl.textContent = (stats.today ?? 0).toLocaleString();
      box.hidden = false;
    })
    .catch(() => {
      /* counter stays hidden — never a broken UI for a nice-to-have */
    });
}
