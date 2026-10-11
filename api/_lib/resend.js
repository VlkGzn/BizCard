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
