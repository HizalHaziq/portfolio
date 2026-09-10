/**
 * Skills category filter — shows/hides cards without re-rendering.
 */

import { qs, qsa } from './utils.js';

export function initSkills() {
  const buttons = qsa('[data-skill-filter]');
  const cards = qsa('#skills-grid .skill-card');
  const empty = qs('#skills-empty');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.skillFilter;
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });

      let shown = 0;
      cards.forEach((card) => {
        const ok = cat === 'all' || card.dataset.category === cat;
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown += 1;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  });

  // activate "All" state visually
  buttons[0]?.classList.add('is-active');
}
