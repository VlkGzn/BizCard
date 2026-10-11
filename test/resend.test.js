'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createResendSender } = require('../api/_lib/resend');

const email = { subject: 'BizCard mesajı: Ayşe', replyTo: 'ayse@example.com', text: 'Merhaba' };

test('sends the expected request to Resend', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  await createResendSender({ apiKey: 're_test', to: 'owner@example.com', fetchImpl })(email);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    from: 'BizCard <onboarding@resend.dev>',
    to: ['owner@example.com'],
    reply_to: 'ayse@example.com',
    subject: 'BizCard mesajı: Ayşe',
    text: 'Merhaba'
  });
});

test('throws on non-2xx response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 422 });
  await assert.rejects(createResendSender({ apiKey: 'k', to: 't@x.co', fetchImpl })(email), /resend 422/);
});

test('throws when configuration is missing, without calling fetch', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true }; };
  await assert.rejects(createResendSender({ apiKey: '', to: 't@x.co', fetchImpl })(email), /missing RESEND_API_KEY/);
  assert.equal(called, false);
});

test('vercel handler maps request and response', async () => {
  const handler = require('../api/contact');
  const res = {
    headers: {}, statusCode: 0, payload: undefined, ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.payload = obj; },
    end() { this.ended = true; }
  };
  const req = {
    method: 'GET',
    headers: { origin: 'https://vlkgzn.github.io', host: 'volkan-gozen-bizcard.vercel.app', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
    get body() { throw new Error('Invalid JSON'); }
  };
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers.Allow, 'POST, OPTIONS');
  assert.equal(res.payload.ok, false);
});
