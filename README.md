# BizCard — Dr. Volkan Gözen

Dr. Volkan Gözen, Antalya Batı Akdeniz Tarımsal Araştırma Enstitüsü'nde çalışan bir ziraat mühendisi ve sebze ıslahçısı. Hıyar ve brokoli üzerine çalışıyor, ıslah verisini analiz ederek yerli tohumun gücünü artırmayı amaçlıyor.

Tanışmak ya da bir proje konuşmak isterseniz kartvizitteki QR kodu taratın. Bilgileri tek dokunuşla rehberinize kaydedebilirsiniz.

**Kartvizit:** https://vlkgzn.github.io/BizCard/ · [English](https://vlkgzn.github.io/BizCard/en.html)

## Telefona uygulama olarak yükleme

BizCard bir PWA (Progressive Web App). Android'de Chrome ile siteyi açın, çıkan "Uygulamayı yükle" önerisine dokunun ya da ⋮ menüsünden "Ana ekrana ekle"yi seçin. Yüklendikten sonra kartvizit internet olmadan da açılır.

## Dosyalar

| Dosya | Açıklama |
| --- | --- |
| `index.html`, `en.html` | Türkçe ve İngilizce kartvizit sayfaları |
| `volkan-gozen.vcf`, `volkan-gozen-en.vcf` | Rehbere kaydedilecek kişi kartları |
| `manifest.webmanifest`, `manifest-en.webmanifest` | PWA ayarları (ad, renkler, ikonlar) |
| `sw.js` | Çevrimdışı çalışmayı sağlayan service worker |
| `icons/` | Android uygulama ikonları |
| `logo.svg`, `logo.png`, `apple-touch-icon.png`, `og-image*.png` | Logo ve paylaşım görselleri |
| `iletisim.html`, `contact.html` | İletişim formu (TR / EN) |
| `gizlilik.html`, `privacy.html` | KVKK Aydınlatma Metni / Privacy Notice |
| `pages.css` | Alt sayfaların ortak stili |
| `app.js`, `form.js` | Service worker kaydı ve form gönderimi |
| `api/contact.js`, `api/_lib/` | Vercel'de çalışan form sunucusu (Resend ile e-posta) |
| `vercel.json` | Güvenlik başlıkları |
| `test/` | Testler: `node --test test/*.test.js` |

## Güncelleme

Site GitHub Pages ile `main` dalından yayınlanır. Bir dosyayı değiştirdiğinizde `sw.js` içindeki `VERSION` değerini artırın (`bizcard-v1` → `bizcard-v2`), böylece yüklü uygulamalar yeni sürümü alır.

## İletişim formu

Form mesajları Vercel'deki `api/contact.js` üzerinden Resend ile e-posta olarak gelir. GitHub Pages sunucu kodu çalıştıramadığı için oradaki form da Vercel adresine gönderir.

Vercel → Settings → Environment Variables (Production ve Preview):

| Ad | Değer |
| --- | --- |
| `RESEND_API_KEY` | Resend panelinden alınan anahtar |
| `CONTACT_TO` | Mesajların geleceği e-posta |

Yerel deneme için `.env.example` dosyasını `.env.local` olarak kopyalayın (commit edilmez).
