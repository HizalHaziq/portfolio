'use strict';

/**
 * Refreshes the committed GitHub snapshot used as offline/rate-limit fallback.
 * Usage: node scripts/refresh-snapshot.js
 */

const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USERNAME || 'HizalHaziq';
const OUT = path.join(__dirname, '..', 'src', 'data', 'github-snapshot.json');

(async () => {
  const headers = { 'User-Agent': 'portfolio-snapshot', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const j = async (u) => {
    const res = await fetch(u, { headers });
    if (!res.ok) throw new Error(`${u} → ${res.status}`);
    return res.json();
  };

  const [user, repos, events] = await Promise.all([
    j(`https://api.github.com/users/${USERNAME}`),
    j(`https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`),
    j(`https://api.github.com/users/${USERNAME}/events/public?per_page=30`),
  ]);

  const snapshot = {
    captured_at: new Date().toISOString(),
    profile: {
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      public_repos: user.public_repos,
      html_url: user.html_url,
      created_at: user.created_at,
      location: user.location,
    },
    repos: repos
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        updated_at: r.updated_at,
        html_url: r.html_url,
        homepage: r.homepage || null,
      })),
    activity: events.slice(0, 10).map((e) => ({ type: e.type, repo: e.repo.name, created_at: e.created_at })),
  };

  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`✔ snapshot refreshed → ${path.relative(process.cwd(), OUT)}`);
})().catch((err) => {
  console.error('✖ snapshot refresh failed:', err.message);
  process.exit(1);
});
