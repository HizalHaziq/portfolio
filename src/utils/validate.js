'use strict';

/** Small validation helpers — no dependencies, fail closed. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{0,79}$/u; // letters/spaces/punct, no tags

/** Strip control chars + zero-width tricks, collapse newlines, trim, cap length. */
function clean(input, { maxLength = 500, multiline = false } = {}) {
  if (typeof input !== 'string') return '';
  let out = input.normalize('NFKC');
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '');
  if (!multiline) out = out.replace(/\s*[\r\n]+\s*/g, ' ');
  out = out.trim().slice(0, maxLength);
  return out;
}

function isEmail(input) {
  return typeof input === 'string' && input.length <= 254 && EMAIL_RE.test(input);
}

function isName(input) {
  return NAME_RE.test(input);
}

const ALLOWED_REACTIONS = ['like', 'love', 'celebrate'];

function isReaction(input) {
  return ALLOWED_REACTIONS.includes(input);
}

module.exports = { clean, isEmail, isName, isReaction, ALLOWED_REACTIONS };
