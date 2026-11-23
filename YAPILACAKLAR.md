# MarbleOS Studio — Yapılacaklar ve Kabul Listesi

5 Kasım 2026. Detaylar: [mimari](MIMARI_VE_PLAN.md), [yerel SQL](docs/YEREL_VERI_VE_SQL.md), [güvenlik/lisans](docs/GUVENLIK_VE_LISANS.md), [yüksek çözünürlük/performans](docs/PERFORMANS_VE_GORUNTU.md), [kontrol kaydı](KONTROL_RAPORU.md).

## Masaüstü gözden geçirmesi · 16 Kasım 2026

- [x] Pencere animasyon çekirdeği masaüstüyle yükleniyor. Modüller ilk tıklamada yükleniyor. Küçültülen pencerelerde veri aboneliği, fotoğraf önizleme sorguları ve tablo gözlemcileri duruyor.
- [x] Geniş tam ekranda Okullar ve Sınıflar aynı içerik yüksekliğini kullanıyor. Tablo başlıkları sabit ve kaydırma tablo gövdesinde. Okul değişiminde sınıf görünümü kayıt onayından sonra açılıyor.
- [x] Okul seçicisi, sütun/şube seçicileri ve sınıflar arası arama sonuçları tema renginde opak yüzey kullanıyor. Seçiciler açılırken alttaki ve üstteki görünür alanı ölçüyor.
- [ ] İmzalı Windows paketini temiz profilde çevrimdışı kur, iş kaydı ve fotoğraf ekle, yeniden aç ve şifreli yedeği ayrı profilde geri yükle. Disk dolu ve izin hatalarını aynı akışta dene.
- [ ] Kurulu WebView2 içinde ilk pencere açılışı, Okullar–Sınıflar geçişi ve 4K/8K fotoğraf işleri için kare süresi, CPU ve RAM ölç. 1.000 ve 10.000 kayıtta gerekirse SQLite sayfalama ve görüntü iş kuyruğunu önceliklendir.
- [ ] Yüklü bir Windows yazıcısıyla fiziksel ölçü, kenar boşluğu, kuyruk hatası ve aynı işin tekrar gönderilmesini doğrula.

## Değişmeyen kararlar

- Windows'a kurulan masaüstü uygulaması; React + TypeScript + Vite + Tauri.
- Kullanıcı kendi kayıtlarını girer. Açılışta örnek okul, öğrenci, fotoğraf veya sahte sipariş yok.
- Bilgisayarda SQLite + yerel orijinal fotoğraf dosyaları. Bulut şimdi yapılmayacak.
- Veriler `%LOCALAPPDATA%\MarbleOS-Studio\` altında; veri klasörü uygulama kaynaklarından ayrı.
- Türkçe, İngilizce, Almanca, İspanyolca, Fransızca.
- Her ana modülün penceresi ve hata sınırı; ortak Dock/pencere/motion çekirdeği.
- Sonradan lisanslı dağıtılabilecek yapı. Lisans ile müşteri verisini şifreleme aynı anahtara bağlanmaz.
- Yazıcı seçimi/kağıt/adet/ölçek ayarları kendi Baskı Merkezi penceremizde; native bağlantı ve fiziksel baskı daha sonra. [Yazdırma altyapısı](docs/YAZDIRMA_MIMARISI.md).

## Kontrolde tamamlananlar

- [x] Mevcut uygulama/veri/pencere/import/çıktı kodları incelendi; somut rapor kaydedildi.
- [x] Kaynakların inceleme öncesi ZIP kopyası korundu.
- [x] Boş başlangıç; test fixture'ları uygulama girişinden ayrıldı.
- [x] Zod hem UI adaptöründe hem kayıt girişinde; mükerrer öğrenci ve geçersiz kapsam kontrolü.
- [x] Kayıt hatası başarı olarak gösterilmiyor; bozuk prototip verisi sessiz silinmiyor.
- [x] Eşleştirmede eski bağlantı/onayların temizlenmesi ve belirsiz fotoğraf adayının seçilmemesi.
- [x] Bulut Dock'tan çıkarıldı; sahte eşitlendi işlemi engellendi.
- [x] CSV kaçışı/formül koruması; hatalı liste satırında sütun kaymasının engellenmesi.
- [x] Akıllı bölme render döngüsü giderildi; pencere başına hata sınırı.
- [x] Bölme sırasında sürükleme sıfırlamasının yarıda kesilmesi giderildi; ekran değişiminde sütunlar ve navbar/Dock boşlukları yeniden hesaplanır. Ortak resize dinleyicisi kare başına en fazla bir yayın yapar; modül içeriği pencere genişliğine uyarlanır.
- [x] Navbar altındaki sürekli teknik yazı kaldırıldı.
- [x] Açık/koyu tema için 280 ms crossfade, desteklemeyen WebView için renk geçişi; azaltılmış hareket tercihi ve hızlı ardışık tema seçimleri.
- [x] Açık temada filigran/logo kontrastı, ikon zemini ve objektif dış halkaları uyarlandı.
- [x] Objektif navbar/Dock arasında kullanılabilir alana ölçeklenir; Dock etiketlerinin okunaklı tipografisi ve klavye odak görünümü düzenlendi.
- [x] Studio simgesi için MarbleOS'un üç katmanlı işareti kâğıt ve çizim kalemiyle birleştirildi. Üst bar, filigran, Dock ve favicon aynı SVG çizimi kullanır.
- [x] Tauri kurulum taslağında Vite adresi eşitlendi ve WebView2 çevrimdışı kurulum seçeneği belirlendi.
- [x] Görsel listelerinde lazy/async decode; Dock'ta kalıcı width/height will-change kaldırıldı. Bunlar tam yüksek çözünürlük motoru değildir.
- [x] İsteğe bağlı yerel geliştirme rAF ölçümü eklendi; ölçümün FPS/GPU kullanım kanıtı olmadığı belgelendi.
- [x] Çalıştırılabilir davranış testleri, typecheck, paket güvenlik kontrolü ve web build.

## P0 — Gerçek yerel masaüstü ve güvenilir veri

- [x] Tauri/Rust başlangıcı, dar IPC, SQLite migration ve DPAPI korumalı orijinal/önizleme kaynakları eklendi.
- [ ] Windows'ta Rust depo testlerini çalıştır, derlemeyi ve ilk açılışı doğrula. EXE/MSI ve imzalama ayrı kabul maddeleri.

- [ ] Rust/Cargo, Windows native araçlar ve Tauri CLI projesi; EXE/MSI üretimi.
- [ ] Dar native komut listesi/capabilities, parametreli SQL, renderer dışında kapsam ve boyut doğrulaması.
- [ ] Gerçek SQLite bağlantısı, migration, FK/CHECK/UNIQUE ve transaction davranış testleri.
- [ ] İlk açılışta veri klasörü oluşturma; “Veri klasörünü aç” düğmesi.
- [ ] Orijinalleri diske kopyalama, dosya hash'i, EXIF yönü ve yeniden üretilebilir thumbnail/preview cache.
- [ ] localStorage/data URL prototipini gerçek veri yolundan çıkarma; eski kullanıcı kayıtlarını kaybetmeden açık aktarım aracı.
- [x] DB+fotoğraf+yedek şifreleme, Windows anahtar koruması, kurtarma anahtarı ve yanlış anahtarda veri koruma deneyi (kod ve otomatik testlerde doğrulandı; gerçek ikinci cihazda fiziksel kabul ayrıca yapılacak).
  - [x] 9 Kasım: Okul yedeği artık masaüstü (`studio_photo_original` ile orijinal fotoğraf okuma + SHA-256 doğrulama) ve tarayıcıda parolalı, şifreli (`.marbleos-yedek`, PBKDF2-SHA256 600.000 tur → AES-256-GCM, rastgele tuz/IV, başlık AAD bağlı, okul başına 600 fotoğraf / 64 MB atomik yedekleme ve geri yükleme). Parola kuralı Zod'da; parola saklanmaz. Yanlış parola, tek bayt değişikliği ve sınır dışı başlık reddediliyor; tüm yedekleme ve kurtarma işlemleri merkezi Üst Bar → Ayarlar kitabında toplandı. Eski şifresiz v1 yedekler yalnız okunur. Davranış testleri: `schoolBackupCrypto.test.ts`, `GeneralBackupPage.test.tsx`, `desktopDatabase.test.ts`, `storage_tests.rs`.
  - [x] 9 Kasım: Okul görselleri (`logo`, `principalSignature`, `deputySignature` <= 3 MiB; `schoolPhoto` <= 8 MiB) masaüstünde Rust `image` ile tam piksel ve boyut sınırlarıyla (`<= 8192×8192`, `<= 40 MP`, `256 MiB` bellek sınırı) decode edilerek doğrulanıyor; SQLite kaydı içine base64 gömülmek yerine `media/{originals,previews}/schools/<uuid>.dpapi` altında şifrelenmiş ayrı dosyalar olarak saklanıyor (`marbleos-school-asset:<uuid>`). Eski satır içi görseller açılışta otomatik taşınıyor; silinen/değiştirilen görseller diskten temizleniyor; şifreli yedeklerde tam çözünürlüklü olarak paketleniyor.
  - [x] 9 Kasım: Zarf şifreleme (`256-bit` Ana Veri Anahtarı `DataKey` + `AES-256-GCM` `MBLAEAD1`), Windows DPAPI sargısı + `Argon2id` (`64 MiB`, `t=3`, `p=1`) + `AES-256-GCM` (`MBLRECV1`) ile korunan `256-bit` (`56` Crockford Base32 karakter, `24-bit` SHA-256 sağlama toplamı) Kurtarma Anahtarı (`004_vault_key.sql`) ve tüm çalışma alanı şifreli kasa yedeği (`.marbleos-kasa`, `marbleos-workspace-backup-v1-encrypted`) tamamlandı. Windows profili değiştiğinde kasa veriyi silmeden kilitlenir (`VaultUnlockGate`), yanlış denemelerde üssel bekleme uygulanır, doğru kurtarma anahtarıyla DPAPI yeni profile bağlanır; eski pre-v4 DPAPI kayıt ve medya dosyaları ilk açılışta otomatik `MBLAEAD1` zarfına yükseltilir. Davranış testleri: `storage_tests.rs` (13/13), `workspaceBackup.test.ts`, `desktopVault.test.ts`, `GeneralBackupPage.test.tsx`, `StudioSettingsBookSheet.test.tsx`.
- [ ] Tutarlı yedek, harici disk/USB hedefi ve ayrı klasöre doğrulanmış geri yükleme.
- [ ] Disk dolu/izin yok/elektrik kesintisi/bozuk DB/eksik dosya/yarım işlem için ayrı kurtarma yolları.
- [ ] WebView2 olmayan temiz Windows'ta internet kapalı kurulum ve ilk açılış.
- [ ] İmzalı kurulum ve imzalı güncelleme, DB yükseltmesi öncesi kurtarma noktası.

## P1 — Bir okul işini baştan sona bitirme

Fotoğrafçının mevcut programı incelendikten sonra Excel sınıf gruplama ve okul+dönem+sınıf kapsamında fotoğraf eşleştirme tasarımı kesinleştirilecek. Şimdilik yerel temel üzerinde çalışılıyor.

- [ ] Kendi okulunu, eğitim dönemini, sınıfları ve öğretmenleri ekleme.
  - [x] Faz 1 (6 Kasım): Okul ayrı kayıt (`SchoolRecord`: sıra kodu, isteğe bağlı kurum kodu, adres, not, biyometrik/vesikalık tercihi), seçili okul, sınıf→okul bağı; Zod + prototip doğrulaması + Rust snapshot doğrulaması ve davranış testleri. Rust testleri bu bilgisayarda Cargo olmadığı için çalıştırılmadı.
  - [x] Faz 2–7 (6 Kasım): Okullar görünümü (arama, 20'şer sonsuz kaydırma, Tümünü Seç + animasyonlu toplu silme, Excel/CSV toplu okul aktarımı, Apple Workspace Switcher okul seçici), tüm modüllerde seçili okul kapsamı, logo/transparan logo/imza/okul resmi sekmeleri, okul silme/birleştirme/yeni döneme terfi, FNV-1a sağlama toplamlı `.marbleos-school.json` okul yedeği/geri yükleme ve Albüm/Baskı Merkezi bağlantısı.
- [x] XLSX sütun eşleme ve önizleme; `1A/1-A/1/A`, baştaki sıfırlar, aynı numara ve hatalı satır kontrolü (`XlsxImportSheet`, `SchoolXlsxImportSheet`, `SchoolRosterXlsxSheet`, `xlsxRoster.ts`, `schoolXlsxImport.test.tsx`).
- [ ] 4K/8K dosyalarını bellek bütçesine göre sıraya alan native import/preview işi; bütün orijinalleri aynı anda decode etme yok.
- [ ] Eşleştirme kontrol masası; eksik/fazla kişi/kare ve sıra kayması raporu, elle düzeltme.
- [ ] Orijinali bozmayan sürümlü kadraj/pozlama; toplu iş ve geri al.
- [ ] Tek özgün vesikalık/çizelge şablonundan fiziksel ölçülü PDF, font ve gerçek DPI ön kontrolü.
  - [x] 10 Kasım: İsteğe bağlı `Bölümü / Alanı` (`idCard.department`) kimlik alanı ve Excel içe/dışa aktarımı eklendi; tüm tablo, denetçi, karanlık oda, albüm ve çıktı yüzeylerinden `Okul No` önündeki `#` işareti kaldırıldı. `PrintCenterWindow` Apple Pro 2 sütunlu baskı stüdyosuna dönüştürüldü (`Vesikalık 45×60`, `Biyometrik 50×60`, `CR80 PVC Kimlik Kartı` tekli ve A4 8'li, `A4 Dikey/Yatay Albüm & Sınıf Panosu`, `MEB e-Okul .zip`); Windows EXE için `EnumPrintersW` + `CreateDCW("WINSPOOL")` doğrudan GDI yazıcı kuyruğu (`src-tauri/src/printer.rs`, `desktopPrinter.ts`) eklendi. Rust derleme/test ve gerçek fiziksel yazıcı kabulü MSVC/Cargo kurulu makinede ayrıca doğrulanacaktır.
- [ ] %100 ölçek cetveli ve gerçek lab baskısı; çıktı sürümü/hash manifesti.
- [ ] İnternet kapalıyken tüm akış → yedek → programı kapat/aç → aynı işi geri bul.

## P2 — Fotoğrafçının ürünleri ve ölçek

- [ ] Öğrenci/öğretmen kimliği, gerçek QR/barkod ve ön/arka baskı hizası.
- [ ] Test/idareci/öğretmen cep albümü; not çizelgesi/defteri, yıllık/mezuniyet, kapak/cilt/sayfa sırası.
- [ ] Vesikalık dizgi, etiket, ayraç ve takvim ürün profilleri.
- [ ] Çekim planı, tekrar çekim, isteğe bağlı yerel QR kartları ve okul sistemi dosya export profilleri.
- [ ] Yerel sipariş/tekrar baskı, maliyet/fire ve teslim paketi.
- [ ] Büyük galeride sanal liste, sayfalı SQL sorgusu ve sınırlı önizleme cache'i; tüm okulu tek React snapshot'ına çekme yok.
- [ ] CPU worker/job pool, iptal/öncelik/yeniden başlatma; GPU uygunluğuna göre güvenli hızlandırma ve CPU fallback.
- [ ] Gerçek 4K/8K dosya koleksiyonlarıyla 1.000/10.000 kayıt, bellek/VRAM, termal yük ve uzun iş kararlılığı ölçümü. Test kapasiteleri hedef, başarı iddiası değildir.
- [ ] Beş dil, klavye/ekran okuyucu, tüm hareketlerde reduced motion ve viewport değişimine uygun pencere sınırları.

## P3 — Lisanslı ürün ve isteğe bağlı sonraki işler

- [ ] İmzalı çevrimdışı lisans dosyası; yalnız public doğrulama anahtarı uygulamada, özel anahtar yayıncıda.
- [ ] Lisans politikası kararı: süreli/süresiz sürüm, cihaz değişimi/taşıma ve internet olmadan kullanım koşulları. Şimdi varsayılan ticari kısıt ekleme.
- [ ] Lisans sorunu müşteri verisini silmez/anahtarını kaybettirmez. Onaylanmış kurtarma/yedek erişimi korunur.
- [ ] Uygulama/güncelleme/lisans/veri şifreleme anahtarları ayrı; anahtar rotasyonu ve imzalama süreci.
- [ ] Microsoft Store dağıtımı ayrıca değerlendirilir. Tauri otomatik MSIX hazır kabul edilmez.
- [ ] Bulut/çok cihaz/online lisans kontrolü yalnız kullanıcı yeniden isterse; ilk yerel sürüm bunlara bağlı değildir.

## Yarın NonStop üzerinden yapılacak inceleme

- [ ] Kullanıcının kurduğu sürüm ve mevcut özellikler ekran üzerinden doğrulanacak; kamuya açık kılavuz ile kurulu sürüm ayrılacak.
- [ ] Okul oluşturma → öğretmen Excel'i → eşleştirme → düzeltme → dizgi → PDF/yazıcı → yedek/geri yükleme tek örnek işte izlenecek.
- [ ] Dosya biçimleri, sıra/kadraj mantığı, ölçü ve yazıcı seçenekleri not edilecek; varsayımlar kapatılacak.
- [ ] Önceki ürünün kodu/şablonu/görseli kopyalanmadan iş ihtiyacı kendi mimarimize aktarılacak.

İlk sonraki uygulama görevi P0 yerel veri dikey akışıdır. İşaretler ancak çalışan kod ve gerekli kanıtla kapatılır.
