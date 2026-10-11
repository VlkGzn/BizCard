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
