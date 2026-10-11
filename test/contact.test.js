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

const { handleContact, buildEmail, ALLOWED_ORIGINS } = require('../api/_lib/contact');

function setup({ sendEmail } = {}) {
  const sent = [];
  const logs = [];
  const deps = {
    limiter: createRateLimiter({ limit: 5, windowMs: 60000 }),
    now: () => Date.UTC(2026, 9, 11, 12, 0, 0),
    sendEmail: sendEmail || (async email => { sent.push(email); }),
    log: (...args) => logs.push(args.join(' '))
  };
  return { deps, sent, logs };
}

const req = (over = {}) => ({
  method: 'POST',
  origin: 'https://vlkgzn.github.io',
  host: 'volkan-gozen-bizcard.vercel.app',
  ip: '9.9.9.9',
  body: { ...good },
  ...over
});

test('valid POST sends one email and returns 200 with CORS header', async () => {
  const { deps, sent } = setup();
  const r = await handleContact(req(), deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://vlkgzn.github.io');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].replyTo, 'ayse@example.com');
});

test('allowed origins list matches the spec', () => {
  assert.deepEqual(ALLOWED_ORIGINS, ['https://vlkgzn.github.io', 'https://volkan-gozen-bizcard.vercel.app', 'https://www.volkangozen.com', 'https://volkangozen.com']);
});

test('same-origin preview host is allowed', async () => {
  const { deps } = setup();
  const host = 'volkan-gozen-bizcard-git-iletisim-formu-vlkgzn.vercel.app';
  const r = await handleContact(req({ origin: `https://${host}`, host }), deps);
  assert.equal(r.status, 200);
});

test('foreign or missing origin gets 403 and no email', async () => {
  const { deps, sent } = setup();
  assert.equal((await handleContact(req({ origin: 'https://evil.example' }), deps)).status, 403);
  const r = await handleContact(req({ origin: undefined }), deps);
  assert.equal(r.status, 403);
  assert.equal(r.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(sent.length, 0);
});

test('OPTIONS preflight from allowed origin returns 204 with allow headers', async () => {
  const { deps } = setup();
  const r = await handleContact(req({ method: 'OPTIONS', body: null }), deps);
  assert.equal(r.status, 204);
  assert.equal(r.body, null);
  assert.equal(r.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(r.headers['Access-Control-Allow-Headers'], 'Content-Type');
});

test('GET returns 405 with Allow header', async () => {
  const { deps } = setup();
  const r = await handleContact(req({ method: 'GET', body: null }), deps);
  assert.equal(r.status, 405);
  assert.equal(r.headers.Allow, 'POST, OPTIONS');
});

test('sixth request in a minute gets 429 with Retry-After', async () => {
  const { deps, sent } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await handleContact(req(), deps)).status, 200);
  const r = await handleContact(req(), deps);
  assert.equal(r.status, 429);
  assert.equal(r.headers['Retry-After'], '60');
  assert.equal(sent.length, 5);
});

test('non-object or oversized body returns 400', async () => {
  const { deps } = setup();
  assert.equal((await handleContact(req({ body: 'name=x' }), deps)).status, 400);
  assert.equal((await handleContact(req({ body: null }), deps)).status, 400);
  assert.equal((await handleContact(req({ body: [good] }), deps)).status, 400);
  const big = { ...good, message: 'x'.repeat(11 * 1024) };
  assert.equal((await handleContact(req({ body: big }), deps)).status, 400);
});

test('honeypot filled returns 200 but sends nothing', async () => {
  const { deps, sent } = setup();
  const r = await handleContact(req({ body: { ...good, website: 'http://spam.example' } }), deps);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
});

test('invalid field returns 400 with field name and localized error', async () => {
  const { deps, sent } = setup();
  const r = await handleContact(req({ body: { ...good, email: 'bad', lang: 'en' } }), deps);
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { ok: false, field: 'email', error: MESSAGES.en.email });
  assert.equal(sent.length, 0);
});

test('missing consent returns 400', async () => {
  const { deps } = setup();
  const r = await handleContact(req({ body: { ...good, consent: false } }), deps);
  assert.equal(r.status, 400);
  assert.equal(r.body.field, 'consent');
});

test('send failure returns 502 and logs without personal data', async () => {
  const { deps, logs } = setup({ sendEmail: async () => { throw new Error('resend 500'); } });
  const r = await handleContact(req(), deps);
  assert.equal(r.status, 502);
  assert.equal(r.body.error, MESSAGES.tr.send);
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes('ayse@example.com'));
  assert.ok(!logs[0].includes(good.message));
});

test('buildEmail makes a one-line subject and a plain text body without IP', () => {
  const e = buildEmail({ name: 'Ali Bcc: x@y.z', email: 'a@b.co', message: 'Satır 1\nSatır 2', lang: 'tr' }, Date.UTC(2026, 9, 11, 12, 0, 0));
  assert.equal(e.subject, 'BizCard mesajı: Ali Bcc: x@y.z');
  assert.ok(!/[\r\n]/.test(e.subject));
  assert.equal(e.replyTo, 'a@b.co');
  assert.equal(e.text, [
    'Ad Soyad: Ali Bcc: x@y.z',
    'E-posta: a@b.co',
    'Sayfa dili: tr',
    'Açık rıza zamanı: 2026-10-11T12:00:00.000Z',
    '',
    'Satır 1\nSatır 2'
  ].join('\n'));
});
