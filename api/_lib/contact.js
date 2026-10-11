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
