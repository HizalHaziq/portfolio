/**
 * Blog section — Dev.to via /api/articles.
 * Handles: not-configured (empty state), loading, error + retry, success.
 */

import { qs, fetchJSON, timeAgo } from './utils.js';

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

export function initBlog(blogUrl) {
  const grid = qs('#blog-grid');
  const empty = qs('#blog-empty');
  const errorBox = qs('#blog-error');
  const retry = qs('#blog-retry');
  const more = qs('#blog-more');
  const moreLink = qs('#blog-more-link');
  if (!grid) return;

  async function load() {
    grid.innerHTML = '';
    errorBox.hidden = true;
    empty.hidden = true;

    try {
      const data = await fetchJSON('/api/articles');

      if (!data.configured) {
        empty.hidden = false;
        return;
      }
      if (data.error) throw new Error('feed error');

      if (!data.articles.length) {
        empty.hidden = false;
      } else {
        for (const a of data.articles) {
          const card = document.createElement('a');
          card.className = 'blog-card';
          card.href = a.url;
          card.target = '_blank';
          card.rel = 'noopener noreferrer';

          const cover = el('div', 'blog-cover');
          if (a.cover_image) {
            const img = document.createElement('img');
            img.src = a.cover_image;
            img.alt = '';
            img.loading = 'lazy';
            cover.append(img);
          } else {
            const fallback = el('div', 'blog-cover-fallback');
            fallback.append(icon('book-open'));
            cover.append(fallback);
          }

          const body = el('div', 'blog-body');
          body.append(el('h3', 'blog-title', a.title));
          if (a.description) body.append(el('p', 'blog-excerpt', a.description));

          if (a.tags.length) {
            const tags = el('div', 'blog-tags');
            a.tags.forEach((t) => tags.append(el('span', 'chip chip-soft', `#${t}`)));
            body.append(tags);
          }

          const meta = el('div', 'blog-meta');
          const date = el('span', null, a.published_at ? timeAgo(a.published_at) : a.published_readable);
          meta.append(date);
          if (a.reading_time) {
            const rt = el('span');
            rt.append(icon('clock'), document.createTextNode(`${a.reading_time} min read`));
            meta.append(rt);
          }
          if (a.positive_reactions) {
            const rc = el('span');
            rc.append(icon('heart'), document.createTextNode(String(a.positive_reactions)));
            meta.append(rc);
          }
          body.append(meta);

          card.append(cover, body);
          grid.append(card);
        }
      }

      if (more && moreLink && blogUrl) {
        more.hidden = false;
        moreLink.href = blogUrl;
      }
    } catch {
      errorBox.hidden = false;
    }
  }

  retry?.addEventListener('click', load);
  load();
}
