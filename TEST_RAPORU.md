# SocialDash test ve teslim raporu

Tarih: 24 Eylül 2026. Kaynak: socialdash_updated.zip. Orijinal arşiv değiştirilmedi.

## Yapılan değişiklikler

- Gönderi düzenleme, gelişmiş ayar kalıcılığı, silme/gerçek geri alma ve takvim saat dilimi düzeltildi.
- Medya yükleme ve kütüphaneden seçim backend kayıtlarına bağlandı; silme geri alınabilir hale geldi.
- AI sohbet oluşturma, yeniden adlandırma, sabitleme, kopyalama, arşivleme, geri çıkarma ve silme SQLite'a bağlandı. Arşivden çıkarılan sohbet otomatik açılmaz.
- Profil, seçili sosyal hesap, özel başlıklar, dil, tema ve tarih ayarları kalıcı hale getirildi.
- Oturum yenileme yarışları ve kullanıcı değişiminde eski verilerin görünmesi engellendi.
- Yapılandırılmamış servisler için açık durum bilgisi eklendi; sahte sonuçlar kaldırıldı.
- Mobil takvim taşması, klavye odak yönetimi, renk kontrastı ve eksik bazı çeviriler düzeltildi.
- Mevcut veri yapısına geriye uyumlu 012_application_persistence migration'ı ve yerel kurulum komutu eklendi.

## Ölçülen sonuçlar

- Jest: 18 test paketi, 99 test başarılı.
- JavaScript sözdizimi: 93 dosya, hata yok.
- Tarayıcı: 15 sayfa × 3 genişlik = 45 ekran kontrolü.
- Ana kullanıcı akışı: 19 kontrol başarılı; JS hatası ve başarısız istek yok.
- Ek hesap/takvim/profil/oturum kontrolü: 10 kontrol başarılı.
- Açık ve koyu temada 320/1366 px ekranlar ve gönderi modalı axe ile denetlendi; denetlenen durumlarda ihlal yok. Bu otomatik kontrol tam WCAG uygunluk sertifikası değildir.

## İstenen 32 kontrol

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | Frontend açılışı | Geçti |
| 2 | Backend açılışı | Geçti |
| 3 | SQLite bağlantısı ve migration | Geçti |
| 4 | Kayıt | Geçti |
| 5 | Giriş | Geçti |
| 6 | Oturum ve token yenileme | Geçti |
| 7 | Profil ve boş telefon kaydı | Geçti |
| 8 | Sosyal hesap ekleme/seçme/kaldırma | Seçme ve kaldırma geçti; canlı OAuth ekleme anahtar gerektiriyor |
| 9 | Platform sayfaları | Yerel hesap verileri ve yapılandırma uyarıları geçti; canlı veri doğrulanmadı |
| 10 | Gönderi oluşturma | Geçti |
| 11 | Aynı ID ile gönderi düzenleme | Geçti |
| 12 | Taslaklar | Geçti |
| 13 | Planlama | Kayıt ve saat dilimi geçti; canlı yayın doğrulanmadı |
| 14 | İçerik takvimi | Geçti |
| 15 | Medya yükleme/seçme/geri alma | Geçti |
| 16 | AI sohbet oluşturma | Geçti; canlı model yanıtı anahtar gerektiriyor |
| 17 | AI sohbet silme ve geri alma | Geçti |
| 18 | AI arşivleme | Geçti |
| 19 | Arşivden çıkarınca otomatik açılmama | Geçti |
| 20 | Haberler hata yönetimi | Geçti; canlı haber akışı anahtar gerektiriyor |
| 21 | Bildirimler | Okuma ve geri alma geçti; harici push doğrulanmadı |
| 22 | Ayarların kalıcılığı | Geçti |
| 23 | Çıkışta özel verilerin temizlenmesi | Geçti |
| 24 | Mobil 320 px | Geçti |
| 25 | Tablet 768 px | Geçti |
| 26 | Masaüstü 1366 px | Geçti |
| 27 | Yatay taşma | Denetlenen ekranlarda yok |
| 28 | Console/runtime hatası | Son tarayıcı akışlarında yok |
| 29 | Başarısız API isteği | Son ana akışta yok; olumsuz API testlerinde beklenen hata kodları doğrulandı |
| 30 | Butonlar | Denetlenen CRUD, hesap, bildirim ve navigasyon akışları geçti; tüm sağlayıcı işlemleri doğrulanmış değildir |
| 31 | Duplicate kayıt | Düzenleme ve tekrarlanan kaydetme akışları geçti |
| 32 | Refresh sonrası veriler | Geçti |

## Kalan dış bağımlılıklar ve sınırlar

Gerçek sosyal platform hesabı, OAuth uygulama izinleri, AI/haber/e-posta/push kimlik bilgileri verilmediğinden bu servislerde canlı uçtan uca başarı iddia edilmez. Paket yerel uygulama akışları için doğrulandı; internete yayınlanmadı.

Gelişmiş ayarlar veritabanında tutulur ancak platform adaptörlerinin desteklemediği etkin seçeneklerle yayınlama açık hatayla durdurulur. Tek gönderi platform başına bir hesabı hedefler. AI ekleri metin dosyalarıyla sınırlıdır. Özel tarih aralığı eldeki senkronize metrikleri kullanır; geçmiş veri yanıtı en fazla 500 kayıtla sınırlıdır.

Geri alma için silinen gönderi/medya/sohbet kayıtları tutulur; otomatik kalıcı silme uygulanmadı. Depolama kullanımı zamanla artabilir. Planlı gönderiyi geri alma, güvenli biçimde taslak durumuna döndürür.

Testler ayrı geçici SQLite veritabanları ve sentetik kullanıcılarla yapıldı. Teslim arşivinde .env, gerçek kimlik bilgileri, node_modules, test veritabanları ve test yüklemeleri yoktur.
