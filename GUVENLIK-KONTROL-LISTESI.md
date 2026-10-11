# BizCard — deploy öncesi güvenlik kontrol listesi

Tarih: 11 Ekim 2026 · Dal: `iletisim-formu`
Tasarım: `docs/superpowers/specs/2026-10-11-iletisim-formu-design.md`

## Secret ve konfigürasyon

- [x] `RESEND_API_KEY` ve `CONTACT_TO` kodda yok, `.env.local` içinde
- [x] `.gitignore` içinde `.env*` var, `.env.example` commit ediliyor
- [x] Değişkenler Vercel'e eklendi (Production + Preview, aynı değerler)
- [x] Tarayıcıya giden dosyalarda (`*.html`, `app.js`, `form.js`) secret yok
- [x] Git geçmişinde eskiden commit edilmiş secret yok (11 Ekim 2026'da kontrol edildi)

## API ve veri

- [x] Form doğrudan Resend'e değil, `/api/contact` üzerinden gidiyor
- [x] Sunucu tarafı doğrulama: ad, e-posta, mesaj, rıza
- [x] Sadece `POST` (ve `OPTIONS`) kabul ediliyor, diğerleri `405`
- [x] CORS: yalnızca GitHub Pages, Vercel ve aynı origin; diğerleri `403`
- [x] Gövde en fazla 10 KB
- [x] Hata mesajları teknik detay sızdırmıyor; loglarda mesaj içeriği ve e-posta yok

## Kötüye kullanım

- [x] Rate limit: IP başına dakikada 5 istek, aşımda `429` + `Retry-After`
- [x] Not: bellek içi limit serverless'ta örnek başına çalışır (kişisel site için yeterli)
- [x] Tuzak alan (`website`) doluysa e-posta gönderilmiyor
- [x] Alan uzunluk sınırları: ad 100, e-posta 200, mesaj 2000

## Yetkilendirme

- [x] Yönetici paneli yok, JWT gerekmiyor — bilinçli karar

## Tarayıcı güvenliği

- [x] `vercel.json`: CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`
- [x] Satır içi script kalmadı (`app.js`'e taşındı)
- [x] Service worker `/api/` isteklerini önbelleğe almıyor

## KVKK

- [x] Form sayfalarında açık rıza kutusu var (yurt dışı aktarım dahil)
- [x] Rıza işaretsizse sunucu `400` ile reddediyor
- [x] Aydınlatma Metni yayında (TR + EN), formdan ve kartvizitten erişilebiliyor
- [x] Toplanan alanlar minimumda: ad, e-posta, mesaj
- [x] Saklama süresi metinde yazılı (2 yıl)
- [x] Veri sorumlusu bilgileri gerçek (Dr. Volkan Gözen, Antalya, `vgozen44@gmail.com`)
- [ ] Metin hukukçuya kontrol ettirildi (önerilir)

## Deploy sonrası

- [x] Vercel Preview adresinden mesaj gönderildi, Gmail'e geldi (11 Ekim 2026)
- [x] GitHub Pages adresinden mesaj gönderildi, Gmail'e geldi (telefondaki PWA, 11 Ekim 2026)
- [ ] Gmail'de "Yanıtla" ziyaretçinin adresine gidiyor
- [x] Arka arkaya isteklerde `429` + `Retry-After` alındı (11 Ekim 2026, canlı)
- [x] Geçersiz e-posta ile `400` ve alan hatası döndü
- [x] Rıza işaretsiz istek `400` döndü
- [x] `GET /api/contact` → `405`
- [x] Güvenlik başlıkları `curl -sI` ile görüldü
- [x] Telefondaki PWA'dan form denendi, mesaj geldi (bizcard-v3, 11 Ekim 2026)
