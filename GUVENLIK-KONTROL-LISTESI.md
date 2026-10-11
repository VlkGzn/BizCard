# BizCard — deploy öncesi güvenlik kontrol listesi

Tarih: 11 Ekim 2026 · Dal: `iletisim-formu`
Tasarım: `docs/superpowers/specs/2026-10-11-iletisim-formu-design.md`

## Secret ve konfigürasyon

- [ ] `RESEND_API_KEY` ve `CONTACT_TO` kodda yok, `.env.local` içinde
- [ ] `.gitignore` içinde `.env*` var, `.env.example` commit ediliyor
- [ ] Değişkenler Vercel'e eklendi (Production + Preview, aynı değerler)
- [ ] Tarayıcıya giden dosyalarda (`*.html`, `app.js`, `form.js`) secret yok
- [x] Git geçmişinde eskiden commit edilmiş secret yok (11 Ekim 2026'da kontrol edildi)

## API ve veri

- [ ] Form doğrudan Resend'e değil, `/api/contact` üzerinden gidiyor
- [ ] Sunucu tarafı doğrulama: ad, e-posta, mesaj, rıza
- [ ] Sadece `POST` (ve `OPTIONS`) kabul ediliyor, diğerleri `405`
- [ ] CORS: yalnızca GitHub Pages, Vercel ve aynı origin; diğerleri `403`
- [ ] Gövde en fazla 10 KB
- [ ] Hata mesajları teknik detay sızdırmıyor; loglarda mesaj içeriği ve e-posta yok

## Kötüye kullanım

- [ ] Rate limit: IP başına dakikada 5 istek, aşımda `429` + `Retry-After`
- [ ] Not: bellek içi limit serverless'ta örnek başına çalışır (kişisel site için yeterli)
- [ ] Tuzak alan (`website`) doluysa e-posta gönderilmiyor
- [ ] Alan uzunluk sınırları: ad 100, e-posta 200, mesaj 2000

## Yetkilendirme

- [x] Yönetici paneli yok, JWT gerekmiyor — bilinçli karar

## Tarayıcı güvenliği

- [ ] `vercel.json`: CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`
- [ ] Satır içi script kalmadı (`app.js`'e taşındı)
- [ ] Service worker `/api/` isteklerini önbelleğe almıyor

## KVKK

- [ ] Form sayfalarında açık rıza kutusu var (yurt dışı aktarım dahil)
- [ ] Rıza işaretsizse sunucu `400` ile reddediyor
- [ ] Aydınlatma Metni yayında (TR + EN), formdan ve kartvizitten erişilebiliyor
- [ ] Toplanan alanlar minimumda: ad, e-posta, mesaj
- [ ] Saklama süresi metinde yazılı (2 yıl)
- [ ] Veri sorumlusu bilgileri gerçek (Dr. Volkan Gözen, Antalya, `vgozen44@gmail.com`)
- [ ] Metin hukukçuya kontrol ettirildi (önerilir)

## Deploy sonrası

- [ ] Vercel adresinden mesaj gönderildi, Gmail'e geldi
- [ ] GitHub Pages adresinden mesaj gönderildi, Gmail'e geldi
- [ ] Gmail'de "Yanıtla" ziyaretçinin adresine gidiyor
- [ ] 6 istek arka arkaya gönderilip `429` alındı
- [ ] Geçersiz e-posta ile `400` ve alan hatası döndü
- [ ] Rıza işaretsiz istek `400` döndü
- [ ] `GET /api/contact` → `405`
- [ ] Güvenlik başlıkları `curl -sI` ile görüldü
- [ ] Telefondaki PWA'dan form denendi
