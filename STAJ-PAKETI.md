# Doğrulama — 20 Ekim 2026

GitHub main ağacı: 8eab3c37215aeb97cf610dca0b95443a6828e57a. Depodaki 100 dosyanın tamamı yerel kaynaklarla Git blob SHA-1 üzerinden eşleşti. Yerel kaynaklarda ayrıca .gitignore, .env.example, UCRETSIZ_YAYIN.md ve üç test dosyası bulunuyor; bu dosyalar pakete eklendi.

Testler Node.js 26.8.2 ile özgün klasörden ayrı geçici kopyada, mevcut bağımlılıklar kullanılarak çalıştırıldı: 18 test grubu ve 99 test geçti. Özgün .env ve veritabanı test kopyasına alınmadı. Testler mevcut yerel bağımlılıklarla geçti; sıfırdan npm ci kurulumu, Windows ve canlı dış servisler ayrıca doğrulanmadı.

Paket .env, SQLite verileri, node_modules veya bağımlılık bağlantısı içermez. Dört özgün staj belgesi ve 106 kaynak dosyası korunur. DOSYALAR.json diğer tüm dosyaların SHA-256 özetlerini içerir.
