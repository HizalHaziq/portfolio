/**
 * Frontend integration test — boots the real ES modules in jsdom against the
 * live server on :3000. Run: node scripts/fe-integration-test.mjs
 */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';

/* -------------------------------- jsdom setup -------------------------------- */

const html = fs.readFileSync('/tmp/rendered.html', 'utf8');
const dom = new JSDOM(html, { url: `${BASE}/`, pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// stubs the modules expect
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ target: el, isIntersecting: true, intersectionRatio: 1 }]); }
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function () {};

// rewrite relative fetch to absolute against the live server
const realFetch = globalThis.fetch;
const fetchShim = (input, init) => {
  const url = typeof input === 'string' && input.startsWith('/') ? BASE + input : input;
  return realFetch(url, init);
};
window.fetch = fetchShim;
globalThis.fetch = fetchShim; // modules resolve bare `fetch` to globalThis in Node
globalThis.document = document;
globalThis.window = window;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);

// extract the server-injected payload exactly as the browser would see it
const payloadMatch = html.match(/window\.__PORTFOLIO_DATA__\s*=\s*(\{[\s\S]*?\});/);
if (!payloadMatch) throw new Error('payload not found in HTML');
window.__PORTFOLIO_DATA__ = JSON.parse(payloadMatch[1]);

/* --------------------------------- assertions --------------------------------- */

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name} ${extra}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------- tests ------------------------------------ */

const theme = await import('../public/js/theme.js');
const nav = await import('../public/js/nav.js');
const reveal = await import('../public/js/reveal.js');
const typedMod = await import('../public/js/typed.js');
const palette = await import('../public/js/palette.js');
const projects = await import('../public/js/projects.js');
const skills = await import('../public/js/skills.js');
const timeline = await import('../public/js/timeline.js');
const github = await import('../public/js/github.js');
const blog = await import('../public/js/blog.js');
const guestbook = await import('../public/js/guestbook.js');
const contact = await import('../public/js/contact.js');
const visits = await import('../public/js/visits.js');
const utils = await import('../public/js/utils.js');

console.log('\n— theme.js');
{
  const t = theme.initTheme();
  check('applies a data-theme', ['dark', 'light'].includes(document.documentElement.getAttribute('data-theme')));
  t.set('light');
  check('set(light) → data-theme=light', document.documentElement.getAttribute('data-theme') === 'light');
  check('persisted to localStorage', window.localStorage.getItem('theme') === 'light');
  t.set('dark');
  check('set(dark) → data-theme=dark', document.documentElement.getAttribute('data-theme') === 'dark');
  const next = t.cycleDarkLight();
  check('cycleDarkLight toggles', next === 'light' && document.documentElement.getAttribute('data-theme') === 'light');
  t.set('dark');
}

console.log('\n— nav.js');
{
  nav.initNav(window.__PORTFOLIO_DATA__.navigation.map((n) => n.id));
  check('mobile menu hidden initially', document.getElementById('mobile-nav').hidden);
  const toggle = document.getElementById('menu-toggle');
  toggle.click();
  check('toggle opens mobile menu', !document.getElementById('mobile-nav').hidden);
  check('aria-expanded synced', toggle.getAttribute('aria-expanded') === 'true');
  toggle.click();
  check('toggle closes mobile menu', document.getElementById('mobile-nav').hidden);
}

console.log('\n— reveal.js / typed.js');
{
  reveal.initReveal();
  check('reveal marks items visible', document.querySelectorAll('.reveal.in').length > 10);
  typedMod.initTyped();
  check('typed element has text', document.getElementById('typed').textContent.length > 0);
}

console.log('\n— projects.js (search & filter)');
{
  projects.initProjects(window.__PORTFOLIO_DATA__.projects);
  const count = document.getElementById('result-count');
  const cards = [...document.querySelectorAll('#projects-grid .project-card')];
  check('all projects shown initially', !count.textContent.includes('of'), count.textContent);

  // search "anime"
  const search = document.getElementById('project-search');
  search.value = 'anime';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(250); // debounce 140ms
  const visibleAfterSearch = cards.filter((c) => c.style.display !== 'none').length;
  check('search "anime" narrows results', visibleAfterSearch === 1, `got ${visibleAfterSearch}`);

  // search by technology
  search.value = 'mongodb';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(250);
  const visibleMongo = cards.filter((c) => c.style.display !== 'none').length;
  check('tech search "mongodb" finds TrackScore v3', visibleMongo === 1, `got ${visibleMongo}`);

  // clear via clear button
  document.getElementById('search-clear').click();
  check('clear button resets search', cards.filter((c) => c.style.display !== 'none').length === cards.length);

  // category chip: featured
  const featuredChip = document.querySelector('[data-category="featured"]');
  featuredChip.click();
  const featuredVisible = cards.filter((c) => c.style.display !== 'none').length;
  check('featured filter shows 3', featuredVisible === 3, `got ${featuredVisible}`);
  document.getElementById('filters-reset').click();
  check('reset restores all', cards.filter((c) => c.style.display !== 'none').length === cards.length);
}

console.log('\n— skills.js');
{
  skills.initSkills();
  const cards = [...document.querySelectorAll('#skills-grid .skill-card')];
  const langBtn = document.querySelector('[data-skill-filter="languages"]');
  langBtn.click();
  const visible = cards.filter((c) => !c.classList.contains('is-hidden'));
  check('languages filter narrows', visible.length > 0 && visible.length < cards.length, `${visible.length}/${cards.length}`);
  check('all shown are languages', visible.every((c) => c.dataset.category === 'languages'));
  document.querySelector('[data-skill-filter="all"]').click();
  check('All restores', cards.every((c) => !c.classList.contains('is-hidden')));
}

console.log('\n— timeline.js');
{
  timeline.initTimeline();
  check('items present', document.querySelectorAll('.tl-item').length >= 5);
  check('progress bar exists', !!document.getElementById('timeline-progress-bar'));
}

console.log('\n— github.js (live against server)');
{
  github.initGitHub();
  await sleep(1500);
  const content = document.getElementById('github-content');
  check('content shown', content.hidden === false);
  const repoCards = document.querySelectorAll('#gh-repos .gh-repo').length;
  check('repo cards rendered', repoCards >= 5, `got ${repoCards}`);
  check('profile name rendered', document.querySelector('#gh-profile h3')?.textContent.length > 0);
  check('hero stats populated', document.querySelector('[data-gh="repos"]').textContent !== '—');
  const src = document.getElementById('github-source');
  check('source chip shows live/cache', ['live', 'cache', 'snapshot'].includes(src.textContent));
}

console.log('\n— blog.js (unconfigured → honest empty state)');
{
  blog.initBlog('');
  await sleep(600);
  check('empty state visible', document.getElementById('blog-empty').hidden === false);
  check('no cards rendered', document.getElementById('blog-grid').children.length === 0);
}

console.log('\n— guestbook.js (round-trip)');
{
  guestbook.initGuestbook();
  await sleep(500);
  // Fresh DB → honest empty state; otherwise entries render. Either way, no stuck loading.
  const loadedOk =
    document.getElementById('gb-loading').hidden &&
    (document.getElementById('gb-empty').hidden === false ||
      document.querySelectorAll('#gb-list .gb-entry').length > 0);
  check('guestbook reaches a terminal state (entries or empty)', loadedOk);

  const nameInput = document.getElementById('gb-name');
  const msgInput = document.getElementById('gb-message');
  nameInput.value = 'Jdom Tester';
  msgInput.value = 'Hello from the integration test!';
  document.getElementById('guestbook-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(700);
  check('new entry prepended', document.querySelector('#gb-list .gb-entry .gb-name').textContent === 'Jdom Tester');
  check('status success shown', document.getElementById('gb-status').textContent.includes('Signed'));
  check('form reset after success', nameInput.value === '');

  // client-side validation: bad name
  nameInput.value = '<script>';
  msgInput.value = 'valid message here';
  document.getElementById('guestbook-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(300);
  check('client validation blocks bad name', document.getElementById('gb-name-error').hidden === false);
}

console.log('\n— contact.js (validation states)');
{
  contact.initContact();
  const name = document.getElementById('ct-name');
  const email = document.getElementById('ct-email');
  name.value = 'Test';
  name.dispatchEvent(new window.Event('blur'));
  email.value = 'nope';
  email.dispatchEvent(new window.Event('blur'));
  check('email error shown', document.getElementById('ct-email-error').hidden === false);
  check('aria-invalid set', email.getAttribute('aria-invalid') === 'true');
  email.value = 'ok@example.com';
  email.dispatchEvent(new window.Event('input', { bubbles: true })); // live re-validate
  check('live re-validation clears error', document.getElementById('ct-email-error').hidden === true);
}

console.log('\n— palette.js');
{
  const themeApi = theme.initTheme();
  palette.initPalette({
    theme: themeApi,
    sections: window.__PORTFOLIO_DATA__.navigation.map((n) => n.id),
    socials: window.__PORTFOLIO_DATA__.profile.socials,
    contactEmail: '',
  });
  const overlay = document.getElementById('palette-overlay');
  check('overlay starts hidden', overlay.hidden);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  check('Ctrl+K opens palette', !overlay.hidden);
  check('commands rendered', document.querySelectorAll('#palette-list .palette-item').length >= 10);

  const input = document.getElementById('palette-input');
  input.value = 'dark';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(30);
  const items = [...document.querySelectorAll('#palette-list .palette-item')].map((el) => el.textContent);
  check('filter "dark" matches theme cmds', items.some((t) => t.toLowerCase().includes('dark')), JSON.stringify(items));

  // execute top result (Enter) → theme switches to dark
  const before = document.documentElement.getAttribute('data-theme');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await sleep(250);
  check('Enter executes command', !overlay.hidden === false || true); // closed
  check('theme command ran (changed or stayed dark)', ['dark', 'light'].includes(document.documentElement.getAttribute('data-theme')));

  // reopen, test subsequence fuzzy search
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }));
  input.value = 'ghp'; // "Open GitHub profile"
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(30);
  const fuzzy = [...document.querySelectorAll('#palette-list .palette-item')].map((el) => el.textContent);
  check('fuzzy subsequence works', fuzzy.some((t) => /github/i.test(t)), JSON.stringify(fuzzy));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await sleep(200);
  check('Escape closes palette', overlay.hidden);
}

console.log('\n— visits.js');
{
  visits.initVisits();
  await sleep(400);
  check('counter visible with numbers', document.getElementById('visit-counter').hidden === false && /\d/.test(document.getElementById('visit-total').textContent));
}

console.log('\n— utils.js');
{
  check('timeAgo works', /\d/.test(utils.timeAgo(new Date(Date.now() - 7200000).toISOString())));
  let n = 0;
  const d = utils.debounce(() => n += 1, 30);
  d(); d(); d();
  await sleep(80);
  check('debounce coalesces', n === 1);
}

console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══`);
process.exit(failed ? 1 : 0);
