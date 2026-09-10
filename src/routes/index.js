'use strict';

/**
 * All API routes. JSON only, consistent envelope:
 *   success → 200 { ...payload }
 *   error   → 4xx/5xx { error: 'short_code', message: 'human readable' }
 * Raw upstream errors are never passed through to clients.
 */

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const githubService = require('../services/github.service');
const blogService = require('../services/blog.service');
const { guestbook, contact, visits } = require('../db');
const { clean, isEmail, isName, isReaction, ALLOWED_REACTIONS } = require('../utils/validate');

const router = express.Router();

/* ---------------------------------- helpers ---------------------------------- */

function ipHash(req) {
  const ip = req.ip || 'unknown';
  return crypto.createHash('sha256').update(`${config.visitSalt}:${ip}`).digest('hex').slice(0, 24);
}

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

/* -------------------------------- rate limiting ------------------------------- */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests — please slow down.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Submission limit reached. Please try again later.' },
});

const guestbookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Submission limit reached. Please try again later.' },
});

const reactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: 'draft-8' });

router.use(apiLimiter);

/* ----------------------------------- health ----------------------------------- */

router.get('/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), ts: new Date().toISOString() });
});

/* ----------------------------------- github ----------------------------------- */

router.get('/github/overview', async (req, res) => {
  try {
    const data = await githubService.getOverview();
    res.set('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (err) {
    console.error('[github] overview failed:', err.message);
    fail(res, 503, 'github_unavailable', 'GitHub is unreachable right now — please try again later.');
  }
});

/* ----------------------------------- articles --------------------------------- */

router.get('/articles', async (req, res) => {
  try {
    const data = await blogService.getArticles();
    res.set('Cache-Control', 'public, max-age=600');
    res.json(data);
  } catch (err) {
    console.error('[blog] articles failed:', err.message);
    fail(res, 503, 'feed_unavailable', 'The article feed is unavailable right now.');
  }
});

/* ----------------------------------- contact ---------------------------------- */

router.post('/contact', contactLimiter, (req, res) => {
  const body = req.body || {};

  // Honeypot — bots fill hidden fields; real users never see them.
  if (clean(body.website)) return res.json({ ok: true });

  const name = clean(body.name, { maxLength: 80 });
  const email = clean(body.email, { maxLength: 254 });
  const subject = clean(body.subject, { maxLength: 120 });
  const message = clean(body.message, { maxLength: config.contact.maxMessageLength, multiline: true });

  const fieldErrors = {};
  if (!isName(name)) fieldErrors.name = 'Please enter your name (letters and spaces only).';
  if (!isEmail(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (subject.length < 2) fieldErrors.subject = 'Please add a short subject.';
  if (message.length < 10)
    fieldErrors.message = `Please write at least 10 characters (${message.length} so far).`;

  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({ error: 'validation', fieldErrors });
  }

  const hash = ipHash(req);
  if (contact.recentCountByIp(hash, 30) >= 3) {
    return fail(res, 429, 'rate_limited', 'You have sent several messages recently — please wait a bit.');
  }

  let forwarded = false;
  contact.add({ name, email, subject, message, ipHash: hash, forwarded });

  // Optional Formspree forwarding — never blocks the user on upstream failure.
  if (config.contact.formspreeEndpoint) {
    fetch(config.contact.formspreeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, replyTo: email, email, subject, message, _subject: `[Portfolio] ${subject}` }),
    })
      .then((r) => {
        if (r.ok) contact.markForwarded?.();
      })
      .catch(() => {});
  }

  res.status(201).json({ ok: true, message: 'Message received — thank you!' });
});

/* ---------------------------------- guestbook --------------------------------- */

router.get('/guestbook', (req, res) => {
  const entries = guestbook.list(50).map((e) => ({
    id: e.id,
    name: e.name,
    message: e.message,
    ownReaction: e.ownReaction || '',
    created_at: e.created_at,
    reactions: safeParseReactions(e.reaction),
  }));
  res.json({ entries });
});

router.post('/guestbook', guestbookLimiter, (req, res) => {
  const body = req.body || {};
  if (clean(body.website)) return res.status(201).json({ ok: true }); // honeypot

  const name = clean(body.name, { maxLength: 40 });
  const message = clean(body.message, { maxLength: 280, multiline: false });
  const reaction = clean(body.reaction, { maxLength: 20 });

  const fieldErrors = {};
  if (!isName(name)) fieldErrors.name = 'Please enter a name (letters and spaces only).';
  if (message.length < 4) fieldErrors.message = 'Message must be at least 4 characters.';
  if (message.length > 280) fieldErrors.message = 'Message must be 280 characters or fewer.';
  if (reaction && !isReaction(reaction)) fieldErrors.reaction = 'Unknown reaction.';

  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({ error: 'validation', fieldErrors });
  }

  const hash = ipHash(req);
  if (contact.recentCountByIp(hash, 10) >= 5) {
    return fail(res, 429, 'rate_limited', 'You are signing too fast — please wait a few minutes.');
  }

  const entry = guestbook.add({ name, message, reaction, authorHash: hash });
  res.status(201).json({
    ok: true,
    entry: {
      id: entry.id,
      name: entry.name,
      message: entry.message,
      ownReaction: entry.ownReaction || '',
      created_at: entry.created_at,
      reactions: safeParseReactions(entry.reaction),
    },
  });
});

router.post('/guestbook/:id/react', reactLimiter, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const emoji = clean(req.body?.reaction, { maxLength: 20 });
  if (!Number.isInteger(id) || id <= 0) return fail(res, 400, 'bad_id', 'Invalid entry.');
  if (!isReaction(emoji))
    return fail(res, 400, 'bad_reaction', `Reaction must be one of: ${ALLOWED_REACTIONS.join(', ')}.`);

  const updated = guestbook.react(id, emoji);
  if (!updated) return fail(res, 404, 'not_found', 'Entry not found.');
  res.json({ ok: true, reactions: updated });
});

/* ------------------------------- visitor counter ------------------------------ */

router.get('/visits', (req, res) => {
  try {
    visits.track(req.ip || 'unknown', req.get('user-agent') || '');
    res.json(visits.stats());
  } catch (err) {
    console.error('[visits] failed:', err.message);
    res.json({ total: 0, unique: 0, today: 0, unavailable: true });
  }
});

/* ----------------------------------- utils ------------------------------------ */

function safeParseReactions(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

module.exports = router;
