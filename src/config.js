'use strict';

/**
 * Centralized configuration — every tunable in one place.
 * All values come from environment variables with safe defaults.
 * Secrets (GITHUB_TOKEN, VISIT_SALT) are server-only and never sent to the client.
 */

const path = require('path');

const env = (key, fallback = '') => (process.env[key] ?? fallback).trim();

const config = {
  env: env('NODE_ENV', 'development'),
  port: Number.parseInt(env('PORT', '3000'), 10),
  siteUrl: env('SITE_URL', `http://localhost:${env('PORT', '3000')}`),

  // --- GitHub integration -----------------------------------------------
  github: {
    username: env('GITHUB_USERNAME', 'HizalHaziq'),
    // Optional PAT — raises the rate limit from 60 to 5000 req/h.
    // Server-only: never exposed to the browser, never logged.
    token: env('GITHUB_TOKEN'),
    ttlMs: Number.parseInt(env('GITHUB_CACHE_TTL_MS'), 10) || 10 * 60 * 1000, // 10 min
    timeoutMs: 12_000,
  },

  // --- Blog integration (Dev.to) ------------------------------------------
  blog: {
    // Empty by default: the blog section renders an honest empty state until
    // DEVTO_USERNAME is configured. Set it to auto-activate the section.
    devtoUsername: env('DEVTO_USERNAME'),
    ttlMs: 30 * 60 * 1000, // 30 min
    timeoutMs: 10_000,
    limit: 6,
  },

  // --- Database (SQLite) ----------------------------------------------------
  db: {
    file: path.join(__dirname, '..', 'data', 'portfolio.sqlite'),
  },

  // --- Visitor counter -------------------------------------------------------
  // Daily-rotating salt: raw IPs are never stored, only per-day salted hashes
  // used to count unique visitors. Salt rotates at midnight — hashes from
  // previous days cannot be re-identified.
  visitSalt: env('VISIT_SALT', 'change-me-in-production'),

  // --- Contact ----------------------------------------------------------------
  contact: {
    // Optional: also forward submissions to a Formspree endpoint.
    formspreeEndpoint: env('FORMSPREE_ENDPOINT'),
    // Optional: shown in the UI as a direct email chip.
    email: env('CONTACT_EMAIL'),
    maxMessageLength: 5000,
  },

  // --- Cache / HTTP -------------------------------------------------------------
  trustProxy: env('TRUST_PROXY') === 'true',
  cacheDir: path.join(__dirname, '..', 'data'),
};

module.exports = config;
