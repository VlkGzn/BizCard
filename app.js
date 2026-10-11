// BizCard: çevrimdışı çalışma için service worker kaydı.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
