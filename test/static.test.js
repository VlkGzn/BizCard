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
