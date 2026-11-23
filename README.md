# MarbleOS Studio

Okul fotoğrafçılığı ve baskı işleri için geliştirilen Windows masaüstü uygulaması. React önizlemesi çalışıyor. Tauri, SQLite ve Windows hesabına bağlı şifreleme kaynakları eklendi. Kurulu uygulama ve profesyonel baskı akışı ayrı kabul gerektiriyor.

## Belgeler

- [Mimari, konuşulan kararlar ve yapılacaklar](MIMARI_VE_PLAN.md)
- [Görevler ve kabul listesi](YAPILACAKLAR.md)
- [Bilgisayarda veri klasörü, SQLite ve yedekleme](docs/YEREL_VERI_VE_SQL.md)
- [Şifreleme, güvenlik ve gelecekteki lisanslama](docs/GUVENLIK_VE_LISANS.md)
- [4K/8K fotoğraf, CPU/GPU ve performans planı](docs/PERFORMANS_VE_GORUNTU.md)
- [Kendi penceremizden yazıcı ayarı ve yazdırma](docs/YAZDIRMA_MIMARISI.md)
- [Somut kontrol bulguları ve doğrulama](KONTROL_RAPORU.md)
- [Geliştirici/AI çalışma sözleşmesi](AGENTS.md)

## Yerel geliştirme

Node sürüm koşullarını `package.json` içindeki engines alanından kontrol edin. Bağımlılık sürümleri `package-lock.json` ile kayıtlıdır.

```powershell
npm ci
npm run dev
```

Geliştirme adresi `http://127.0.0.1:1420/`. Kurulumda ağ gerekir; `npm run dev` kurulu masaüstü uygulaması yerine geçmez.

```powershell
npm run verify
```

Tip kontrolü, davranış testleri, npm güvenlik taraması ve üretim web build'i çalışır. `verify` içindeki güvenlik taraması ağ erişimi ister. Bu kontroller native kurulum veya gerçek SQLite kabulünü kapsamaz. Bağımsız bir ESLint kontrolü henüz yapılandırılmadı.

## Klasörler ve gerçek durum

- `src/`: React arayüzü, dört izole pencere, merkezi Sistem Ayarları ve El Kitabı (`src/window-system/settings/`) ve tarayıcı önizleme adaptörü.
- `src-tauri/`: Rust/Tauri giriş noktası, yerel SQLite depolama, zarf şifreleme (`AES-256-GCM` + Windows `DPAPI` + `Argon2id` `256-bit` Kurtarma Anahtarı), kısıtlı komut izinleri (`capabilities/studio.json`), migration ve native testler (`13/13`).
- `static/`: React uygulamasının statik varlıkları.
- `public/`: yayındaki beş dilli hazırlık sayfasının ayrı kaynakları. Vite bu klasörü kullanmaz; canlı siteye yeni yayın yapılmadı.
- `tests/fixtures/`: yalnız otomatik test verileri; uygulamaya demo kayıt eklemek için kullanılmaz.
- `docs/`: geliştirme ve veri mimarisi; web yayın klasörü değildir.

Yeni kullanım boş başlar. Tarayıcı önizlemesi sınıf kayıtlarını ve fotoğrafları IndexedDB'de ayrı alanlarda saklar. Aynı tarayıcı adresindeki v4 kayıtları ilk açılışta kopyalanır ve eski anahtar korunur. v2 ve v3 alanlarına dokunulmaz. Tarayıcı verileri şifresizdir ve tarayıcı verisi temizlenince kaybolabilir. Windows kurulumunun deposu tarayıcıdan ayrıdır.

Windows veri kökü `%LOCALAPPDATA%\MarbleOS-Studio\`. İlk açılışta SQLite ve yönetilen fotoğraf klasörleri oluşturulur.

## Okul, sınıf listesi ve fotoğraf aktarımı

1. **Okullar görünümünde** tekil okul ekleyebilir veya **Excel (.xlsx) Aktar** / **Toplu Metin / CSV** ile kurum kodları (baştaki sıfırlar korunarak), okul adları ve adresleri içe alabilirsiniz. Seçili bir okula tüm şubeleri tek seferde yüklemek için **Excel (.xlsx) Sınıf & Öğrenci** kartı hem tek sayfalı (`Sınıf/Şube` sütunlu: `9A`, `09/a` → `9-A`) hem de çok sekmeli `.xlsx` çalışma kitaplarını atomik olarak aktarır.
2. **Sınıf Listesi görünümünde** şubeyi seçip **Excel Dosyası (.xlsx)** düğmesini açın. Studio başlıkları veya başlıksız listede numara ve ad alanlarını tanımaya çalışır. Sütunları ve ilk veri satırını değiştirebilir, aktarmadan önce listeyi inceleyebilirsiniz. Sınıf tablosu ilk 20 kaydı gösterir; aşağı kaydırıldıkça sonraki 20 kayıt aynı listeye eklenir.
3. **Sınıf Fotoğraflarını Eşleştir** ekranından sınıf klasörünü veya dosyaları seçin. Akıllı eşleştirme okul numarası ve tam adı kontrol eder. Sayısal dosya sırasıyla yerleştirme için **Çekim Sırası** seçilir. Dolu satırlar korunur, eşleşmeyen kareler sınıfın arşivine eklenir.
4. **Fotoğrafları Düzenle** seçili sınıfı Fotoğraf Stüdyo'da açar. Ad, soyad ve portre ayrı görüntülenir. Kadraj ve baskı onayı bu pencerede yönetilir.

Fotoğraf seçimi en fazla 150 JPEG, PNG veya WebP ve dosya başına 10 MB kabul eder. Ekran adedi, toplam MB/GB değerini ve kaydedilen miktarı gösterir. Bir grup hata verirse önceki başarılı gruplar korunur ve kalan dosyalar belirtilir.

## Windows kurulum hedefi

İmzalı `-setup.exe` veya `.msi` kurulur ve MarbleOS Studio Başlat menüsünden kendi penceresinde açılır. React arayüzü kurulum paketindeki `dist` dosyalarından WebView2 içinde çalışır. `127.0.0.1:1420` geliştirme adresidir. Müşteri Node/npm ya da ayrı SQLite kurulumu yapmaz. [Tauri Vite yapılandırması](https://v2.tauri.app/start/frontend/vite/), [Tauri süreç modeli](https://v2.tauri.app/concept/process-model/).

NSIS mevcut Windows kullanıcısı için kurulum hedefler. `offlineInstaller` seçimi, WebView2 gerektiğinde onun kurulum dosyasını pakete dahil eder. Paket üretimi ve internetsiz temiz Windows testi geliştirme listesindedir. [Tauri Windows kurulumu](https://v2.tauri.app/distribute/windows-installer/).

Tam Visual Studio C++ iş yükü ve x64 MSVC Rust hazır olduğunda `scripts/build-windows.ps1` önce web ve yerel depo testlerini çalıştırır, ardından x64 NSIS paketini üretir. `-VerifyOnly` parametresi kurulum paketi oluşturmadan Windows derleme denetimini yapar.

Yerel kayıt mimarisi SQLite içindeki iş verisini, öğrenci fotoğraflarını ve okul görsellerini `256-bit` Ana Veri Anahtarı (`AES-256-GCM`) ve Windows `DPAPI` ile korur; profil değişiminde `Argon2id` (`64 MiB`) tabanlı `256-bit` Kurtarma Anahtarıyla kilidi açar. Şifreli çalışma alanı (`.marbleos-kasa`) ve okul (`.marbleos-yedek`) yedekleme/geri yükleme işlemleri **Üst Bar → Ayarlar** kitabından yönetilir. İkinci bir fiziksel Windows cihazda kurulum ve kurtarma kabulü ayrıca yapılacaktır. [Güvenlik ve lisans planı](docs/GUVENLIK_VE_LISANS.md).
