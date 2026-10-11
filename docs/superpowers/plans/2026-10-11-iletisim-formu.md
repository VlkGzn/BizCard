# İletişim Formu, KVKK ve Güvenlik Başlıkları — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BizCard'a KVKK uyumlu bir iletişim formu, Gizlilik/Aydınlatma sayfaları ve Vercel güvenlik başlıkları eklemek; mesajlar Resend ile `vgozen44@gmail.com` adresine e-posta olarak gelsin.

**Architecture:** Statik HTML site aynen kalır. Tek bir Vercel Function (`api/contact.js`) ince bir adaptördür; tüm iş mantığı (CORS, rate limit, doğrulama, e-posta içeriği) `api/_lib/contact.js` içinde saf fonksiyonlar olarak durur ve `node --test` ile test edilir. Resend'e bağımlılık olmadan `fetch` ile gidilir. Tarayıcı tarafı `form.js` JSON gönderir; GitHub Pages'te mutlak Vercel adresine, diğer yerlerde aynı origin `/api/contact` adresine.

**Tech Stack:** HTML/CSS, vanilla JS, Node.js (CommonJS, Node ≥ 18 yerleşik `fetch` ve `node:test`), Vercel Functions, Resend REST API.

**Spec:** `docs/superpowers/specs/2026-10-11-iletisim-formu-design.md`

## Global Constraints

- `package.json` eklenmez; bağımlılık yok. Vercel "Application Preset: Other" kalır.
- Tüm sunucu kodu CommonJS (`require` / `module.exports`), `'use strict';` ile başlar.
- Alıcı `CONTACT_TO` ortam değişkeninden okunur; değer koda yazılmaz.
- Gönderici: `BizCard <onboarding@resend.dev>`.
- İzinli origin'ler: `https://vlkgzn.github.io`, `https://volkan-gozen-bizcard.vercel.app`, ve `https://<Host>` (aynı origin, Preview için).
- Rate limit: IP başına 60 saniyede 5 istek; aşımda `429` + `Retry-After`.
- Alan sınırları: ad 2–100, e-posta en fazla 200 ve geçerli biçim, mesaj 10–2000 karakter; rıza `true` olmalı. Gövde en fazla 10 KB.
- Satır içi `<script>` yok (CSP `script-src 'self'`). Satır içi `<style>` serbest.
- Yeni sayfalar font gömmez; gövde sistem fontu, başlıklar `Georgia, serif`.
- Loglara mesaj içeriği ve e-posta adresi yazılmaz. IP e-postaya yazılmaz.
- Statik dosyada değişiklik olursa `sw.js` içindeki `VERSION` artırılır (bu planda `bizcard-v2`).
- Testler: `node --test test/` (proje kökünden).

## Review Focus

1. **Türkçe karakterli adlar** (`Çağrı Şükrü Öğüt`) — kabul edilmeli; uzunluk karakter sayısıyla, bayt ile değil ölçülmeli. Test: Task 1.
2. **Yalnızca boşluk içeren alanlar** (`"   "`) — "boş" sayılıp reddedilmeli. Test: Task 1.
3. **Ad alanında satır sonu** (`"Ali\r\nBcc: x@y.z"`) — e-posta konusuna satır sonu girmemeli; tek satıra indirgenmeli. Test: Task 1 ve Task 2.
4. **Origin başlığı olmayan istek** (curl, bot) — `403` almalı, e-posta gitmemeli. Test: Task 2.
5. **Çift tıklama / ağ yokken gönderim (PWA)** — gönderim sırasında düğme kilitli olmalı; çevrimdışıyken anlaşılır mesaj görünmeli, sayfa bozulmamalı. Test: Task 6 manuel adım.

---

## Dosya Haritası

| Dosya | Görev |
| --- | --- |
| `api/_lib/contact.js` (yeni) | Saf iş mantığı: mesaj metinleri, `createRateLimiter`, `validate`, `buildEmail`, `handleContact` |
| `api/_lib/resend.js` (yeni) | `createResendSender` — Resend REST çağrısı |
| `api/contact.js` (yeni) | Vercel Function adaptörü: `req/res` ↔ `handleContact` |
| `test/contact.test.js` (yeni) | `contact.js` birim testleri |
| `test/resend.test.js` (yeni) | `resend.js` ve adaptör testleri |
| `test/static.test.js` (yeni) | `vercel.json`, satır içi script yokluğu, `sw.js` varlık listesi |
| `vercel.json` (yeni) | Güvenlik başlıkları |
| `.vercelignore` (yeni) | Test ve dokümanları Vercel yayınından çıkarır |
| `.gitignore` (yeni), `.env.example` (yeni) | Secret yönetimi |
| `app.js` (yeni) | Service worker kaydı (index/en'deki satır içi script buraya taşınır) |
| `form.js` (yeni) | Form gönderimi |
| `pages.css` (yeni) | Yeni 4 sayfanın ortak stili |
| `iletisim.html`, `contact.html` (yeni) | Form sayfaları |
| `gizlilik.html`, `privacy.html` (yeni) | Aydınlatma metni |
| `index.html`, `en.html` (değişir) | `app.js`, "Mesaj Gönder" düğmesi, "Gizlilik" linki |
| `sw.js` (değişir) | Yeni dosyalar, `bizcard-v2`, `/api/` atlama |
| `README.md`, `GUVENLIK-KONTROL-LISTESI.md` (değişir) | Belgeler |

---

### Task 1: Doğrulama ve rate limit

**Files:**
- Create: `api/_lib/contact.js`
- Test: `test/contact.test.js`

**Interfaces:**
- Produces:
  - `MESSAGES: { tr: Record<string,string>, en: Record<string,string> }` — anahtarlar: `name, email, message, consent, body, origin, method, rate, send`
  - `createRateLimiter({ limit: number, windowMs: number }) → (key: string, now: number) → { ok: true } | { ok: false, retryAfter: number }`
  - `validate(body: object) → { ok: true, data: { name, email, message, lang } } | { ok: false, field: 'name'|'email'|'message'|'consent', message: string }`

- [ ] **Step 1: Write the failing tests**

`test/contact.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL with `Cannot find module '../api/_lib/contact'`

- [ ] **Step 3: Write the implementation**

`api/_lib/contact.js`:

```js
'use strict';
// BizCard iletişim formu: saf iş mantığı (Vercel'den bağımsız, test edilebilir).

const LIMITS = { name: [2, 100], email: [3, 200], message: [10, 2000] };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES = {
  tr: {
    name: 'Ad Soyad 2–100 karakter olmalı.',
    email: 'Geçerli bir e-posta adresi girin.',
    message: 'Mesaj 10–2000 karakter olmalı.',
    consent: 'Göndermek için açık rıza kutusunu işaretleyin.',
    body: 'Geçersiz istek.',
    origin: 'Bu adresten gönderim kabul edilmiyor.',
    method: 'Bu yöntem desteklenmiyor.',
    rate: 'Çok fazla deneme yaptınız. Lütfen bir dakika sonra tekrar deneyin.',
    send: 'Mesaj şu an gönderilemedi. Lütfen daha sonra tekrar deneyin.'
  },
  en: {
    name: 'Name must be 2–100 characters.',
    email: 'Please enter a valid email address.',
    message: 'Message must be 10–2000 characters.',
    consent: 'Please tick the consent box to send.',
    body: 'Invalid request.',
    origin: 'Requests from this address are not accepted.',
    method: 'This method is not supported.',
    rate: 'Too many attempts. Please try again in a minute.',
    send: 'Your message could not be sent right now. Please try again later.'
  }
};

function pickLang(body) {
  return body && typeof body === 'object' && body.lang === 'en' ? 'en' : 'tr';
}

function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return function hit(key, now) {
    if (hits.size > 5000) hits.clear();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    return { ok: true };
  };
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(body) {
  const lang = pickLang(body);
  const data = {
    name: clean(body.name).replace(/\s+/g, ' '),
    email: clean(body.email),
    message: clean(body.message),
    lang
  };
  for (const field of ['name', 'email', 'message']) {
    const [min, max] = LIMITS[field];
    const length = [...data[field]].length;
    const badEmail = field === 'email' && !EMAIL_RE.test(data.email);
    if (length < min || length > max || badEmail) {
      return { ok: false, field, message: MESSAGES[lang][field] };
    }
  }
  if (body.consent !== true) return { ok: false, field: 'consent', message: MESSAGES[lang].consent };
  return { ok: true, data };
}

module.exports = { MESSAGES, createRateLimiter, validate };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add api/_lib/contact.js test/contact.test.js
git commit -m "Add contact form validation and rate limiter"
```

---

### Task 2: İstek işleyici (`handleContact`)

**Files:**
- Modify: `api/_lib/contact.js`
- Test: `test/contact.test.js`

**Interfaces:**
- Consumes: `MESSAGES`, `createRateLimiter`, `validate`, `pickLang` (Task 1, aynı dosya)
- Produces:
  - `buildEmail(data: {name,email,message,lang}, now: number) → { subject: string, replyTo: string, text: string }`
  - `handleContact(req: { method, origin, host, ip, body }, deps: { limiter, now: () => number, sendEmail: (email) => Promise<void>, log: (...args) => void }) → Promise<{ status: number, headers: Record<string,string>, body: object|null }>`
  - `ALLOWED_ORIGINS: string[]`

- [ ] **Step 1: Write the failing tests** (append to `test/contact.test.js`)

```js
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
  assert.deepEqual(ALLOWED_ORIGINS, ['https://vlkgzn.github.io', 'https://volkan-gozen-bizcard.vercel.app']);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL with `handleContact is not a function`

- [ ] **Step 3: Write the implementation** (in `api/_lib/contact.js`, above `module.exports`; then replace the export line)

```js
const ALLOWED_ORIGINS = ['https://vlkgzn.github.io', 'https://volkan-gozen-bizcard.vercel.app'];
const MAX_BODY_BYTES = 10 * 1024;

function isAllowedOrigin(origin, host) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return Boolean(host) && origin === `https://${host}`;
}

function buildEmail(data, now) {
  return {
    subject: `BizCard mesajı: ${data.name}`,
    replyTo: data.email,
    text: [
      `Ad Soyad: ${data.name}`,
      `E-posta: ${data.email}`,
      `Sayfa dili: ${data.lang}`,
      `Açık rıza zamanı: ${new Date(now).toISOString()}`,
      '',
      data.message
    ].join('\n')
  };
}

async function handleContact(req, deps) {
  const { method, origin, host, ip, body } = req;
  const t = MESSAGES[pickLang(body)];
  const allowed = isAllowedOrigin(origin, host);
  const cors = allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
  const reply = (status, payload, extra = {}) => ({ status, headers: { ...cors, ...extra }, body: payload });

  if (method === 'OPTIONS') {
    if (!allowed) return reply(403, { ok: false, error: t.origin });
    return reply(204, null, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
  }
  if (method !== 'POST') return reply(405, { ok: false, error: t.method }, { Allow: 'POST, OPTIONS' });
  if (!allowed) return reply(403, { ok: false, error: t.origin });

  const limit = deps.limiter(ip || 'unknown', deps.now());
  if (!limit.ok) return reply(429, { ok: false, error: t.rate }, { 'Retry-After': String(limit.retryAfter) });

  const isObject = body && typeof body === 'object' && !Array.isArray(body);
  if (!isObject || Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
    return reply(400, { ok: false, field: null, error: t.body });
  }
  if (body.website) return reply(200, { ok: true });

  const result = validate(body);
  if (!result.ok) return reply(400, { ok: false, field: result.field, error: result.message });

  try {
    await deps.sendEmail(buildEmail(result.data, deps.now()));
  } catch (err) {
    deps.log('contact: send failed:', err && err.message);
    return reply(502, { ok: false, error: t.send });
  }
  return reply(200, { ok: true });
}

module.exports = { MESSAGES, ALLOWED_ORIGINS, createRateLimiter, validate, buildEmail, handleContact };
```

Delete the old line `module.exports = { MESSAGES, createRateLimiter, validate };`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 22 tests

- [ ] **Step 5: Commit**

```bash
git add api/_lib/contact.js test/contact.test.js
git commit -m "Add contact request handler with CORS, rate limit and honeypot"
```

---

### Task 3: Resend gönderici, Vercel Function ve secret dosyaları

**Files:**
- Create: `api/_lib/resend.js`, `api/contact.js`, `.gitignore`, `.env.example`, `.vercelignore`
- Test: `test/resend.test.js`

**Interfaces:**
- Consumes: `handleContact`, `createRateLimiter` (Task 2)
- Produces:
  - `createResendSender({ apiKey, to, fetchImpl? }) → (email: {subject, replyTo, text}) => Promise<void>` — hata durumunda `Error('resend <status>')` veya `Error('missing RESEND_API_KEY or CONTACT_TO')` fırlatır
  - `api/contact.js` default export: `async (req, res) => void`

- [ ] **Step 1: Write the failing tests**

`test/resend.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL with `Cannot find module '../api/_lib/resend'`

- [ ] **Step 3: Write the implementation**

`api/_lib/resend.js`:

```js
'use strict';
// Resend REST API ile e-posta gönderir. Bağımlılık yok; Node'un fetch'i kullanılır.

const FROM = 'BizCard <onboarding@resend.dev>';

function createResendSender({ apiKey, to, fetchImpl = fetch }) {
  return async function sendEmail({ subject, replyTo, text }) {
    if (!apiKey || !to) throw new Error('missing RESEND_API_KEY or CONTACT_TO');
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: replyTo, subject, text })
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  };
}

module.exports = { createResendSender };
```

`api/contact.js`:

```js
'use strict';
// Vercel Function: POST /api/contact — iş mantığı api/_lib/contact.js içinde.

const { handleContact, createRateLimiter } = require('./_lib/contact');
const { createResendSender } = require('./_lib/resend');

const limiter = createRateLimiter({ limit: 5, windowMs: 60000 });

module.exports = async function contact(req, res) {
  let body = null;
  try {
    body = req.body;
  } catch {
    body = null;
  }
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const result = await handleContact(
    {
      method: req.method,
      origin: req.headers.origin,
      host: req.headers.host,
      ip: forwarded || (req.socket && req.socket.remoteAddress),
      body
    },
    {
      limiter,
      now: Date.now,
      sendEmail: createResendSender({ apiKey: process.env.RESEND_API_KEY, to: process.env.CONTACT_TO }),
      log: console.error
    }
  );
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  res.setHeader('Cache-Control', 'no-store');
  if (result.body === null) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.body);
};
```

`.gitignore`:

```
.env*
!.env.example
.vercel
node_modules
.DS_Store
```

`.env.example`:

```
# Kopyalayın: cp .env.example .env.local  — .env.local commit edilmez.
RESEND_API_KEY=
CONTACT_TO=
```

`.vercelignore`:

```
test
docs
GUVENLIK-KONTROL-LISTESI.md
.env.example
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 26 tests

- [ ] **Step 5: Check no secret is tracked**

Run: `git status --porcelain && git ls-files | grep -E '^\.env' `
Expected: only `.env.example` listed by the second command.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/resend.js api/contact.js test/resend.test.js .gitignore .env.example .vercelignore
git commit -m "Add Resend sender and /api/contact Vercel function"
```

---

### Task 4: Satır içi scripti taşı ve `vercel.json` güvenlik başlıkları

**Files:**
- Create: `app.js`, `vercel.json`, `test/static.test.js`
- Modify: `index.html:110-114`, `en.html:110-114` (satır içi `<script>` bloğu)

**Interfaces:**
- Produces: `app.js` (service worker kaydı). Task 5–6'daki sayfalar `<script src="app.js" defer></script>` ile kullanır.

- [ ] **Step 1: Write the failing tests**

`test/static.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const htmlFiles = () => fs.readdirSync(root).filter(f => f.endsWith('.html'));

test('vercel.json sets the security headers for every path', () => {
  const config = JSON.parse(read('vercel.json'));
  const rule = config.headers.find(h => h.source === '/(.*)');
  const headers = Object.fromEntries(rule.headers.map(h => [h.key, h.value]));
  assert.equal(headers['Content-Security-Policy'], [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://volkan-gozen-bizcard.vercel.app",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; '));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
  assert.equal(headers['X-Frame-Options'], 'DENY');
});

test('no HTML page has an inline script', () => {
  for (const file of htmlFiles()) {
    const inline = read(file).match(/<script(?![^>]*\bsrc=)[^>]*>/g);
    assert.equal(inline, null, `${file} has an inline <script>`);
  }
});

test('every HTML page loads app.js', () => {
  for (const file of htmlFiles()) {
    assert.match(read(file), /<script src="app\.js" defer><\/script>/, file);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL with `ENOENT ... vercel.json` and `index.html has an inline <script>`

- [ ] **Step 3: Create `app.js`**

```js
// BizCard: çevrimdışı çalışma için service worker kaydı.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
```

- [ ] **Step 4: Replace the inline script in `index.html` and `en.html`**

In both files replace:

```html
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
</script>
```

with:

```html
<script src="app.js" defer></script>
```

- [ ] **Step 5: Create `vercel.json`**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://volkan-gozen-bizcard.vercel.app; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 29 tests

- [ ] **Step 7: Check the card still renders**

Run: `python3 -m http.server 8080` in the repo root, open `http://localhost:8080/` and `http://localhost:8080/en.html`.
Expected: Card looks the same as before; DevTools → Application → Service Workers shows `sw.js` registered. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add app.js vercel.json test/static.test.js index.html en.html
git commit -m "Move service worker registration to app.js and add security headers"
```

---

### Task 5: Ortak stil ve Gizlilik / Aydınlatma sayfaları

**Files:**
- Create: `pages.css`, `gizlilik.html`, `privacy.html`
- Test: `test/static.test.js` (Task 4 testleri yeni sayfaları da kapsar; ek test aşağıda)

**Interfaces:**
- Produces: `pages.css` sınıfları — `.page` (kart), `.lang` (dil düğmesi), `.back` (geri linki), `.prose` (uzun metin), `.field`, `.check`, `.hp`, `.btn`, `.status[data-kind]`. Task 6 bunları kullanır.

- [ ] **Step 1: Write the failing test** (append to `test/static.test.js`)

```js
test('privacy pages exist, cross-link and name the controller and processors', () => {
  for (const [file, other] of [['gizlilik.html', 'privacy.html'], ['privacy.html', 'gizlilik.html']]) {
    const html = read(file);
    assert.match(html, new RegExp(`href="${other}"`), `${file} links to ${other}`);
    assert.match(html, /Volkan Gözen/);
    assert.match(html, /vgozen44@gmail\.com/);
    assert.match(html, /Vercel/);
    assert.match(html, /Resend/);
    assert.match(html, /<link rel="stylesheet" href="pages\.css">/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/`
Expected: FAIL with `ENOENT ... gizlilik.html`

- [ ] **Step 3: Create `pages.css`**

```css
/* BizCard alt sayfaları (iletişim, gizlilik) — ana kartın renkleri, gömülü font yok. */
:root{
  --ink:#1F2E24;--ink-soft:#4B5D50;--paper:#F6F1E6;--line:#D8CBAA;
  --pine:#233D2C;--amber:#C17817;--amber-soft:#F0DAB8;--white:#FFFDF8;
  --ok:#2F6B3A;--err:#A3361F;
}
*{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{margin:0;min-height:100vh;min-height:100dvh;background:var(--paper);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;
  display:flex;justify-content:center;padding:20px 16px calc(20px + env(safe-area-inset-bottom));-webkit-font-smoothing:antialiased;}
a{color:var(--pine);}
.page{position:relative;width:100%;max-width:560px;background:var(--white);border:1px solid var(--line);border-radius:24px;padding:24px 20px 28px;}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.back{display:inline-flex;align-items:center;min-height:40px;font-weight:600;text-decoration:none;}
.lang{display:inline-flex;padding:3px;border-radius:999px;background:var(--paper);border:1px solid var(--line);}
.lang a{display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:30px;padding:0 10px;border-radius:999px;
  font-size:12px;font-weight:700;letter-spacing:.06em;text-decoration:none;color:var(--ink-soft);}
.lang a[aria-current="page"]{background:var(--amber);color:var(--pine);}
h1{font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:var(--pine);margin:18px 0 6px;}
h2{font-family:Georgia,'Times New Roman',serif;font-size:19px;color:var(--pine);margin:26px 0 6px;}
.lead{color:var(--ink-soft);margin:0 0 18px;}
.prose p,.prose li{margin:0 0 10px;}
.prose ul{padding-left:20px;margin:0 0 10px;}
.meta{font-size:13px;color:var(--ink-soft);margin-top:28px;}
.field{display:block;margin:0 0 16px;}
.field span{display:block;font-weight:600;margin-bottom:6px;}
.field input,.field textarea{width:100%;font:inherit;font-size:16px;color:var(--ink);background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:11px 12px;}
.field textarea{min-height:140px;resize:vertical;}
.field input:focus,.field textarea:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px var(--amber-soft);}
.check{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:4px 0 20px;}
.check input{width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--pine);}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
.btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:999px;
  background:var(--pine);color:var(--white);font:inherit;font-weight:700;font-size:16px;cursor:pointer;}
.btn:hover{background:var(--amber);color:var(--pine);}
.btn:disabled{opacity:.6;cursor:wait;}
.status{min-height:24px;margin:14px 0 0;font-weight:600;}
.status[data-kind="success"]{color:var(--ok);}
.status[data-kind="error"]{color:var(--err);}
a:focus-visible,.btn:focus-visible{outline:3px solid var(--amber);outline-offset:3px;}
```

- [ ] **Step 4: Create `gizlilik.html`**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F1E6">
<title>Gizlilik ve KVKK Aydınlatma Metni — BizCard</title>
<meta name="description" content="Dr. Volkan Gözen BizCard iletişim formu kişisel verilerin korunması aydınlatma metni.">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main class="page">
  <div class="top">
    <a class="back" href="./">← Kartvizit</a>
    <nav class="lang" aria-label="Dil seçimi">
      <a href="gizlilik.html" lang="tr" hreflang="tr" aria-current="page">TR</a>
      <a href="privacy.html" lang="en" hreflang="en">EN</a>
    </nav>
  </div>
  <h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
  <p class="lead">6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, iletişim formu ile paylaştığınız veriler hakkında sizi bilgilendiririz.</p>
  <div class="prose">
    <h2>1. Veri sorumlusu</h2>
    <p>Dr. Volkan Gözen, Antalya, Türkiye. İletişim: <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a></p>

    <h2>2. İşlenen veriler</h2>
    <ul>
      <li>Ad soyad</li>
      <li>E-posta adresi</li>
      <li>Mesaj içeriği</li>
      <li>IP adresi: yalnızca kötüye kullanımı önlemek için, kısa süre bellekte tutulur, kaydedilmez ve e-postaya eklenmez.</li>
    </ul>

    <h2>3. İşleme amacı</h2>
    <p>Verileriniz yalnızca mesajınızı almak ve size yanıt vermek için işlenir. Pazarlama veya başka bir amaçla kullanılmaz.</p>

    <h2>4. Hukuki sebep</h2>
    <p>Verileriniz, formu göndermeden önce verdiğiniz açık rızaya (KVKK md. 5/1) dayanarak işlenir.</p>

    <h2>5. Aktarım ve yurt dışı aktarım</h2>
    <p>Mesajınız, size iletilmek üzere aşağıdaki hizmet sağlayıcıların ABD'deki sunucularından geçer. Bu aktarım, verdiğiniz açık rızaya (KVKK md. 9) dayanır:</p>
    <ul>
      <li>Vercel Inc. — sitenin ve form sunucusunun barındırılması</li>
      <li>Resend — mesajın e-posta olarak iletilmesi</li>
    </ul>
    <p>Mesajınız ayrıca veri sorumlusunun Gmail (Google) e-posta kutusunda saklanır.</p>

    <h2>6. Saklama süresi</h2>
    <p>Site ve form sunucusu mesajınızı saklamaz. Mesaj, veri sorumlusunun e-posta kutusunda en fazla 2 yıl tutulur, sonra silinir.</p>

    <h2>7. Haklarınız</h2>
    <p>KVKK md. 11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı kişileri bilme, düzeltilmesini veya silinmesini isteme, itiraz etme ve zarara uğramanız hâlinde tazminat talep etme haklarına sahipsiniz.</p>

    <h2>8. Başvuru ve rızanın geri alınması</h2>
    <p>Haklarınızı kullanmak veya rızanızı geri almak için <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a> adresine yazabilirsiniz. Başvurunuz en geç 30 gün içinde yanıtlanır.</p>

    <h2>9. Çerezler ve takip</h2>
    <p>Kartvizit çerez kullanmaz ve ziyaretçi takibi yapmaz. Sayfalar yalnızca çevrimdışı çalışma için tarayıcınızın önbelleğine kaydedilir.</p>
  </div>
  <p class="meta">Son güncelleme: 11 Ekim 2026</p>
</main>
<script src="app.js" defer></script>
</body>
</html>
```

- [ ] **Step 5: Create `privacy.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F1E6">
<title>Privacy Notice — BizCard</title>
<meta name="description" content="Privacy notice for the contact form on Volkan Gözen, Ph.D.'s BizCard.">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main class="page">
  <div class="top">
    <a class="back" href="en.html">← Business card</a>
    <nav class="lang" aria-label="Language">
      <a href="gizlilik.html" lang="tr" hreflang="tr">TR</a>
      <a href="privacy.html" lang="en" hreflang="en" aria-current="page">EN</a>
    </nav>
  </div>
  <h1>Privacy Notice</h1>
  <p class="lead">This notice explains how the data you share through the contact form is processed under Turkish Law No. 6698 on the Protection of Personal Data (KVKK).</p>
  <div class="prose">
    <h2>1. Data controller</h2>
    <p>Volkan Gözen, Ph.D., Antalya, Türkiye. Contact: <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a></p>

    <h2>2. Data processed</h2>
    <ul>
      <li>Full name</li>
      <li>Email address</li>
      <li>Message content</li>
      <li>IP address: only to prevent abuse; held briefly in memory, never stored and never added to the email.</li>
    </ul>

    <h2>3. Purpose</h2>
    <p>Your data is processed only to receive your message and reply to you. It is not used for marketing or any other purpose.</p>

    <h2>4. Legal basis</h2>
    <p>Your explicit consent, given before you send the form (KVKK Art. 5/1).</p>

    <h2>5. Transfers, including abroad</h2>
    <p>To reach the controller, your message passes through servers in the USA run by the providers below. This transfer is based on your explicit consent (KVKK Art. 9):</p>
    <ul>
      <li>Vercel Inc. — hosting of the site and the form server</li>
      <li>Resend — delivery of the message by email</li>
    </ul>
    <p>Your message is also stored in the controller's Gmail (Google) mailbox.</p>

    <h2>6. Retention</h2>
    <p>The site and form server do not store your message. The message is kept in the controller's mailbox for at most 2 years and then deleted.</p>

    <h2>7. Your rights</h2>
    <p>Under KVKK Art. 11 you may learn whether your data is processed, request information about it and its purpose, learn who it was transferred to, ask for correction or deletion, object, and claim compensation for damage.</p>

    <h2>8. Requests and withdrawing consent</h2>
    <p>To use your rights or withdraw consent, write to <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a>. Requests are answered within 30 days.</p>

    <h2>9. Cookies and tracking</h2>
    <p>The business card uses no cookies and does not track visitors. Pages are saved in your browser cache only so they work offline.</p>
  </div>
  <p class="meta">Last updated: 11 October 2026</p>
</main>
<script src="app.js" defer></script>
</body>
</html>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 30 tests

- [ ] **Step 7: Check at phone width**

Run: `python3 -m http.server 8080`, open `http://localhost:8080/gizlilik.html` and `/privacy.html` with DevTools device toolbar at 360 px width.
Expected: no horizontal scroll; TR/EN switch and "←" link work. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add pages.css gizlilik.html privacy.html test/static.test.js
git commit -m "Add shared page styles and KVKK privacy notice (TR/EN)"
```

---

### Task 6: İletişim formu sayfaları ve `form.js`

**Files:**
- Create: `iletisim.html`, `contact.html`, `form.js`
- Test: `test/static.test.js`

**Interfaces:**
- Consumes: `pages.css` sınıfları (Task 5), `/api/contact` sözleşmesi (Task 2): istek `{ name, email, message, website, consent: boolean, lang: 'tr'|'en' }`, yanıt `{ ok: true }` veya `{ ok: false, field?: string|null, error: string }`
- Produces: `form#contact-form` with `data-msg-sending`, `data-msg-success`, `data-msg-offline`, `data-msg-error`; `p#form-status`

- [ ] **Step 1: Write the failing test** (append to `test/static.test.js`)

```js
test('contact pages have the form, consent and privacy link', () => {
  for (const [file, privacy] of [['iletisim.html', 'gizlilik.html'], ['contact.html', 'privacy.html']]) {
    const html = read(file);
    assert.match(html, /<form id="contact-form"/, file);
    for (const name of ['name', 'email', 'message', 'website', 'consent']) {
      assert.match(html, new RegExp(`name="${name}"`), `${file} has ${name}`);
    }
    assert.match(html, /name="consent"[^>]*required/, `${file} consent is required`);
    assert.match(html, new RegExp(`href="${privacy}"`), `${file} links ${privacy}`);
    assert.match(html, /<script src="form\.js" defer><\/script>/, file);
    for (const key of ['sending', 'success', 'offline', 'error']) {
      assert.match(html, new RegExp(`data-msg-${key}="[^"]+"`), `${file} has data-msg-${key}`);
    }
  }
});

test('form.js uses the absolute API only on GitHub Pages', () => {
  const js = read('form.js');
  assert.match(js, /location\.hostname === 'vlkgzn\.github\.io'/);
  assert.match(js, /'https:\/\/volkan-gozen-bizcard\.vercel\.app\/api\/contact'/);
  assert.match(js, /'\/api\/contact'/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL with `ENOENT ... iletisim.html`

- [ ] **Step 3: Create `form.js`**

```js
// BizCard iletişim formu: JSON olarak /api/contact'a gönderir.
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const text = form.dataset;
  // GitHub Pages sunucu kodu çalıştıramaz; orada Vercel'deki API kullanılır.
  const endpoint = location.hostname === 'vlkgzn.github.io'
    ? 'https://volkan-gozen-bizcard.vercel.app/api/contact'
    : '/api/contact';

  function show(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    if (!navigator.onLine) {
      show(text.msgOffline, 'error');
      return;
    }
    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      email: data.get('email'),
      message: data.get('message'),
      website: data.get('website'),
      consent: data.get('consent') === 'on',
      lang: document.documentElement.lang === 'en' ? 'en' : 'tr'
    };
    button.disabled = true;
    show(text.msgSending, 'info');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const reply = await res.json().catch(() => ({}));
      if (res.ok && reply.ok) {
        form.reset();
        show(text.msgSuccess, 'success');
      } else {
        show(reply.error || text.msgError, 'error');
        const field = reply.field && form.elements[reply.field];
        if (field) field.focus();
      }
    } catch {
      show(text.msgOffline, 'error');
    } finally {
      button.disabled = false;
    }
  });
})();
```

- [ ] **Step 4: Create `iletisim.html`**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F1E6">
<title>Mesaj Gönder — Dr. Volkan Gözen</title>
<meta name="description" content="Dr. Volkan Gözen'e mesaj gönderin.">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main class="page">
  <div class="top">
    <a class="back" href="./">← Kartvizit</a>
    <nav class="lang" aria-label="Dil seçimi">
      <a href="iletisim.html" lang="tr" hreflang="tr" aria-current="page">TR</a>
      <a href="contact.html" lang="en" hreflang="en">EN</a>
    </nav>
  </div>
  <h1>Mesaj Gönder</h1>
  <p class="lead">Bir proje konuşmak ya da tanışmak isterseniz yazın. En kısa sürede yanıt veririm.</p>
  <form id="contact-form" novalidate
        data-msg-sending="Gönderiliyor…"
        data-msg-success="Teşekkürler, mesajınız ulaştı. En kısa sürede yanıt vereceğim."
        data-msg-offline="İnternet bağlantısı yok. Lütfen sonra tekrar deneyin."
        data-msg-error="Mesaj gönderilemedi. Lütfen sonra tekrar deneyin.">
    <label class="field"><span>Ad Soyad</span>
      <input name="name" type="text" autocomplete="name" required minlength="2" maxlength="100">
    </label>
    <label class="field"><span>E-posta</span>
      <input name="email" type="email" autocomplete="email" required maxlength="200">
    </label>
    <label class="field"><span>Mesaj</span>
      <textarea name="message" required minlength="10" maxlength="2000"></textarea>
    </label>
    <div class="hp" aria-hidden="true">
      <label>Web sitesi <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
    </div>
    <label class="check">
      <input name="consent" type="checkbox" required>
      <span><a href="gizlilik.html">Aydınlatma Metni</a>'ni okudum. Mesajımın yanıtlanması için kişisel verilerimin işlenmesine ve bu amaçla yurt dışındaki sunuculara (Vercel Inc., Resend — ABD) aktarılmasına açık rıza veriyorum.</span>
    </label>
    <button class="btn" type="submit">Gönder</button>
    <p id="form-status" class="status" role="status" aria-live="polite"></p>
  </form>
  <noscript><p>Form için JavaScript gerekir. Bunun yerine <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a> adresine yazabilirsiniz.</p></noscript>
</main>
<script src="app.js" defer></script>
<script src="form.js" defer></script>
</body>
</html>
```

Not: `novalidate` tarayıcının kendi balonlarını kapatmaz çünkü `form.js` `reportValidity()` çağırır; JS yoksa form zaten gönderilmez.

- [ ] **Step 5: Create `contact.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F1E6">
<title>Send a Message — Volkan Gözen, Ph.D.</title>
<meta name="description" content="Send a message to Volkan Gözen, Ph.D.">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="stylesheet" href="pages.css">
</head>
<body>
<main class="page">
  <div class="top">
    <a class="back" href="en.html">← Business card</a>
    <nav class="lang" aria-label="Language">
      <a href="iletisim.html" lang="tr" hreflang="tr">TR</a>
      <a href="contact.html" lang="en" hreflang="en" aria-current="page">EN</a>
    </nav>
  </div>
  <h1>Send a Message</h1>
  <p class="lead">Want to discuss a project or just say hello? Write to me and I'll reply as soon as I can.</p>
  <form id="contact-form" novalidate
        data-msg-sending="Sending…"
        data-msg-success="Thank you, your message has arrived. I'll reply soon."
        data-msg-offline="No internet connection. Please try again later."
        data-msg-error="Your message could not be sent. Please try again later.">
    <label class="field"><span>Full name</span>
      <input name="name" type="text" autocomplete="name" required minlength="2" maxlength="100">
    </label>
    <label class="field"><span>Email</span>
      <input name="email" type="email" autocomplete="email" required maxlength="200">
    </label>
    <label class="field"><span>Message</span>
      <textarea name="message" required minlength="10" maxlength="2000"></textarea>
    </label>
    <div class="hp" aria-hidden="true">
      <label>Website <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
    </div>
    <label class="check">
      <input name="consent" type="checkbox" required>
      <span>I have read the <a href="privacy.html">Privacy Notice</a>. I give explicit consent to the processing of my personal data to answer my message, and to its transfer for this purpose to servers abroad (Vercel Inc., Resend — USA).</span>
    </label>
    <button class="btn" type="submit">Send</button>
    <p id="form-status" class="status" role="status" aria-live="polite"></p>
  </form>
  <noscript><p>This form needs JavaScript. You can write to <a href="mailto:vgozen44@gmail.com">vgozen44@gmail.com</a> instead.</p></noscript>
</main>
<script src="app.js" defer></script>
<script src="form.js" defer></script>
</body>
</html>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 32 tests

- [ ] **Step 7: Manual browser check (no API yet)**

Run: `python3 -m http.server 8080`, open `http://localhost:8080/iletisim.html` at 360 px width.
Expected:
- Empty submit → browser shows "required" message on Ad Soyad; nothing is sent (Network tab empty).
- All fields filled, consent unticked → browser stops on the checkbox.
- All valid → button greys out during the request, then status shows the server/404 error text in red (no API locally); button is enabled again.
- DevTools → Network → Offline, submit → "İnternet bağlantısı yok…" message.
- Double-click "Gönder" quickly → Network shows only one request.
Stop the server.

- [ ] **Step 8: Commit**

```bash
git add iletisim.html contact.html form.js test/static.test.js
git commit -m "Add contact form pages (TR/EN) with KVKK consent"
```

---

### Task 7: Kartvizitten linkler, service worker ve belgeler

**Files:**
- Modify: `index.html` (CSS `<style>` sonu ve `</section>` sonrası), `en.html` (aynı yerler), `sw.js:3-19` ve `sw.js:33-35`, `README.md`
- Test: `test/static.test.js`

**Interfaces:**
- Consumes: sayfa dosya adları (Task 5–6), `app.js`, `form.js`, `pages.css`

- [ ] **Step 1: Write the failing tests** (append to `test/static.test.js`)

```js
test('card pages link to the contact and privacy pages', () => {
  assert.match(read('index.html'), /<a class="cta" href="iletisim\.html">Mesaj Gönder<\/a>/);
  assert.match(read('index.html'), /<a href="gizlilik\.html">Gizlilik<\/a>/);
  assert.match(read('en.html'), /<a class="cta" href="contact\.html">Send a Message<\/a>/);
  assert.match(read('en.html'), /<a href="privacy\.html">Privacy<\/a>/);
});

test('service worker caches every new file, skips /api/ and is bumped to v2', () => {
  const sw = read('sw.js');
  assert.match(sw, /const VERSION = 'bizcard-v2';/);
  for (const file of ['app.js', 'form.js', 'pages.css', 'iletisim.html', 'contact.html', 'gizlilik.html', 'privacy.html']) {
    assert.match(sw, new RegExp(`'${file.replace('.', '\\.')}'`), `sw.js caches ${file}`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
  }
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL on both new tests

- [ ] **Step 3: Add the CSS to both card pages**

In `index.html` and `en.html`, insert directly before `</style>`:

```css
.cta{position:relative;display:flex;align-items:center;justify-content:center;min-height:48px;margin-top:14px;border-radius:999px;background:var(--amber);color:var(--pine);font-weight:700;font-size:15px;}
.cta:hover,.cta:active{background:var(--amber-soft);}
.foot{position:relative;margin:14px 0 0;font-size:12.5px;opacity:.75;}
.foot a{text-decoration:underline;text-underline-offset:3px;}
```

- [ ] **Step 4: Add the links to both card pages**

In `index.html`, directly after `  </section>` (end of the `.qr` section), insert:

```html
  <a class="cta" href="iletisim.html">Mesaj Gönder</a>
  <p class="foot"><a href="gizlilik.html">Gizlilik</a></p>
```

In `en.html`, directly after `  </section>`, insert:

```html
  <a class="cta" href="contact.html">Send a Message</a>
  <p class="foot"><a href="privacy.html">Privacy</a></p>
```

- [ ] **Step 5: Update `sw.js`**

Replace lines 3–19 (the `VERSION` and `ASSETS` declarations) with:

```js
const VERSION = 'bizcard-v2';
const ASSETS = [
  './',
  'index.html',
  'en.html',
  'iletisim.html',
  'contact.html',
  'gizlilik.html',
  'privacy.html',
  'app.js',
  'form.js',
  'pages.css',
  'logo.svg',
  'logo.png',
  'apple-touch-icon.png',
  'volkan-gozen.vcf',
  'volkan-gozen-en.vcf',
  'manifest.webmanifest',
  'manifest-en.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png'
];
```

Replace the first two lines of the `fetch` listener body:

```js
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
```

with:

```js
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Form API'si asla önbelleğe alınmaz.
  if (url.pathname.startsWith('/api/')) return;
```

- [ ] **Step 6: Update `README.md`**

Add a row for each new file to the "Dosyalar" table:

```markdown
| `iletisim.html`, `contact.html` | İletişim formu (TR / EN) |
| `gizlilik.html`, `privacy.html` | KVKK Aydınlatma Metni / Privacy Notice |
| `pages.css` | Alt sayfaların ortak stili |
| `app.js`, `form.js` | Service worker kaydı ve form gönderimi |
| `api/contact.js`, `api/_lib/` | Vercel'de çalışan form sunucusu (Resend ile e-posta) |
| `vercel.json` | Güvenlik başlıkları |
| `test/` | Testler: `node --test test/` |
```

Append this section at the end:

```markdown
## İletişim formu

Form mesajları Vercel'deki `api/contact.js` üzerinden Resend ile e-posta olarak gelir. GitHub Pages sunucu kodu çalıştıramadığı için oradaki form da Vercel adresine gönderir.

Vercel → Settings → Environment Variables (Production ve Preview):

| Ad | Değer |
| --- | --- |
| `RESEND_API_KEY` | Resend panelinden alınan anahtar |
| `CONTACT_TO` | Mesajların geleceği e-posta |

Yerel deneme için `.env.example` dosyasını `.env.local` olarak kopyalayın (commit edilmez).
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS, 34 tests

- [ ] **Step 8: Check the card at phone width**

Run: `python3 -m http.server 8080`, open `http://localhost:8080/` and `/en.html` at 360 px and at 360×640 (short screen).
Expected: "Mesaj Gönder" button under the QR box, small "Gizlilik" link below it, no horizontal scroll; links open the right pages. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add index.html en.html sw.js README.md test/static.test.js
git commit -m "Link contact and privacy pages from the card; cache them offline"
```

---

### Task 8: Yayın ve canlı doğrulama

Bu görevin bir kısmını kullanıcı yapar (hesaplar, Vercel ayarları). Kod değişikliği yoktur; yalnızca kontrol listesi işaretlenir.

**Files:**
- Modify: `GUVENLIK-KONTROL-LISTESI.md`

- [ ] **Step 1: User — Resend account and key**

1. https://resend.com/signup adresinde `vgozen44@gmail.com` ile hesap açın.
2. Sol menü → "API Keys" → "Create API Key". Ad: `bizcard`. Permission: "Sending access". Oluşan `re_...` anahtarını kopyalayın. Bir daha gösterilmez.

- [ ] **Step 2: User — Vercel environment variables**

Vercel → `volkan-gozen-bizcard` projesi → Settings → Environment Variables. İki değişken ekleyin; her birinde "Production" ve "Preview" kutularını işaretleyin:
- `RESEND_API_KEY` = (kopyalanan anahtar)
- `CONTACT_TO` = `vgozen44@gmail.com`

- [ ] **Step 3: Push the branch (needs user OK) and test on Preview**

```bash
git push -u origin iletisim-formu
```

Vercel dalı otomatik yayınlar. Preview adresini Vercel → Deployments listesinden alın. Preview adresleri Vercel girişi ister (Deployment Protection); test tarayıcıda, Vercel'e girişliyken yapılır:
- `/iletisim.html` ve `/contact.html` üzerinden birer mesaj gönderin.
Expected: "Teşekkürler…" görünür; Gmail'e "BizCard mesajı: …" konulu iki e-posta gelir; "Yanıtla" ziyaretçi adresine gider.

- [ ] **Step 4: Merge to main (needs user OK)**

```bash
git checkout main
git pull --ff-only
git merge --ff-only iletisim-formu
node --test test/
git push origin main
```

Expected: tests PASS; Vercel production and GitHub Pages update within ~2 minutes.

- [ ] **Step 5: Live abuse tests on production**

```bash
API=https://volkan-gozen-bizcard.vercel.app/api/contact
O='Origin: https://vlkgzn.github.io'
J='Content-Type: application/json'
curl -s -o /dev/null -w '%{http_code}\n' "$API"                                                   # 405
curl -s -w ' %{http_code}\n' -H "$J" -H 'Origin: https://evil.example' -d '{}' "$API"              # 403
curl -s -w ' %{http_code}\n' -H "$J" -H "$O" -d '{"name":"Test Kişi","email":"bad","message":"Bu bir deneme mesajıdır.","consent":true}' "$API"   # 400 field email
curl -s -w ' %{http_code}\n' -H "$J" -H "$O" -d '{"name":"Test Kişi","email":"t@example.com","message":"Bu bir deneme mesajıdır.","consent":false}' "$API"   # 400 field consent
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -D - -H "$J" -H "$O" -d '{"website":"x"}' "$API" | grep -iE '^HTTP|retry-after'; done   # 5× 200, 6th 429 + Retry-After
curl -sI https://volkan-gozen-bizcard.vercel.app/ | grep -iE 'content-security|nosniff|referrer-policy|permissions-policy|x-frame'
```

Expected: codes as in the comments; all five security headers printed. The 6 requests use the honeypot, so no email is sent. Note: rate limit is per function instance, so the 429 may need one more repeat if Vercel routes to a second instance.

- [ ] **Step 6: Live check from GitHub Pages and the phone**

- `https://vlkgzn.github.io/BizCard/iletisim.html` → send one message. Expected: arrives in Gmail.
- Phone PWA: open the app; close and reopen it once so the `bizcard-v2` service worker takes over; tap "Mesaj Gönder"; send one message. Expected: arrives in Gmail.
- Phone in airplane mode → open app → card and form page open from cache; submit shows the offline message.

- [ ] **Step 7: Secret check in history**

Run: `git log -p --all | grep -iE 're_[A-Za-z0-9]{8,}|RESEND_API_KEY=.+'`
Expected: no output.

- [ ] **Step 8: Tick the checklist and commit**

Tick every item in `GUVENLIK-KONTROL-LISTESI.md` that the steps above verified (leave "hukukçu" unticked unless the user confirms).

```bash
git add GUVENLIK-KONTROL-LISTESI.md
git commit -m "Tick security checklist after live verification"
git push origin main
```
