/**
 * Shared utilities — tiny, dependency-free helpers used across modules.
 */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Debounce with trailing edge. */
export function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** fetch + JSON + timeout + consistent error shape. Never throws raw errors upward. */
export async function fetchJSON(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || `Request failed (${res.status})`);
      err.code = body.error || 'http_error';
      err.status = res.status;
      err.fieldErrors = body.fieldErrors || null;
      throw err;
    }
    return body;
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('The request timed out.');
      e.code = 'timeout';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** "3 days ago" style relative time. */
export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
  const units = [
    [60, 'second'], [3600, 'minute'], [86400, 'hour'],
    [2592000, 'day'], [31536000, 'month'], [Infinity, 'year'],
  ];
  let last = 1;
  for (const [limit, name] of units) {
    if (secs < limit) {
      const n = Math.max(1, Math.floor(secs / last));
      return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
    last = limit;
  }
  return '';
}

/** Toast singleton for transient feedback. */
let toastEl;
let toastTimer;
export function toast(message, kind = 'ok') {
  toastEl = toastEl || qs('#toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
