/**
 * Command palette — Ctrl/Cmd+K.
 * Groups: Navigate · Theme · Actions · Social.
 * Keyboard: ↑ ↓ navigate, Enter select, Esc close, Home/End jump, type-to-filter.
 * Matching: case-insensitive subsequence + word starts get ranked higher.
 */

import { qs, qsa } from './utils.js';

export function initPalette({ theme, sections, socials, contactEmail }) {
  const overlay = qs('#palette-overlay');
  const dialog = qs('#palette');
  const input = qs('#palette-input');
  const list = qs('#palette-list');
  if (!overlay || !input || !list) return;

  const openBtn = qs('#palette-trigger');
  let commands = [];
  let filtered = [];
  let selected = 0;
  let lastFocus = null;

  /* ------------------------------ command registry ------------------------------ */

  function buildCommands() {
    const nav = sections
      .map((id) => {
        const link = document.querySelector(`[data-nav][href="#${id}"] span`);
        return {
          id: `nav-${id}`,
          group: 'Navigate',
          icon: 'home',
          label: link ? link.textContent.trim() : id,
          keywords: `go to ${id} section jump`,
          hint: '',
          run: () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }),
        };
      });

    const actions = [
      {
        id: 'theme-toggle',
        group: 'Theme',
        icon: 'sun',
        label: 'Toggle dark / light mode',
        keywords: 'dark light mode theme toggle switch',
        hint: '',
        run: () => theme.cycleDarkLight(),
      },
      {
        id: 'theme-dark',
        group: 'Theme',
        icon: 'moon',
        label: 'Use dark mode',
        keywords: 'dark theme night',
        run: () => theme.set('dark'),
      },
      {
        id: 'theme-light',
        group: 'Theme',
        icon: 'sun',
        label: 'Use light mode',
        keywords: 'light theme day bright',
        run: () => theme.set('light'),
      },
      {
        id: 'theme-system',
        group: 'Theme',
        icon: 'monitor',
        label: 'Use system theme',
        keywords: 'system theme auto',
        run: () => theme.set('system'),
      },
      {
        id: 'resume',
        group: 'Actions',
        icon: 'file-text',
        label: 'Download résumé',
        keywords: 'resume cv download print pdf',
        hint: '/resume',
        run: () => window.open('/resume', '_blank', 'noopener'),
      },
      {
        id: 'top',
        group: 'Actions',
        icon: 'arrow-up',
        label: 'Scroll to top',
        keywords: 'top start beginning home up',
        run: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
      ...(contactEmail
        ? [
            {
              id: 'copy-email',
              group: 'Actions',
              icon: 'mail',
              label: `Copy email (${contactEmail})`,
              keywords: 'email copy contact address',
              run: async () => {
                try {
                  await navigator.clipboard.writeText(contactEmail);
                  return 'Email copied to clipboard';
                } catch {
                  window.location.href = `mailto:${contactEmail}`;
                  return 'Opened mail client';
                }
              },
            },
          ]
        : []),
      {
        id: 'source',
        group: 'Actions',
        icon: 'github',
        label: 'View site source code',
        keywords: 'source code github repo open',
        run: () => window.open(`${socials.github}/portfolio`, '_blank', 'noopener'),
      },
    ];

    const socialCmds = [];
    if (socials.github) {
      socialCmds.push({
        id: 'open-github',
        group: 'Social',
        icon: 'github',
        label: 'Open GitHub profile',
        keywords: 'github profile open code repos',
        run: () => window.open(socials.github, '_blank', 'noopener'),
      });
    }
    if (socials.linkedin) {
      socialCmds.push({
        id: 'open-linkedin',
        group: 'Social',
        icon: 'linkedin',
        label: 'Open LinkedIn profile',
        keywords: 'linkedin profile open network',
        run: () => window.open(socials.linkedin, '_blank', 'noopener'),
      });
    }

    commands = [...nav, ...actions, ...socialCmds];
  }

  /* --------------------------------- rendering --------------------------------- */

  function score(cmd, query) {
    const label = cmd.label.toLowerCase();
    const hay = `${label} ${cmd.keywords || ''} ${cmd.id}`.toLowerCase();
    if (!query) return 1;
    if (label.startsWith(query)) return 100;
    if (label.includes(query)) return 60;
    if (hay.includes(query)) return 40;
    // subsequence match (e.g. "ghp" → "Open GitHub profile")
    let i = 0;
    for (const ch of hay) if (ch === query[i]) i += 1;
    return i === query.length ? 10 : 0;
  }

  function render() {
    const query = input.value.trim().toLowerCase();
    filtered = commands
      .map((c) => ({ c, s: score(c, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);

    list.innerHTML = '';

    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'palette-no-results';
      li.id = 'palette-no-results';
      li.textContent = `No commands match “${input.value.trim()}”`;
      list.append(li);
      input.setAttribute('aria-activedescendant', 'palette-no-results');
      return;
    }

    selected = Math.min(selected, filtered.length - 1);
    let lastGroup = null;

    filtered.forEach((cmd, i) => {
      if (cmd.group !== lastGroup) {
        lastGroup = cmd.group;
        const group = document.createElement('li');
        group.className = 'palette-group';
        group.textContent = cmd.group;
        group.setAttribute('role', 'presentation');
        list.append(group);
      }

      const li = document.createElement('li');
      li.className = 'palette-item' + (i === selected ? ' is-selected' : '');
      li.id = `cmd-${cmd.id}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === selected));

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'ic');
      icon.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `#i-${cmd.icon}`);
      icon.append(use);

      const label = document.createElement('span');
      label.textContent = cmd.label;

      li.append(icon, label);

      if (cmd.hint) {
        const hint = document.createElement('span');
        hint.className = 'palette-hint kbd';
        hint.textContent = cmd.hint;
        li.append(hint);
      }

      li.addEventListener('click', () => execute(i));
      li.addEventListener('mousemove', () => {
        if (selected !== i) {
          selected = i;
          paintSelection();
        }
      });
      list.append(li);
    });

    paintSelection();
  }

  function paintSelection() {
    qsaList().forEach((el, i) => {
      el.classList.toggle('is-selected', i === selected);
      el.setAttribute('aria-selected', String(i === selected));
      if (i === selected) {
        el.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', el.id || '');
      }
    });
  }

  const qsaList = () => [...list.querySelectorAll('.palette-item')];

  /* ---------------------------------- behaviour --------------------------------- */

  async function execute(index) {
    const cmd = filtered[index];
    close();
    if (!cmd) return;
    const message = await cmd.run();
    if (message && window.__toast) window.__toast(message);
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    overlay.classList.remove('closing');
    document.body.style.overflow = 'hidden';
    input.value = '';
    selected = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    overlay.classList.add('closing');
    document.body.style.overflow = '';
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove('closing');
    }, 140);
    lastFocus?.focus?.();
  }

  const isOpen = () => !overlay.hidden;

  /* ----------------------------------- events ----------------------------------- */

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (!isOpen()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = (selected + 1) % filtered.length;
      paintSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = (selected - 1 + filtered.length) % filtered.length;
      paintSelection();
    } else if (e.key === 'Home' && filtered.length) {
      e.preventDefault();
      selected = 0;
      paintSelection();
    } else if (e.key === 'End' && filtered.length) {
      e.preventDefault();
      selected = filtered.length - 1;
      paintSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(selected);
    }
  });

  input.addEventListener('input', () => {
    selected = 0;
    render();
  });

  overlay.addEventListener('mousedown', (e) => {
    if (!dialog.contains(e.target)) close();
  });

  openBtn?.addEventListener('click', open);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-palette-open]')) open();
  });

  buildCommands();

  // platform-aware shortcut hint (Ctrl K vs ⌘K)
  const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
  qsa('.palette-trigger .kbd').forEach((k) => {
    k.textContent = isMac ? '⌘ K' : 'Ctrl K';
  });

  return { open, close };
}
