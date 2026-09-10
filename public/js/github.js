/**
 * Live GitHub section — consumes /api/github/overview (server-cached).
 * States: loading skeleton → content | empty | error + retry.
 * Every external string is rendered via textContent (XSS-safe).
 */

import { qs, qsa, fetchJSON, timeAgo } from './utils.js';

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  Python: '#3572A5', Java: '#b07219', Shell: '#89e051', Go: '#00ADD8', Rust: '#dea584',
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function initGitHub() {
  const loading = qs('#github-loading');
  const content = qs('#github-content');
  const errorBox = qs('#github-error');
  const errorMsg = qs('#github-error-msg');
  const retry = qs('#github-retry');
  const profileBox = qs('#gh-profile');
  const reposBox = qs('#gh-repos');
  const reposEmpty = qs('#gh-repos-empty');
  const activityBox = qs('#gh-activity');
  const activityEmpty = qs('#gh-activity-empty');
  const sourceChip = qs('#github-source');
  const heroNums = qsa('.gh-num');
  if (!loading || !content) return;

  let loaded = false;

  function show(box) {
    loading.hidden = true;
    errorBox.hidden = box !== 'error';
    content.hidden = box !== 'content';
  }

  function renderHero(profile) {
    const stars = (profile._starCount || 0).toLocaleString();
    const map = {
      repos: (profile.public_repos || 0).toLocaleString(),
      stars,
      followers: (profile.followers || 0).toLocaleString(),
    };
    heroNums.forEach((n) => {
      n.textContent = map[n.dataset.gh] ?? '—';
      n.classList.remove('loading');
    });
  }

  function renderProfile(p) {
    profileBox.innerHTML = '';

    const avatar = el('div', 'gh-avatar');
    const img = document.createElement('img');
    img.src = p.avatar_url;
    img.alt = `${p.name} on GitHub`;
    img.width = 84;
    img.height = 84;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    avatar.append(img);

    const id = el('div', 'gh-id');
    const h = el('h3', null, p.name || p.login);
    const login = el('a', 'gh-login', `@${p.login}`);
    login.href = p.html_url;
    login.target = '_blank';
    login.rel = 'noopener noreferrer';
    id.append(h, login);
    if (p.bio) id.append(el('p', 'gh-bio', p.bio));

    const stats = el('div', 'gh-stats');
    const entries = [
      [p.public_repos, 'repos'],
      [p.followers, 'followers'],
      [p.following, 'following'],
    ];
    for (const [val, label] of entries) {
      const s = el('span');
      s.append(el('b', null, String(val ?? 0)), document.createTextNode(label));
      stats.append(s);
    }
    const since = p.created_at ? new Date(p.created_at).getFullYear() : '';
    if (since) {
      const s = el('span');
      s.append(el('b', null, since), document.createTextNode('joined'));
      stats.append(s);
    }

    profileBox.append(avatar, id, stats);
  }

  function renderRepos(repos) {
    reposBox.innerHTML = '';
    reposEmpty.hidden = repos.length > 0;

    for (const r of repos) {
      const card = el('article', 'gh-repo');

      const head = el('div', 'gh-repo-head');
      const link = document.createElement('a');
      link.className = 'gh-repo-name';
      link.href = r.html_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(icon('folder-git-2'), document.createTextNode(r.name));
      head.append(link);
      if (r.homepage) {
        const demo = document.createElement('a');
        demo.className = 'gh-repo-name';
        demo.href = r.homepage;
        demo.target = '_blank';
        demo.rel = 'noopener noreferrer';
        demo.setAttribute('aria-label', `${r.name} live demo`);
        demo.append(icon('external-link'));
        head.append(demo);
      }

      const meta = el('div', 'gh-repo-meta');
      if (r.language) {
        const lang = el('span');
        const dot = el('i', 'lang-dot');
        dot.style.background = LANG_COLORS[r.language] || 'var(--accent)';
        lang.append(dot, document.createTextNode(r.language));
        meta.append(lang);
      }
      const stars = el('span');
      stars.append(icon('star'), document.createTextNode(String(r.stars)));
      const forks = el('span');
      forks.append(icon('git-fork'), document.createTextNode(String(r.forks)));
      const upd = el('span');
      upd.append(icon('clock'), document.createTextNode(r.updated_at ? timeAgo(r.updated_at) : ''));
      meta.append(stars, forks, upd);

      card.append(head);
      if (r.description) card.append(el('p', 'gh-repo-desc', r.description));
      card.append(meta);
      reposBox.append(card);
    }
  }

  function renderActivity(events) {
    activityBox.innerHTML = '';
    activityEmpty.hidden = events.length > 0;

    for (const ev of events) {
      const li = el('li');
      li.append(icon(ev.icon || 'github'));

      const label = el('span', null, `${ev.label} `);
      const repoLink = document.createElement('a');
      repoLink.href = ev.url;
      repoLink.target = '_blank';
      repoLink.rel = 'noopener noreferrer';
      repoLink.textContent = ev.repo;
      label.append(repoLink);

      const time = el('time', null, ev.created_at ? timeAgo(ev.created_at) : '');
      if (ev.created_at) time.dateTime = ev.created_at;

      li.append(label, time);
      activityBox.append(li);
    }
  }

  function renderSource(source) {
    if (!sourceChip) return;
    sourceChip.hidden = false;
    sourceChip.className = `src-chip ${source}`;
    sourceChip.textContent =
      source === 'live' ? 'live' : source === 'cache' ? 'cached' : 'snapshot';
    sourceChip.setAttribute(
      'data-tip',
      source === 'live'
        ? 'Fetched from GitHub just now'
        : 'Served from cache while GitHub is unreachable'
    );
  }

  async function load() {
    loading.hidden = false;
    errorBox.hidden = true;
    try {
      const data = await fetchJSON('/api/github/overview');
      const repos = data.repos || [];
      renderProfile(data.profile);
      renderRepos(repos);
      renderActivity(data.activity || []);
      renderSource(data.source || 'live');
      renderHero({ ...data.profile, _starCount: repos.reduce((acc, r) => acc + (r.stars || 0), 0) });
      show('content');
      loaded = true;
    } catch (err) {
      errorMsg.textContent =
        err.code === 'timeout'
          ? 'GitHub took too long to respond.'
          : 'The API is unreachable right now — it usually recovers within a minute.';
      show('error');
    }
  }

  retry?.addEventListener('click', load);
  load();
  return { load: () => loaded || load() };
}
