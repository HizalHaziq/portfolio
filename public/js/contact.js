/**
 * Contact form — real-time validation, accessible errors, loading/success
 * states, duplicate-submit guard, honeypot. Posts to /api/contact.
 */

import { qs, fetchJSON, toast } from './utils.js';

const validators = {
  name: (v) => {
    if (!v) return 'Please enter your name.';
    if (v.length > 80 || /[<>]/.test(v)) return 'Please use letters and spaces only.';
    return '';
  },
  email: (v) => {
    if (!v) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'That email address looks invalid.';
    return '';
  },
  subject: (v) => {
    if (v.length < 2) return 'Please add a short subject.';
    if (v.length > 120) return 'Subject must be 120 characters or fewer.';
    return '';
  },
  message: (v) => {
    if (v.length < 10) return v ? `Please write at least 10 characters (${v.length} so far).` : 'Please write a message.';
    if (v.length > 5000) return 'Message must be 5000 characters or fewer.';
    return '';
  },
};

export function initContact() {
  const form = qs('#contact-form');
  if (!form) return;

  const submitBtn = qs('#ct-submit');
  const status = qs('#ct-status');
  const website = qs('#ct-website');
  const fields = {
    name: qs('#ct-name'),
    email: qs('#ct-email'),
    subject: qs('#ct-subject'),
    message: qs('#ct-message'),
  };
  const errors = {
    name: qs('#ct-name-error'),
    email: qs('#ct-email-error'),
    subject: qs('#ct-subject-error'),
    message: qs('#ct-message-error'),
  };

  /* char counters */
  const counter = qs('[data-for="ct-message"]');
  fields.message.addEventListener('input', () => {
    if (!counter) return;
    const len = fields.message.value.length;
    counter.textContent = `${len} / 5000`;
    counter.classList.toggle('over', len > 5000);
  });

  function validateField(key, showEmpty = true) {
    const value = fields[key].value.trim();
    const err = showEmpty || value ? validators[key](value) : '';
    if (err) {
      errors[key].textContent = err;
      errors[key].hidden = false;
      fields[key].setAttribute('aria-invalid', 'true');
      fields[key].setAttribute('aria-describedby', errors[key].id);
    } else {
      errors[key].hidden = true;
      fields[key].removeAttribute('aria-invalid');
    }
    return !err;
  }

  /* real-time: validate on blur; re-validate live once a field has an error */
  for (const key of Object.keys(fields)) {
    fields[key].addEventListener('blur', () => validateField(key));
    fields[key].addEventListener('input', () => {
      if (fields[key].getAttribute('aria-invalid') === 'true') validateField(key);
    });
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    qs('.btn-label', submitBtn).style.visibility = busy ? 'hidden' : 'visible';
    qs('.btn-spinner', submitBtn).hidden = !busy;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return; // duplicate-submit guard

    const results = Object.keys(fields).map((k) => validateField(k, true));
    if (results.includes(false)) {
      status.textContent = 'Please fix the highlighted fields.';
      status.className = 'form-status err';
      fields[Object.keys(fields)[results.indexOf(false)]].focus();
      return;
    }

    setBusy(true);
    status.textContent = '';
    status.className = 'form-status';

    try {
      const res = await fetchJSON('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          subject: fields.subject.value.trim(),
          message: fields.message.value.trim(),
          website: website.value, // honeypot
        }),
      });

      form.reset();
      counter.textContent = '0 / 5000';
      status.textContent = res.message || 'Message sent — I will get back to you soon.';
      status.className = 'form-status ok';
      toast('Message sent — thank you!');
    } catch (err) {
      if (err.fieldErrors) {
        let firstBad = null;
        for (const [key, msg] of Object.entries(err.fieldErrors)) {
          if (errors[key]) {
            errors[key].textContent = msg;
            errors[key].hidden = false;
            fields[key].setAttribute('aria-invalid', 'true');
            firstBad = firstBad || fields[key];
          }
        }
        status.textContent = 'Please fix the highlighted fields.';
        status.className = 'form-status err';
        firstBad?.focus();
      } else {
        status.textContent =
          err.code === 'rate_limited'
            ? err.message
            : 'The message could not be sent right now — please try again in a moment.';
        status.className = 'form-status err';
      }
    } finally {
      setBusy(false);
    }
  });
}
