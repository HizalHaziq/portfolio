'use strict';

/**
 * SQLite (better-sqlite3) — embedded, zero-service database.
 * Tables: guestbook, contact_messages, visit_days.
 * All writes use prepared statements (no injection surface).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.db.file), { recursive: true });

const db = new Database(config.db.file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS guestbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    reaction TEXT NOT NULL DEFAULT '{}',   -- JSON counts: { "like": 1 }
    own_reaction TEXT NOT NULL DEFAULT '', -- reaction chosen when signing
    author_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    hidden INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook (created_at DESC);

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    forwarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages (created_at DESC);

  CREATE TABLE IF NOT EXISTS visit_days (
    day TEXT PRIMARY KEY,              -- YYYY-MM-DD (UTC)
    salted_day TEXT NOT NULL,          -- salt marker for that day
    uniques TEXT NOT NULL DEFAULT '[]',-- JSON array of daily salted ip+ua hashes
    hits INTEGER NOT NULL DEFAULT 0
  );
`);

function safeParseReactions(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/* ---------------------------------- guestbook ---------------------------------- */

const guestbook = {
  list(limit = 50) {
    return db
      .prepare(
        `SELECT id, name, message, reaction, own_reaction AS ownReaction, created_at
           FROM guestbook
          WHERE hidden = 0
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .all(limit);
  },
  add({ name, message, reaction, authorHash }) {
    const info = db
      .prepare(
        'INSERT INTO guestbook (name, message, reaction, own_reaction, author_hash) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, message, reaction ? JSON.stringify({ [reaction]: 1 }) : '{}', reaction || '', authorHash);
    return db
      .prepare(
        'SELECT id, name, message, reaction, own_reaction AS ownReaction, created_at FROM guestbook WHERE id = ?'
      )
      .get(info.lastInsertRowid);
  },
  react(id, emoji) {
    const row = db.prepare('SELECT reaction FROM guestbook WHERE id = ? AND hidden = 0').get(id);
    if (!row) return null;
    const counts = safeParseReactions(row.reaction);
    counts[emoji] = (counts[emoji] || 0) + 1;
    db.prepare('UPDATE guestbook SET reaction = ? WHERE id = ?').run(JSON.stringify(counts), id);
    return counts;
  },
};

/* ------------------------------- contact messages ------------------------------ */

const contact = {
  add({ name, email, subject, message, ipHash, forwarded }) {
    const info = db
      .prepare(
        'INSERT INTO contact_messages (name, email, subject, message, ip_hash, forwarded) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(name, email, subject, message, ipHash, forwarded ? 1 : 0);
    return info.lastInsertRowid;
  },
  recentCountByIp(ipHash, sinceMinutes = 30) {
    return db
      .prepare(
        `SELECT COUNT(*) AS n FROM contact_messages
          WHERE ip_hash = ? AND created_at >= datetime('now', ?)`
      )
      .get(ipHash, `-${sinceMinutes} minutes`).n;
  },
};

/* -------------------------------- visitor counter ------------------------------ */

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyHash(ip, ua) {
  // Salt rotates daily → past-day hashes are never re-identifiable.
  const day = todayKey();
  const salt = crypto.createHash('sha256').update(`${config.visitSalt}:${day}`).digest('hex');
  return crypto.createHash('sha256').update(`${salt}:${ip}:${ua}`).digest('hex').slice(0, 24);
}

const visits = {
  track(ip, ua) {
    const day = todayKey();
    const hash = dailyHash(ip, ua);
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO visit_days (day, salted_day, uniques, hits) VALUES (?, ?, '[]', 0)
           ON CONFLICT(day) DO NOTHING`
      ).run(day, day);
      const row = db.prepare('SELECT uniques, hits FROM visit_days WHERE day = ?').get(day);
      const uniques = JSON.parse(row.uniques);
      const isNew = !uniques.includes(hash);
      if (isNew) {
        uniques.push(hash);
        db.prepare('UPDATE visit_days SET uniques = ?, hits = hits + 1 WHERE day = ?').run(
          JSON.stringify(uniques),
          day
        );
      } else {
        db.prepare('UPDATE visit_days SET hits = hits + 1 WHERE day = ?').run(day);
      }
    });
    tx();
  },
  stats() {
    const total = db.prepare('SELECT COALESCE(SUM(hits), 0) AS n FROM visit_days').get().n;
    const uniquesTotal = db
      .prepare('SELECT COALESCE(SUM(json_array_length(uniques)), 0) AS n FROM visit_days')
      .get().n;
    const today = db.prepare('SELECT hits FROM visit_days WHERE day = ?').get(todayKey());
    return { total, unique: uniquesTotal, today: today ? today.hits : 0 };
  },
};

module.exports = { db, guestbook, contact, visits };
