'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter, validate, MESSAGES } = require('../api/_lib/contact');

const good = { name: 'Ayşe Yılmaz', email: 'ayse@example.com', message: 'Merhaba, tohum projesi hakkında konuşalım.', consent: true, lang: 'tr' };

test('rate limiter allows 5 hits then blocks with retryAfter', () => {
  const hit = createRateLimiter({ limit: 5, windowMs: 60000 });
  for (let i = 0; i < 5; i++) assert.deepEqual(hit('1.1.1.1', 1000 + i), { ok: true });
  const blocked = hit('1.1.1.1', 1010);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfter, 60);
});

test('rate limiter counts keys separately and forgets old hits', () => {
  const hit = createRateLimiter({ limit: 1, windowMs: 60000 });
  assert.equal(hit('a', 0).ok, true);
  assert.equal(hit('b', 0).ok, true);
  assert.equal(hit('a', 1).ok, false);
  assert.equal(hit('a', 60001).ok, true);
});

test('validate accepts a good body and normalises it', () => {
  const r = validate({ ...good, name: '  Ayşe   Yılmaz ', email: ' ayse@example.com ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { name: 'Ayşe Yılmaz', email: 'ayse@example.com', message: good.message, lang: 'tr' });
});

test('validate accepts Turkish names and counts characters, not bytes', () => {
  assert.equal(validate({ ...good, name: 'Çağrı Şükrü Öğüt' }).ok, true);
  assert.equal(validate({ ...good, name: 'Ğ'.repeat(100) }).ok, true);
  assert.equal(validate({ ...good, name: 'Ğ'.repeat(101) }).field, 'name');
});

test('validate rejects whitespace-only fields', () => {
  assert.equal(validate({ ...good, name: '    ' }).field, 'name');
  assert.equal(validate({ ...good, message: '            ' }).field, 'message');
});

test('validate collapses line breaks in name to one line', () => {
  const r = validate({ ...good, name: 'Ali\r\nBcc: x@y.z' });
  assert.equal(r.ok, true);
  assert.equal(r.data.name, 'Ali Bcc: x@y.z');
});

test('validate rejects bad email, short or long message, missing consent', () => {
  assert.equal(validate({ ...good, email: 'ayse@' }).field, 'email');
  assert.equal(validate({ ...good, email: 'a@b.co'.padStart(201, 'x') }).field, 'email');
  assert.equal(validate({ ...good, message: 'kısa' }).field, 'message');
  assert.equal(validate({ ...good, message: 'x'.repeat(2001) }).field, 'message');
  assert.equal(validate({ ...good, message: 'x'.repeat(2000) }).ok, true);
  assert.equal(validate({ ...good, consent: 'true' }).field, 'consent');
  assert.equal(validate({ ...good, consent: undefined }).field, 'consent');
});

test('validate accepts plus-addressed email', () => {
  assert.equal(validate({ ...good, email: 'ayse+bizcard@example.com' }).ok, true);
});

test('validate returns messages in the requested language', () => {
  assert.equal(validate({ ...good, lang: 'en', consent: false }).message, MESSAGES.en.consent);
  assert.equal(validate({ ...good, lang: 'xx', consent: false }).message, MESSAGES.tr.consent);
});
