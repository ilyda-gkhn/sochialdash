# SocialDash — yerel kurulum

Mevcut Express + SQLite + HTML/CSS/JavaScript yapısı ve sayfa tasarımı korunarak güncellenmiştir.

## İndirilebilir staj paketi

[SocialDash v2.0.0 sürümünü indir](https://github.com/ilyda-gkhn/sochialdash/releases/tag/v2.0.0). Assets bölümündeki `socialdash-staj-v2.0.0.zip` dosyasını seçin; paketi açıp `BASLA.md` dosyasını okuyun. Kaynaklar, dört staj belgesi ve kurulum kılavuzları birlikte sunulur. Social Manager projenin eski adıdır.

20 Ekim 2026 kontrolünde Node.js 26.8.2 üzerinde mevcut yerel bağımlılıklarla 18 test grubu ve 99 test geçti. Sıfırdan bağımlılık kurulumu, Windows ve canlı dış servisler ayrıca doğrulanmadı. Ayrıntılar: [STAJ-PAKETI.md](STAJ-PAKETI.md). GitHub’dan indirilen ZIP ve içindeki dosyaların SHA-256 özetleri doğrulandı.

Paket gerçek `.env` anahtarlarını, mevcut kullanıcı veritabanını veya `node_modules` içermez. Yeni kurulum boş veritabanı oluşturur. Mevcut kayıtların taşınması için özel veritabanı ve ayar yedeği ayrıca korunmalıdır.

## Mac üzerinde çalıştırma

ZIP dosyasını açın. Terminal'de `cd ` yazıp açılan `socialdash` klasörünü Terminal'e sürükleyin, Return'a basın. Node.js ve npm kurulu olmalıdır. Doğrulanan ortam: Node.js 26.8.2, npm 11.19.1.

```sh
npm ci
npm run setup
npm start
```

Tarayıcıda http://localhost:3000 adresini açın. Yeni kullanıcı oluşturun. Durdurmak için Terminal'de Control+C kullanın.

`npm run setup` rastgele güvenli anahtarlarla yerel `.env` oluşturur; mevcut `.env` dosyasını değiştirmez. Veritabanı ilk açılışta `socialdash.db` olarak oluşturulur; migration'lar otomatik uygulanır. Yüklenen dosyalar `uploads/` altında saklanır.

## Mevcut verileri taşımak

Eski sunucuyu durdurup veritabanınızı, uploads klasörünüzü ve .env dosyanızı yedekleyin. Mevcut veritabanı, uploads ve .env dosyalarını yeni proje klasörüne taşıyın. Şifrelenmiş sosyal hesap token'larını okuyabilmek için mevcut SOCIAL_TOKEN_ENCRYPTION_KEY değerini koruyun. Ardından yukarıdaki komutları çalıştırın. Pakette test kullanıcıları, test veritabanı veya kişisel servis anahtarları bulunmaz.

## Dış servisler

.env.example kullanılabilir ayarları açıklar. AI yanıtları için AI_API_KEY; haberler için NEWS_API_KEY; şifre sıfırlama e-postası için EMAIL_*; Google/Apple girişi ve sosyal hesap bağlantıları için ilgili sağlayıcı kimlik bilgileri gerekir. Push bildirimleri VAPID ayarlarını gerektirir. Meta'nın medya erişimi için halka açık HTTPS MEDIA_PUBLIC_BASE_URL gerekir. Yerel kayıt/giriş ve uygulama verileri bu harici servislerden bağımsız çalışır.

Canlı sağlayıcı hesaplarıyla uçtan uca yayınlama bu teslimde doğrulanmadı. Yapılandırılmamış servisler sahte başarı üretmez. Gelişmiş gönderi tercihleri kaydedilir; mevcut adaptörün desteklemediği etkin seçenekler yayınlamada açık hata verir. Bir gönderide platform başına bir hesap hedeflenir; aynı platformdaki birden fazla hesaba tek gönderide yayın desteklenmez. AI dosya eki TXT/MD/CSV/JSON metniyle sınırlıdır; görsel analizi desteklenmez.

Gönderi, medya ve AI sohbeti silme işlemleri geri alınabilir. Otomatik kalıcı temizleme yoktur. Geri alınan planlı gönderi, kendiliğinden yayınlanmaması için taslağa döner.

## Testler

```sh
npm test
```

Ayrıntılı sonuçlar TEST_RAPORU.md; dosya ve API haritası MIMARI.md içindedir.
