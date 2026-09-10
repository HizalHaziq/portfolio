'use strict';

/**
 * GitHub service — server-side proxy for the GitHub REST API.
 *
 * Design:
 *  - Memory cache (hot) + disk cache (survives restarts) with a TTL.
 *  - On upstream failure / rate limit, serves STALE cache; if that is also
 *    empty, serves the bundled snapshot so the UI never dead-ends.
 *  - Optional GITHUB_TOKEN raises rate limits; it never leaves the server.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'github-snapshot.json');

const memory = { data: null, fetchedAt: 0, inflight: null };

function readDiskCache() {
  try {
    const raw = fs.readFileSync(path.join(config.cacheDir, 'github-cache.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed.payload ? parsed : null;
  } catch {
    return null;
  }
}

function writeDiskCache(payload) {
  try {
    fs.mkdirSync(config.cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(config.cacheDir, 'github-cache.json'),
      JSON.stringify({ payload, savedAt: new Date().toISOString() })
    );
  } catch {
    /* non-fatal */
  }
}

async function fetchJson(url) {
  const headers = {
    'User-Agent': `${config.github.username}-portfolio`,
    Accept: 'application/vnd.github+json',
  };
  if (config.github.token) headers.Authorization = `Bearer ${config.github.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.github.timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const err = new Error('GitHub rate limit reached');
      err.code = 'RATE_LIMITED';
      throw err;
    }
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapRepo(r) {
  return {
    name: r.name,
    description: r.description || '',
    language: r.language || '',
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    updated_at: r.updated_at,
    pushed_at: r.pushed_at,
    html_url: r.html_url,
    homepage: r.homepage || '',
    topics: r.topics || [],
  };
}

function mapEvent(e) {
  const kinds = {
    PushEvent: { label: 'Pushed to', icon: 'git-branch' },
    CreateEvent: { label: 'Created', icon: 'folder-git-2' },
    WatchEvent: { label: 'Starred', icon: 'star' },
    ForkEvent: { label: 'Forked', icon: 'git-fork' },
    PullRequestEvent: { label: 'Pull request', icon: 'git-fork' },
    IssuesEvent: { label: 'Issue', icon: 'message-square' },
    PublicEvent: { label: 'Made public', icon: 'github' },
    ReleaseEvent: { label: 'Released', icon: 'rocket' },
  };
  const kind = kinds[e.type] || { label: 'Activity', icon: 'github' };
  return {
    type: e.type,
    label: kind.label,
    icon: kind.icon,
    repo: e.repo ? e.repo.name.replace(`${config.github.username}/`, '') : '',
    url: e.repo ? `https://github.com/${e.repo.name}` : '',
    created_at: e.created_at,
  };
}

async function loadFresh() {
  const base = `https://api.github.com/users/${config.github.username}`;
  const [user, repos, events] = await Promise.all([
    fetchJson(base),
    fetchJson(`${base}/repos?per_page=100&sort=updated`).then((list) =>
      Promise.all(
        (Array.isArray(list) ? list : [])
          .filter((r) => !r.fork)
          // Hide this portfolio's own repo from the showcase list.
          .filter((r) => !['portfolio', 'My-Alternate-Portfolio-Website'].includes(r.name))
          .slice(0, 12)
          .map(async (r) => {
            // Pull languages per repo (bounded: only for first 12 own repos).
            try {
              const langs = await fetchJson(r.languages_url);
              return { ...mapRepo(r), languages: Object.keys(langs).slice(0, 6) };
            } catch {
              return { ...mapRepo(r), languages: r.language ? [r.language] : [] };
            }
          })
      )
    ),
    fetchJson(`${base}/events/public?per_page=30`).then((list) =>
      (Array.isArray(list) ? list : []).slice(0, 8).map(mapEvent)
    ),
  ]);

  return {
    source: 'live',
    fetchedAt: new Date().toISOString(),
    profile: {
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      bio: user.bio || '',
      followers: user.followers ?? 0,
      following: user.following ?? 0,
      public_repos: user.public_repos ?? 0,
      html_url: user.html_url,
      created_at: user.created_at,
      location: user.location || '',
    },
    repos,
    activity: events,
  };
}

function loadSnapshot() {
  try {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    return { ...snap, source: 'snapshot' };
  } catch {
    return null;
  }
}

async function getOverview() {
  const { ttlMs } = config.github;

  if (memory.data && Date.now() - memory.fetchedAt < ttlMs) {
    return { ...memory.data, cached: true };
  }

  if (!memory.inflight) {
    memory.inflight = loadFresh()
      .then((payload) => {
        memory.data = payload;
        memory.fetchedAt = Date.now();
        writeDiskCache(payload);
        return payload;
      })
      .catch(async (err) => {
        const disk = readDiskCache();
        if (disk) return { ...disk.payload, source: 'cache', stale: true };
        const snapshot = loadSnapshot();
        if (snapshot) return snapshot;
        throw err;
      })
      .finally(() => {
        memory.inflight = null;
      });
  }
  return memory.inflight;
}

module.exports = { getOverview };
