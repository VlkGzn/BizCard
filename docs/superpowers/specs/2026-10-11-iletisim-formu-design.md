# İletişim formu, KVKK rızası, gizlilik sayfası ve güvenlik başlıkları — tasarım

Tarih: 11 Ekim 2026 · Dal: `iletisim-formu`

## Amaç

Ziyaretçi BizCard üzerinden Dr. Volkan Gözen'e mesaj gönderebilsin. Mesaj
`vgozen44@gmail.com` adresine e-posta olarak gelsin. Veri toplama KVKK'ya uygun
olsun: aydınlatma metni, açık rıza (yurt dışı aktarım dahil), en az veri.

## Kapsam

1. İletişim formu sayfası (TR + EN)
2. Sunucu tarafı gönderim: Vercel Function + Resend
3. Gizlilik / KVKK Aydınlatma Metni sayfası (TR + EN)
4. `vercel.json` ile güvenlik başlıkları

Kapsam dışı: mesajları veritabanında saklamak, yönetim paneli, kalıcı (Redis)
rate limit, mevcut "İletişim" düğmesinin (dijital-kartvizit sitesine gider)
değiştirilmesi, canonical/og adreslerinin Vercel'e taşınması.

## Mevcut durum (kısıtlar)

- Site derleme adımı olmayan statik HTML. `index.html` ve `en.html` tek dosya,
  CSS satır içi `<style>`, fontlar `data:` URI olarak gömülü.
- Tek satır içi script var: service worker kaydı.
- `sw.js` yalnızca aynı origin `GET` isteklerine karışır; `POST` istekleri
  zaten dokunulmadan geçer.
- Site iki yerde yayında ve ikisi de `main` dalından beslenir:
  GitHub Pages (`https://vlkgzn.github.io/BizCard/`) ve Vercel
  (`https://volkan-gozen-bizcard.vercel.app`). Telefondaki PWA GitHub Pages
  adresinden kurulu. **GitHub Pages sunucu kodu çalıştıramaz.**

## Tasarım

### 1. Sayfalar

| Dosya | Dil | İçerik |
| --- | --- | --- |
| `iletisim.html` | TR | İletişim formu |
| `contact.html` | EN | Contact form |
| `gizlilik.html` | TR | KVKK Aydınlatma Metni |
| `privacy.html` | EN | Privacy Notice |

- Yeni sayfalar mevcut kart görünümünü kullanır (aynı renkler, aynı `.biz`
  kartı, aynı dil düğmesi). Fontlar tekrar gömülmez; yeni sayfalar sistem
  yazı tipine düşer, başlıklar Georgia. (Her sayfaya ~1 MB font gömmemek için.)
- `index.html` / `en.html`: QR bölümünün altına **"Mesaj Gönder" / "Send a
  Message"** düğmesi ve kartın en altına küçük **"Gizlilik" / "Privacy"**
  linki eklenir.
- Mevcut satır içi service worker scripti `app.js` dosyasına taşınır (CSP'de
  `script-src 'self'` kullanabilmek için).

### 2. Form

Alanlar:

| Alan | Kural |
| --- | --- |
| Ad Soyad | Zorunlu, 2–100 karakter |
| E-posta | Zorunlu, geçerli e-posta, en fazla 200 karakter |
| Mesaj | Zorunlu, 10–2000 karakter |
| KVKK onayı (checkbox) | Zorunlu, işaretli olmalı |
| `website` (gizli tuzak alan) | Boş olmalı; doluysa istek sessizce kabul edilmiş gibi yanıtlanır ama e-posta gönderilmez |

Onay kutusu metni (TR):

> [Aydınlatma Metni](gizlilik.html)'ni okudum. Mesajımın yanıtlanması için
> kişisel verilerimin işlenmesine ve bu amaçla yurt dışındaki sunuculara
> (Vercel Inc., Resend, Google — ABD) aktarılmasına açık rıza veriyorum.

Davranış:

- Gönderim `form.js` ile `fetch` (JSON `POST`) yapılır. Tarayıcı tarafı
  doğrulama yalnızca kullanıcı kolaylığı içindir; asıl kontrol sunucudadır.
- Gönderim adresi: sayfa `*.vercel.app` üzerindeyse aynı origin `/api/contact`
  (Production ve Preview kendi API'sini kullanır); `vlkgzn.github.io` üzerindeyse
  mutlak `https://volkan-gozen-bizcard.vercel.app/api/contact`. Böylece form
  GitHub Pages'te (ve oradan kurulu PWA'da) da çalışır.
- Durumlar: gönderiliyor (düğme kilitli), başarılı ("Teşekkürler, mesajınız
  ulaştı."), hata (sunucunun döndürdüğü kısa mesaj), çevrimdışı ("İnternet
  bağlantısı yok, sonra tekrar deneyin.").
- JavaScript kapalıysa form gönderilmez; kısa bir `<noscript>` notu
  e-posta ile yazmayı önerir.

### 3. Sunucu: `api/contact.js` (Vercel Function, Node.js)

Bağımlılık yok: Resend'e `fetch` ile doğrudan `POST https://api.resend.com/emails`.
Böylece `package.json` gerekmez ve Vercel ayarı "Other" olarak kalır.

Akış:

1. Yalnızca `POST` ve `OPTIONS` kabul edilir; diğerleri `405`.
2. CORS: yalnızca `https://vlkgzn.github.io` ve
   `https://volkan-gozen-bizcard.vercel.app` origin'lerine ve aynı origin
   isteklere (Origin, isteğin `Host` değeriyle aynıysa; Preview adresleri için)
   izin verilir. Başka origin → `403`.
3. Rate limit: IP başına dakikada 5 istek (bellek içi). Aşımda `429` +
   `Retry-After`. Not: serverless örnek başına çalışır; kişisel kartvizit
   trafiği için yeterli.
4. Gövde en fazla 10 KB; JSON değilse `400`.
5. Tuzak alan doluysa `200 {ok:true}` döner, e-posta gönderilmez.
6. Alan doğrulaması (tablodaki kurallar). Hata → `400` + alan adı ve kısa mesaj.
   Rıza yoksa `400`.
7. Resend'e e-posta:
   - `from`: `BizCard <onboarding@resend.dev>` (alan adı doğrulaması gerektirmez)
   - `to`: `CONTACT_TO` ortam değişkeni (`vgozen44@gmail.com`)
   - `reply_to`: ziyaretçinin e-postası
   - Konu: `BizCard mesajı: <Ad Soyad>`
   - Gövde: düz metin; ad, e-posta, mesaj, rıza zamanı (ISO), sayfa dili.
     IP adresi e-postaya yazılmaz.
8. Resend hata verirse `502` + genel mesaj; ayrıntı yalnızca sunucu loguna.
   Loglara mesaj içeriği ve e-posta adresi yazılmaz.

Ortam değişkenleri (Vercel → Settings → Environment Variables):

| Ad | Değer |
| --- | --- |
| `RESEND_API_KEY` | Resend panelinden alınan anahtar |
| `CONTACT_TO` | `vgozen44@gmail.com` |

Her iki değişken **Production ve Preview** ortamlarına aynı değerle eklenir.
Ayrı değer gerekmez: tek alıcı, kişisel site. Preview'a eklemek, dalı
canlıya almadan deneme adresinde test etmeyi sağlar.

Yerel geliştirme:

- `.env.local` (gerçek değerler, `npx vercel env pull` ile de alınabilir)
  commit edilmez; `.gitignore` içine `.env*` ve `!.env.example` eklenir.
- `.env.example` commit edilir; değişken adlarını boş değerle gösterir.

Not: Resend ücretsiz planda `onboarding@resend.dev` göndericisiyle yalnızca
hesap sahibinin e-postasına gönderim yapılabilir. Resend hesabı
`vgozen44@gmail.com` ile açılmalıdır.

### 4. Gizlilik / KVKK Aydınlatma Metni

Bölümler:

1. Veri sorumlusu: Dr. Volkan Gözen, Antalya; iletişim `vgozen44@gmail.com`
2. İşlenen veriler: ad soyad, e-posta, mesaj içeriği; teknik olarak IP adresi
   (yalnızca kötüye kullanımı önlemek için, kalıcı kaydedilmez)
3. Amaç: mesajı almak ve yanıtlamak
4. Hukuki sebep: açık rıza (KVKK md. 5/1)
5. Aktarım: Vercel Inc. (barındırma) ve Resend (e-posta iletimi), ABD —
   açık rızaya dayalı yurt dışı aktarım (KVKK md. 9)
6. Saklama: veri sitede veya sunucuda saklanmaz; e-posta kutusunda en fazla
   2 yıl tutulur, sonra silinir
7. Haklar: KVKK md. 11 hakları ve başvuru yolu (e-posta)
8. Rızanın geri alınması: e-posta ile
9. Kartvizitin kendisi çerez kullanmaz, ziyaretçi takibi yapmaz
10. Son güncelleme tarihi

Metin standart şablona göre yazılır; yayından önce hukukçu kontrolü önerilir.

### 5. `vercel.json`

Tüm yollar için başlıklar:

```
Content-Security-Policy: default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;
  connect-src 'self' https://volkan-gozen-bizcard.vercel.app;
  form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY
```

`style-src 'unsafe-inline'` gerekli: tüm CSS satır içi. Script tarafı satır içi
kod içermediği için katı kalır. GitHub Pages bu başlıkları uygulamaz (bilinen
kısıt).

### 6. Service worker

- `ASSETS` listesine yeni sayfalar ve `app.js`, `form.js` eklenir.
- `VERSION` `bizcard-v2` yapılır.
- `/api/` istekleri önbelleğe alınmaz (zaten `POST`; ek güvence olarak
  `/api/` yolu açıkça atlanır).

## Test

- `api/contact.js` için Node'un yerleşik test aracıyla (`node --test`) birim
  testleri: metot, CORS, rate limit, doğrulama, tuzak alan, Resend hatası
  (Resend `fetch` ile taklit edilir).
- Yerel: `npx vercel dev` ile form uçtan uca denenir (gerçek anahtarla).
- Canlı: Vercel ve GitHub Pages adreslerinden birer mesaj gönderilir, Gmail'e
  geldiği ve "Yanıtla"nın ziyaretçiye gittiği kontrol edilir.
- Canlı kötüye kullanım testleri:
  - 6 istek arka arkaya → 6.'sı `429` ve `Retry-After` başlığı
  - Geçersiz e-posta → `400` ve alan hatası
  - Rıza kutusu işaretsiz → `400`
  - `GET /api/contact` → `405`
  - Başka origin'den istek → `403`
- Başlıklar: `curl -sI https://volkan-gozen-bizcard.vercel.app/` ile kontrol.
- Git geçmişinde secret yok: `git log -p --all | grep -iE 're_[A-Za-z0-9]|api[_-]?key'`
  boş dönmeli.
- Telefonda PWA: form açılır ve gönderilir.

## Kullanıcının yapacakları

1. `vgozen44@gmail.com` ile ücretsiz Resend hesabı açmak, API anahtarı almak.
2. Vercel'de `RESEND_API_KEY` ve `CONTACT_TO` değişkenlerini eklemek.
3. KVKK metnini hukukçuya kontrol ettirmek (önerilir).
