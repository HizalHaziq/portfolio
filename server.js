'use strict';

/**
 * Portfolio server — Express 5 + EJS (server-rendered) + SQLite.
 * Frontend is a zero-build vanilla ES-module app served from /public.
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./src/config');
const data = require('./src/data/portfolio');
const apiRoutes = require('./src/routes');

const app = express();

/** Inline Lucide icon from the sprite in views/partials/icons.ejs. */
app.locals.ic = (name, cls = '') =>
  `<svg class="ic${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

/* ---------------------------------- security ---------------------------------- */

// Per-request CSP nonce for the small theme-init bootstrap script.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        'style-src': ["'self'", "'unsafe-inline'"], // style="" attributes only (icon sprite)
        'img-src': [
          "'self'",
          'data:',
          'https://avatars.githubusercontent.com',
          'https://media.dev.to',
          'https://dev-to-uploads.s3.amazonaws.com',
        ],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'self'", 'https://*.e2b.app'], // allow the live-preview host
        'upgrade-insecure-requests': config.env === 'production' ? [] : null,
      },
    },
    // Same framing policy as above; helmet's SAMEORIGIN would break the preview.
    frameguard: false,
    crossOriginEmbedderPolicy: false,
  })
);

/* ------------------------------- general middleware ---------------------------- */

app.use(compression());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ------------------------------- template locals ------------------------------- */

const clientPayload = JSON.stringify({
  profile: data.profile,
  projects: data.projects,
  filterTechnologies: data.filterTechnologies,
  skills: data.skills,
  skillCategories: data.skillCategories,
  timeline: data.timeline,
  certifications: data.certifications,
  navigation: data.navigation,
  githubUsername: config.github.username,
  devtoUsername: config.blog.devtoUsername,
  blogUrl: config.blog.devtoUsername ? `https://dev.to/${config.blog.devtoUsername}` : '',
  contactEmail: config.contact.email || data.profile.socials.email || '',
})
  .replace(/</g, '\\u003c') // prevent </script> breakout
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

app.use((req, res, next) => {
  res.locals.site = {
    title: data.seo.title,
    description: data.seo.description,
    siteUrl: config.siteUrl,
    year: new Date().getFullYear(),
  };
  res.locals.d = data;
  res.locals.clientData = clientPayload;
  res.locals.contactEmail = config.contact.email || data.profile.socials.email || '';
  next();
});

/* ----------------------------------- static ------------------------------------ */

const staticOpts = { maxAge: config.env === 'production' ? '7d' : 0, etag: true };
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    ...staticOpts,
    setHeaders(res, filePath) {
      if (/\.(css|js)$/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  })
);

/* ------------------------------------ routes ----------------------------------- */

app.get('/', (req, res) => {
  res.render('index', { meta: { page: 'home' } });
});

app.get('/resume', (req, res) => {
  res.render('resume', { meta: { page: 'resume' } });
});

app.use('/api', apiRoutes);

/* ------------------------------- 404 + error handling --------------------------- */

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.status(404).render('404');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server]', err.status || 500, err.message);
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({ error: 'server_error' });
  }
  res.status(500).render('404');
});

/* ------------------------------------ start ------------------------------------ */

app.listen(config.port, '0.0.0.0', () => {
  console.log(`✔ Portfolio running at ${config.siteUrl} (${config.env})`);
  console.log(`  GitHub user: ${config.github.username}${config.github.token ? ' (token: yes)' : ''}`);
  console.log(`  Blog: ${config.blog.devtoUsername ? `dev.to/${config.blog.devtoUsername}` : 'not configured (empty state)'}`);
});
