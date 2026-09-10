/**
 * Entry point — boots every module against the server-injected payload.
 * Payload comes from EJS (single source of truth on the server):
 *   window.__PORTFOLIO_DATA__ = { profile, projects, navigation, ... }
 */

import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initReveal } from './reveal.js';
import { initTyped } from './typed.js';
import { initPalette } from './palette.js';
import { initProjects } from './projects.js';
import { initSkills } from './skills.js';
import { initTimeline } from './timeline.js';
import { initGitHub } from './github.js';
import { initBlog } from './blog.js';
import { initGuestbook } from './guestbook.js';
import { initContact } from './contact.js';
import { initVisits } from './visits.js';
import { qs, toast } from './utils.js';

function boot() {
  const data = window.__PORTFOLIO_DATA__ || {};

  window.__toast = toast; // palette actions reuse the toast

  const theme = initTheme();
  const sectionIds = (data.navigation || []).map((n) => n.id).filter((id) => document.getElementById(id));

  initNav(sectionIds);
  initReveal();
  initTyped();
  initProjects(data.projects || []);
  initSkills();
  initTimeline();
  initGitHub();
  initBlog(data.blogUrl || '');
  initGuestbook();
  initContact();
  initVisits();

  initPalette({
    theme,
    sections: sectionIds,
    socials: data.profile?.socials || {},
    contactEmail: data.contactEmail || '',
  });

  /* resume links open in a new tab with the print dialog ready */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-resume]');
    if (link) {
      e.preventDefault();
      window.open('/resume', '_blank', 'noopener');
    }
  });

  /* keep the header aware of the theme for inline SVGs etc. (future-proofing) */
  qs('#year')?.replaceChildren(document.createTextNode(String(new Date().getFullYear())));

  /* report readiness — used by smoke tests */
  document.documentElement.dataset.appReady = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
