# Ücretsiz sunum yayını

Bu paket henüz internette yayınlanmış değildir. render.yaml, Render üzerinde ücretsiz bir web servisi tanımlar. Ücretli disk ya da veritabanı oluşturmaz.

## Sınırlar

Render Free 15 dakika kullanılmazsa uyur; sonraki açılış yaklaşık bir dakika sürebilir. Uyku, yeniden başlatma ve yeniden yayın sırasında SQLite kayıtları ve yüklenen dosyalar silinir. Bu nedenle bu yapı yalnızca geçici sunum içindir; kalıcı veri saklama çözümü değildir. Hocanız site açılınca yeni bir hesap oluşturabilir. Sosyal yayın, AI ve haberler yine servis anahtarlarını gerektirir.

Resmi açıklama: https://render.com/docs/free

## Terminal kullanmadan yayınlama

1. GitHub hesabı açın ve yeni bir private repository oluşturun.
2. Bu klasörün içeriğini (package.json ve render.yaml kökte olacak şekilde) GitHub'ın Upload files ekranından yükleyin. .env, node_modules, kişisel veritabanı veya yüklemelerinizi yüklemeyin.
3. Render hesabı açın; GitHub hesabınızı bağlayın ve yalnızca bu repository için erişim verin.
4. Render'da New > Blueprint ile repository'yi seçin. Oluşturulacak web servisinin planının Free olduğunu doğrulayın.
5. Yayın tamamlandığında Render'ın verdiği HTTPS bağlantısını açın; kayıt/giriş ve taslak kaydını deneyin. Sonra hocanızla bağlantıyı ve proje ZIP'ini paylaşın.

Şifrenizi veya doğrulama kodunuzu sohbet içinde paylaşmayın; hesap girişini kendiniz yapın. Kart/ödeme ekranı çıkarsa ücretli bir seçim yapmadan durun.
