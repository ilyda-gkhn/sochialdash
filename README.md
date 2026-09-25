# SocialDash — yerel kurulum

Mevcut Express + SQLite + HTML/CSS/JavaScript yapısı ve sayfa tasarımı korunarak güncellenmiştir.

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
