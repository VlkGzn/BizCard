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
