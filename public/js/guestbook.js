/**
 * Guestbook — GET/POST /api/guestbook, reactions.
 * Security: all rendering via textContent; client + server validation;
 * honeypot field included; duplicate submits blocked client-side.
 */

import { qs, qsa, fetchJSON, toast, timeAgo } from './utils.js';

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const REACTION_LABELS = { like: '👍', love: '❤️', celebrate: '🎉' };

export function initGuestbook() {
  const form = qs('#guestbook-form');
  const list = qs('#gb-list');
  const loading = qs('#gb-loading');
  const empty = qs('#gb-empty');
  const errorBox = qs('#gb-error');
  const retry = qs('#gb-retry');
  const submitBtn = qs('#gb-submit');
  const status = qs('#gb-status');
  if (!form || !list) return;

  const nameInput = qs('#gb-name');
  const messageInput = qs('#gb-message');
  const websiteInput = qs('#gb-website');
  let selectedReaction = '';
  let reacting = new Set();

  /* reaction picker */
  qsa('.chip-react').forEach((chip) => {
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      selectedReaction = on ? '' : chip.dataset.reaction;
      qsa('.chip-react').forEach((c) => {
        if (c !== chip) c.setAttribute('aria-pressed', 'false');
      });
    });
  });

  /* character counter */
  const counter = qs('[data-for="gb-message"]');
  messageInput.addEventListener('input', () => {
    if (!counter) return;
    const len = messageInput.value.length;
    counter.textContent = `${len} / 280`;
    counter.classList.toggle('over', len > 280);
  });

  function setBusy(busy) {
    submitBtn.disabled = busy;
    qs('.btn-label', submitBtn).style.visibility = busy ? 'hidden' : 'visible';
    qs('.btn-spinner', submitBtn).hidden = !busy;
  }

  function show(box) {
    loading.hidden = true;
    errorBox.hidden = box !== 'error';
    empty.hidden = box !== 'empty';
  }

  function entryNode(entry, isNew = false) {
    const li = el('li', 'gb-entry' + (isNew ? ' is-new' : ''));
    li.dataset.id = String(entry.id);

    const head = el('div', 'gb-entry-head');
    const avatar = el('span', 'gb-avatar', (entry.name.trim()[0] || '?').toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    head.append(avatar, el('span', 'gb-name', entry.name));
    if (entry.created_at) head.append(el('span', 'gb-time', timeAgo(entry.created_at + 'Z')));

    li.append(head);
    li.append(el('p', 'gb-message', entry.message));

    const reactions = { ...(entry.reactions || {}) };
    if (entry.ownReaction && REACTION_LABELS[entry.ownReaction]) {
      const own = el('p', 'gb-own-reaction');
      own.textContent = `${REACTION_LABELS[entry.ownReaction]} reacted when signing`;
      li.append(own);
    }

    const row = el('div', 'gb-reactions');
    for (const [key, emoji] of Object.entries(REACTION_LABELS)) {
      const btn = el('button', 'react-btn');
      btn.type = 'button';
      const count = reactions[key] || 0;
      btn.setAttribute('aria-label', `React ${key} (${count})`);
      btn.append(el('span', null, emoji), el('span', 'react-count', String(count)));
      btn.addEventListener('click', async () => {
        if (reacting.has(`${entry.id}:${key}`)) return;
        reacting.add(`${entry.id}:${key}`);
        btn.disabled = true;
        try {
          const res = await fetchJSON(`/api/guestbook/${entry.id}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: key }),
          });
          qs('.react-count', btn).textContent = String(res.reactions[key] || 0);
          btn.classList.add('did');
        } catch (err) {
          toast(err.message || 'Could not react', 'err');
        } finally {
          btn.disabled = false;
          reacting.delete(`${entry.id}:${key}`);
        }
      });
      row.append(btn);
    }
    li.append(row);
    return li;
  }

  async function load() {
    loading.hidden = false;
    errorBox.hidden = true;
    try {
      const data = await fetchJSON('/api/guestbook');
      list.innerHTML = '';
      (data.entries || []).forEach((entry) => list.append(entryNode(entry)));
      show(data.entries?.length ? 'list' : 'empty');
    } catch {
      show('error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return; // duplicate-submit guard

    /* client validation */
    let ok = true;
    const nameErr = qs('#gb-name-error');
    const msgErr = qs('#gb-message-error');
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || name.length > 40 || /[<>]/.test(name)) {
      nameErr.textContent = name
        ? 'Please use letters and spaces only (max 40 characters).'
        : 'Please enter your name.';
      nameErr.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else {
      nameErr.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    }

    if (message.length < 4 || message.length > 280) {
      msgErr.textContent =
        message.length < 4 ? 'Message must be at least 4 characters.' : 'Max 280 characters.';
      msgErr.hidden = false;
      messageInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else {
      msgErr.hidden = true;
      messageInput.removeAttribute('aria-invalid');
    }

    if (!ok) return;

    setBusy(true);
    status.className = 'form-status';
    status.textContent = '';
    try {
      const res = await fetchJSON('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message,
          reaction: selectedReaction,
          website: websiteInput.value, // honeypot
        }),
      });
      if (res.ok && res.entry) {
        empty.hidden = true;
        list.prepend(entryNode(res.entry, true));
        form.reset();
        counter.textContent = '0 / 280';
        selectedReaction = '';
        qsa('.chip-react').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        status.textContent = 'Signed! Thanks for stopping by.';
        status.classList.add('ok');
        toast('Guestbook signed — thank you!');
      }
    } catch (err) {
      if (err.fieldErrors) {
        if (err.fieldErrors.name) {
          nameErr.textContent = err.fieldErrors.name;
          nameErr.hidden = false;
        }
        if (err.fieldErrors.message) {
          msgErr.textContent = err.fieldErrors.message;
          msgErr.hidden = false;
        }
        status.textContent = 'Please fix the highlighted fields.';
      } else {
        status.textContent = err.code === 'rate_limited'
          ? err.message
          : 'Could not sign right now — please try again.';
      }
      status.classList.add('err');
    } finally {
      setBusy(false);
    }
  });

  retry?.addEventListener('click', load);
  load();
}
