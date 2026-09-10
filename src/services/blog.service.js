'use strict';

/**
 * Blog service — Dev.to public API.
 * Auto-activates when DEVTO_USERNAME is configured; otherwise the route
 * reports { configured: false } and the UI renders an honest empty state.
 * Memory cache with TTL; upstream failures serve stale cache.
 */

const config = require('../config');

const memory = { data: null, fetchedAt: 0, inflight: null };

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.blog.timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `${config.github.username}-portfolio`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Dev.to API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapArticle(a) {
  const minutes =
    a.readable_publish_date && a.published_at
      ? null // dev.to doesn't return reading time in the public list payload
      : null;
  return {
    id: a.id,
    title: a.title,
    description: a.description || '',
    url: a.url,
    published_at: a.published_at,
    published_readable: a.readable_publish_date || '',
    tags: (a.tag_list || []).slice(0, 4),
    cover_image: a.cover_image || a.social_image || '',
    reading_time: a.reading_time || minutes,
    positive_reactions: a.positive_reactions_count || 0,
    comments: a.comments_count || 0,
  };
}

async function loadFresh() {
  const list = await fetchJson(
    `https://dev.to/api/articles?username=${encodeURIComponent(config.blog.devtoUsername)}&per_page=${config.blog.limit}`
  );
  return {
    source: 'live',
    fetchedAt: new Date().toISOString(),
    articles: (Array.isArray(list) ? list : []).slice(0, config.blog.limit).map(mapArticle),
  };
}

async function getArticles() {
  if (!config.blog.devtoUsername) return { configured: false, articles: [] };

  if (memory.data && Date.now() - memory.fetchedAt < config.blog.ttlMs) {
    return { configured: true, ...memory.data, cached: true };
  }
  if (!memory.inflight) {
    memory.inflight = loadFresh()
      .then((payload) => {
        memory.data = payload;
        memory.fetchedAt = Date.now();
        return payload;
      })
      .catch(() => {
        if (memory.data) return { ...memory.data, stale: true };
        return { source: 'error', articles: [], error: 'feed_unavailable' };
      })
      .finally(() => {
        memory.inflight = null;
      });
  }
  return { configured: true, ...(await memory.inflight) };
}

module.exports = { getArticles };
