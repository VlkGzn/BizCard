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
