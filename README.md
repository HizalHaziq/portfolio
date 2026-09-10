# Hizal's Portfolio — dynamic, production-grade developer portfolio

A modern, interactive portfolio built with **Node.js + Express 5 + EJS + SQLite** and a
**zero-build vanilla JS frontend**. The site itself is the demo: server-rendered pages,
server-cached live GitHub data, its own database powering a guestbook / contact inbox /
privacy-friendly visitor counter, CSP-hardened responses and accessible, keyboard-first UI.

## Quick start

```bash
npm install
npm start          # → http://localhost:3000
```

Requires Node 18+ (developed on Node 22).

## Features

| Feature | Where |
| --- | --- |
| Dark / light / system theme (persisted, no flash) | `public/js/theme.js`, inline bootstrap in `views/partials/head.ejs` |
| Command palette (`Ctrl/Cmd + K`) | `public/js/palette.js` |
| Project search + category/technology filters | `public/js/projects.js` |
| Interactive journey timeline (scroll progress, active milestone) | `public/js/timeline.js` |
| Live GitHub profile / repos / activity (server-cached, snapshot fallback) | `src/services/github.service.js` |
| Dev.to articles (auto-activates when configured) | `src/services/blog.service.js` |
| Contact form (validation, honeypot, rate limits, SQLite inbox) | `src/routes/index.js` |
| Guestbook (SQLite, reactions, strict text-only rendering) | `public/js/guestbook.js` |
| Privacy-friendly visitor counter (daily-salted hashes, no cookies) | `src/db.js` |
| Print-optimised résumé page | `views/resume.ejs` (`/resume`) |

## Editing content

**All portfolio content lives in one file: [`src/data/portfolio.js`](src/data/portfolio.js).**
Projects, skills, timeline entries, socials, SEO — edit there and restart.
Entries marked `TODO` (education, certifications, LinkedIn, email) are intentionally left
for real details rather than invented.

## Environment variables (all optional — sensible defaults)

Copy `.env.example` → `.env` and adjust:

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port (default `3000`) |
| `GITHUB_USERNAME` | GitHub handle for live data (default `HizalHaziq`) |
| `GITHUB_TOKEN` | Optional PAT — raises API rate limit 60→5000/h. **Server-only, never exposed.** |
| `DEVTO_USERNAME` | Dev.to handle — activates the blog section |
| `CONTACT_EMAIL` | Shown as a direct email chip |
| `FORMSPREE_ENDPOINT` | Optional Formspree endpoint to mirror contact submissions |
| `VISIT_SALT` | Salt for privacy hashes — set a random string in production |
| `SITE_URL` | Canonical URL (used for meta tags) |
| `TRUST_PROXY` | Set `true` behind a reverse proxy (correct rate-limit IPs) |

## Security notes

- Strict CSP via Helmet (nonced scripts; no inline event handlers; no third-party JS).
- All external/user content rendered with DOM `textContent` — no `innerHTML` with untrusted data.
- Server-side validation + length caps + control-character stripping on every input.
- Rate limiting (global + per-form), honeypot fields, duplicate-submit guards.
- Secrets only via environment variables; the GitHub token never reaches the browser.
- Visitor counter stores daily-rotating salted hashes only — no IPs, no cookies, no PII.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/github/overview` | Profile + repos + activity (10-min server cache, snapshot fallback) |
| `GET /api/articles` | Dev.to articles (30-min cache; empty until configured) |
| `GET /api/guestbook` | Guestbook entries |
| `POST /api/guestbook` | Sign the guestbook |
| `POST /api/guestbook/:id/react` | React to an entry (`like` / `love` / `celebrate`) |
| `POST /api/contact` | Contact form submission |
| `GET /api/visits` | Visitor counter stats |
| `GET /api/health` | Liveness probe |

## Data & refresh

`src/data/github-snapshot.json` is a committed fallback captured from the live GitHub API;
refresh it any time with `node scripts/refresh-snapshot.js`.
