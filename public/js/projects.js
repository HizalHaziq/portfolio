/**
 * Dynamic project search & filtering.
 * All content comes from the server-injected payload (single source of truth).
 * Rendering uses DOM APIs + textContent only — no HTML injection surface.
 */

import { qs, qsa, debounce } from './utils.js';

export function initProjects(projects) {
  const grid = qs('#projects-grid');
  const search = qs('#project-search');
  const clearBtn = qs('#search-clear');
  const techSelect = qs('#tech-filter');
  const resetBtn = qs('#filters-reset');
  const chips = qsa('#category-chips .chip-filter');
  const activeWrap = qs('#active-filters');
  const countEl = qs('#result-count');
  const emptyState = qs('#projects-empty');
  if (!grid || !search) return;

  const cards = qsa('.project-card', grid);

  const state = { query: '', category: 'all', tech: '' };

  const match = (p, card) => {
    if (state.category === 'featured' && !p.featured) return false;
    if (state.category !== 'all' && state.category !== 'featured' && p.category !== state.category) return false;
    if (state.tech && !p.technologies.some((t) => t.toLowerCase() === state.tech.toLowerCase())) return false;
    if (state.query) {
      const hay = [p.title, p.description, p.category, p.longDescription || '', ...p.technologies]
        .join(' ')
        .toLowerCase();
      if (!state.query.toLowerCase().split(/\s+/).every((term) => hay.includes(term))) return false;
    }
    return true;
  };

  function render() {
    let shown = 0;
    cards.forEach((card, i) => {
      const ok = match(projects[i], card);
      card.classList.toggle('is-hidden-by-filter', !ok);
      card.style.display = ok ? '' : 'none';
      if (ok) shown += 1;
    });

    grid.hidden = shown === 0;
    emptyState.hidden = shown !== 0;

    clearBtn.hidden = !state.query;
    resetBtn.hidden = state.category === 'all' && !state.tech && !state.query;

    /* active filter pills */
    activeWrap.innerHTML = '';
    const pills = [];
    if (state.query) pills.push({ kind: 'query', label: `“${state.query}”` });
    if (state.category !== 'all') pills.push({ kind: 'category', label: state.category });
    if (state.tech) pills.push({ kind: 'tech', label: state.tech });

    for (const pill of pills) {
      const chip = document.createElement('span');
      chip.className = 'active-filter';
      const label = document.createElement('span');
      label.textContent = pill.label;
      const x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('aria-label', `Remove filter ${pill.label}`);
      x.textContent = '✕';
      x.addEventListener('click', () => {
        if (pill.kind === 'query') {
          state.query = '';
          search.value = '';
        } else if (pill.kind === 'category') {
          state.category = 'all';
        } else {
          state.tech = '';
          techSelect.value = '';
        }
        syncChips();
        render();
      });
      chip.append(label, x);
      activeWrap.append(chip);
    }
    activeWrap.hidden = pills.length === 0;

    const total = projects.length;
    countEl.textContent =
      shown === total ? `Showing all ${total} projects` : `Showing ${shown} of ${total} projects`;
  }

  function syncChips() {
    chips.forEach((c) => {
      const on = c.dataset.category === state.category;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', String(on));
    });
  }

  search.addEventListener(
    'input',
    debounce(() => {
      state.query = search.value.trim();
      render();
    }, 140)
  );

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      search.value = '';
      state.query = '';
      render();
    }
  });

  clearBtn.addEventListener('click', () => {
    search.value = '';
    state.query = '';
    render();
    search.focus();
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.category = chip.dataset.category;
      syncChips();
      render();
    });
  });

  techSelect.addEventListener('change', () => {
    state.tech = techSelect.value;
    render();
  });

  const resetAll = () => {
    state.query = '';
    state.category = 'all';
    state.tech = '';
    search.value = '';
    techSelect.value = '';
    syncChips();
    render();
    search.focus();
  };

  resetBtn.addEventListener('click', resetAll);
  qs('#projects-empty-reset')?.addEventListener('click', resetAll);

  render();
}
