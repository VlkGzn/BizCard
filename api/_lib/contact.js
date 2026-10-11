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

const ALLOWED_ORIGINS = ['https://vlkgzn.github.io', 'https://volkan-gozen-bizcard.vercel.app', 'https://www.volkangozen.com', 'https://volkangozen.com', 'https://kart.volkangozen.com'];
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
