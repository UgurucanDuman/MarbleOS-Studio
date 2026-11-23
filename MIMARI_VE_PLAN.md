# MarbleOS Studio — Mimari ve Uygulama Planı

Güncelleme: 5 Kasım 2026. Öncelik: kullanıcının son kararı → çalışan kod → doğrulama sonuçları → bu plan. İşaretlenmiş bir görev tek başına çalışma kanıtı değildir.

## 1. Kesin ürün kararları

- Ürün: fotoğrafçılara özel MarbleOS tasarım dilinde masaüstü çalışma alanı. İlk hedef okul fotoğrafçılığı, öğrenci/öğretmen listeleri, fotoğraf düzenleme, albüm, kimlik ve baskı.
- **Bilgisayara kurulan Windows masaüstü uygulaması** geliştirilecek: React + TypeScript + Vite arayüzü, Tauri yerel uygulama katmanı, SQLite veritabanı.
- **Yerel kullanım öncelikli ve bağımsızdır. Bulut şimdilik kapsam dışında.** Supabase hesabı, internet girişi veya merkezi PostgreSQL olmadan okul iş akışı tamamlanmalı. Bulut, kullanıcı daha sonra isterse ayrı aşamada değerlendirilir.
- Uygulama gerçek kullanımda **boş başlar**. Örnek okul, öğrenci, öğretmen, fotoğraf, sipariş veya sahte başarı üretilmez. Otomatik test verileri yalnız `tests/fixtures/` içinde bulunabilir.
- Kullanıcı SQLite veya SQL kurmaz/çalıştırmaz. İmzalı uygulama kurulumu gerekli motoru taşır; ilk çalıştırma veri klasörünü ve sürümlü veritabanını oluşturur. Bu, henüz tamamlanmamış hedef davranıştır.
- Beş dil: **Türkçe, İngilizce, Almanca, İspanyolca, Fransızca**. Arapça kapsamda yok. Hazırlık sitesi beş dilli; masaüstü uygulamanın sözlükleri henüz yok.
- Dağıtım adresi: `https://studio.marbleos.app/`. Şu an hazırlık sayfasıdır; çalışır masaüstü kurulum dosyası sunulduğu anlamına gelmez.
- NonStop iş ihtiyaçları araştırma kaynağıdır. Kod, ekran, şablon, görsel veya marka kopyalanmaz; kendi tasarımımız ve lisanslı kaynaklarımız kullanılır.
- Yazıcı seçimi ve temel baskı ayarları kendi Baskı Merkezi penceremizde yapılacak; native Windows yazdırma bağlantısı sonrası standart print diyalogu her işte açılmayacak. Özel sürücü seçenekleri gerektiğinde üretici penceresi açılabilir. [Yazdırma sözleşmesi](docs/YAZDIRMA_MIMARISI.md). Şu an altyapı aşaması; gerçek yazıcı entegrasyonu henüz yok.

## 2. Bugün gerçekten ne var?

| Bileşen | Kontrolde görülen durum |
| --- | --- |
| React/TypeScript/Vite | Kurulu; üretim web derlemesi çalışıyor. |
| Dört uygulama penceresi | `excel-list`, `photo-studio`, `album-designer`, `print-center`; Dock, sürükleme, boyutlandırma, büyütme ve akıllı bölme kodu var. |
| Zod / React Query | Kullanılıyor. Zod kayıt girişinde de çalışıyor; yerel prototip state sahibi external store. Bunlar tek başına yetkilendirme veya dosya güvenliği sağlamaz. |
| Kalıcı kayıt | Tarayıcı localStorage ile çalışır. Tauri için SQLite sürüm kontrolü, şifreli çalışma kaydı ve yönetilen orijinal/önizleme deposu eklendi. Windows çalışma testi ayrı. |
| Başlangıç verileri | Yeni yerel prototip alanı boş başlar. Eski v2 alanı silinmez veya otomatik içeri alınmaz; gerçek kullanıcı kaydı içeriyorsa önce ayrı kurtarma/aktarım gerekir. |
| Excel | Metin yapıştırma ve CSV/TSV desteği var. `.xlsx/.xls` okuyucu, sütun eşleme ve aktarım önizlemesi yok. |
| Fotoğraf | Elle bağlama ve açıkça seçilmiş sınıfta dosya adı önekinden kısıtlı öneri; CSS kadraj/ışık önizlemesi. Gerçek görüntü işleme/ICC/RAW motoru yok. |
| Tasarım / çıktı | Basit HTML çizelge ve kimlik önizlemesi, CSV kontrol listesi, ekran yazdırma. PDF/TIFF, gerçek barkod, DPI ölçümü ve profesyonel baskı motoru yok. |
| Hatalar | Modül başına React hata sınırı eklendi. Asenkron işlem hataları ayrıca gösterilir. Tüm sistem hata ekranları henüz tamamlanmadı. |
| Tauri | Cargo/Rust girişi, üç izinli yerel komut, CLI ve Windows ikonları var. Kurulum paketi derleme ve temiz cihaz kabulünden sonra hazır sayılır. |
| Bulut | Dock'tan çıkarıldı; hiçbir kayıt gönderilmiyor. Eski eşitleme action'ı sunucu olmadan başarı üretemez. Artık dosyalar gelecek özellik taslağıdır. |

Güncel inceleme ve kalan riskler: [KONTROL_RAPORU.md](KONTROL_RAPORU.md). Yerel depolama ve SQL tasarımı: [docs/YEREL_VERI_VE_SQL.md](docs/YEREL_VERI_VE_SQL.md).

İş takibi: [YAPILACAKLAR.md](YAPILACAKLAR.md). Şifreleme/anahtar/çevrimdışı lisans: [güvenlik ve lisans](docs/GUVENLIK_VE_LISANS.md). 4K/8K, bellek bütçesi, CPU/GPU ve gerçek ölçüm: [performans ve görüntü](docs/PERFORMANS_VE_GORUNTU.md).

## 3. Veriler bilgisayarda nerede olacak?

Planlanan kullanıcıya özel kök: `%LOCALAPPDATA%\MarbleOS-Studio\`. Örnek: `C:\Users\Acer\AppData\Local\MarbleOS-Studio\`.

```text
MarbleOS-Studio/
  data/marbleos_studio.db       # Kayıtlar ve sürümlü SQL şeması
  media/originals/             # Değiştirilmeyen özgün fotoğraflar
  media/previews/              # Yeniden üretilebilir önizlemeler
  projects/                   # Tasarım belgeleri ve yerel proje varlıkları
  exports/                    # Üretilen PDF / görüntü / kontrol listesi
  backups/                    # Yerel kurtarma noktaları; ayrıca harici yedek gerekir
  logs/                       # Kişisel verisi ayıklanmış hata kayıtları
```

Bu klasör **bugünkü tarayıcı sürümü tarafından oluşturulmuyor**. Windows kullanıcı adı kodda sabitlenmez; işletim sisteminden yerel veri yolu alınır. Ayarlarda “Veri klasörünü aç”, “Yedek al”, “Yedeği doğrula”, “Geri yükle” bulunmalı. Proje kaynak klasörü ile müşteri verileri ayrı tutulur. Program güncellemesi, kaldırma/yeniden kurma veya geliştirme build'i veri kökünü sessizce silmemeli.

## 4. Kaynaklardan doğrulanan ihtiyaçlar

Araştırma tarihi 4 Kasım 2026. NonStop çalıştırılarak denenmedi; kamuya açık üretici sayfaları incelendi. Kullanıcının kuracağı program üzerinden ekran/çıktı incelemesi ayrıca yapılacak.

| Resmî kaynak | Doğrulanan kapsam ve bize etkisi |
| --- | --- |
| [NonStop kullanım kılavuzu](https://turuncubaski.com/nonstop-kullanim-kilavuzu/) | Okul → sınıf/öğrenci → resim atama → sipariş akışı; Excel aktarımı ve fotoğraf düzeltmeleri. Bizde okul/dönem kapsamı, aktarım önizlemesi ve eşleştirme kontrolü ayrı kabul şartıdır. |
| [Üretici soru-cevap sayfası](https://turuncubaski.com/turuncu-baski-sik-sorulan-sorular/) | Test albümü, vesikalık dizgi, yönetici/öğretmen albümü, not çizelgesi/defteri ve öğrenci/öğretmen kimliği listeleniyor. Varsayılan yazıcının dizgiyi etkileyebildiği belirtiliyor; bizde yazıcıdan bağımsız fiziksel ölçü kontrolü gerekir. |
| [NonStop 2026 indirme ve sürüm notları](https://turuncubaski.com/ucretsiz-e-okul-fotograf-kucultme-yukleme/) | Sayfada 24.0.8 sürümü, 24.0.4 etiket ve 24.0.3 ayraç baskısı yer alıyor. Eski notlarda yedek/geri yükleme ve çıktı düzeltmeleri var. Etiket/ayraç, kurtarma ve yeniden baskı akışları plana dahil edildi. |
| [GotPhoto erişim ve etiketleme rehberi](https://help.gotphoto.com/en/support/choose-your-access-type-and-tagging-method) | QR/barkod ve kişi listesi üzerinden tanımlama iş akışları. Bizde yerel QR/çekim kartı seçeneği ileriki aşama; yüz tanıma veya internet galerisi ilk sürüm şartı değildir. |
| [Adobe baskıya hazır PDF rehberi](https://helpx.adobe.com/indesign/desktop/print/print-production-and-file-creation/produce-print-ready-pdf-files.html) | Fontlar, taşma payı, çıktı profili ve baskı ön kontrolü önemlidir. Uygulamada yalnız “300 DPI” etiketi göstermek teknik doğrulama sayılmaz. |

Aşağıdaki katalog kendi ürün tasarımımızdır; listedeki her kalemin NonStop'ta bulunduğu iddia edilmez.

## 5. Modül kataloğu ve kabul şartları

Bugün dört pencere var. Aşağıdaki iş alanları olgunlaştıkça aynı pencere çekirdeğine bağlanacak; her ana modül kendi penceresi ve hata sınırına sahip olacak. Aynı domain'in alt araçları gereksiz yeni store/window manager oluşturmaz.

| İş alanı | Gerekli davranış / kabul örneği |
| --- | --- |
| İş merkezi | Gerçek işlerden çekim, eşleştirme, baskı ve teslim durumu; boş açılışta hayalî sayaç yok. |
| Okullar / kurumlar | Ad, adres, iletişim, logo, yetkili notu; okul seçimi tüm bağlı işlemleri kapsamlar. |
| Dönem / sınıf / kişi | Öğrenci ve öğretmen ayrı roller; `1A`, `1-A`, `1/A` normalizasyonu önizlenir, kullanıcı onayı olmadan sınıflar birleşmez. Dönem aktarımı geçmişi değiştirmez. |
| Excel / CSV aktarım | `.xlsx` sütun eşleme, UTF-8/BOM, baştaki sıfırlar, birleşik ad/soyad, hatalı satır raporu, tekrar tespiti; onay öncesi veritabanına yazma yok. |
| Çekim planı | Okul/sınıf çekim sırası, öğretmen ve kardeş/grup çekimleri, tekrar çekim; isteğe bağlı yerel QR kartları. |
| Fotoğraf arşivi | Klasörden toplu aktarım, dosya imzası/boyut sınırı, EXIF yönü, hash ile tekrar uyarısı, kayıp/taşınmış dosya onarımı. |
| Eşleştirme masası | Okul+dönem+sınıf içinde adaylar; sıra kayması, eksik/fazla kare ve çift numara uyarısı. Belirsizlikte otomatik kişi seçimi yok. Eşleşme ve baskı onayı ayrıdır. |
| Fotoğraf düzenleme | Orijinali koruyan kırpma/pozlama/döndürme tarifleri, toplu uygula ve geri al; görüntü işleme arayüzü kilitlemez. |
| Şablon tasarımı | mm ile ölçü, kenar/güvenli alan, taşma, katman, hizalama, kilit, lisanslı font, sürüm; özgün lisanslı tasarımlar. |
| Öğrenci / öğretmen kimliği | Ön/arka yüz, logo/imza izinleri, gerçek barkod/QR, kesim ve çift taraf hizası; örnek çizgiler gerçek barkod diye sunulmaz. |
| Sınıf çizelgeleri | Öğretmenin verdiği sınıf/isim sırası, eksik foto uyarısı, çok sayfa, not çizelgesi ve not defteri türleri. |
| Albümler / yıllıklar | Test albümü, yönetici albümü, öğretmen cep albümü, mezuniyet/yıllık; kapak, sırt/cilt ve sayfa sırası, yeniden baskı sürümü. |
| Vesikalık dizgi | Farklı fiziksel ebat ve adetler, kesim arası boşluk; okul/kamu şartları sürümlü profillerle doğrulanır, otomatik biyometrik uygunluk iddiası yok. |
| Etiket / ayraç / takvim | Ayrı baskı ürün profilleri; etiket sayfa dizgisi ve ayraç ölçüsü, lisanslı görseller; ilk dikey akıştan sonra. |
| Okul sistemi dışa aktarım | Ülkeye/sisteme göre dosya adı, piksel ve byte sınırı profili; ön kontrol ve dosya listesi. e-Okul şifresi toplama veya izinsiz otomasyon yok. |
| Sipariş / iş takibi | Okul+ürün+adet, revizyon, iptal, tekrar baskı; yerel kayıtta yinelenen iş üretimi engellenir. |
| Baskı merkezi | PDF öncelikli; seçilen lab profili, fiziksel ölçü, font/ICC, gerçek DPI, boş/eksik kare, kağıt israfı ve çift taraf kontrolü. |
| Teslim | Yerel dışa aktarım klasörü/USB paketi, dosya manifesti ve hash; onaylı iş sürümü arşivlenir. İnternet paylaşımı daha sonra. |
| Fiyat / maliyet | Ürün bedeli, malzeme/fire ve iş bazlı toplam; resmî muhasebe veya e-fatura uyumluluğu vaat edilmez. Para float ile tutulmaz. |
| Yerel yedek / geri yükleme | DB+orijinaller+tasarımlar+manifest bir arada; USB/harici disk hedefi, eksik dosya kontrolü ve ayrı klasöre gerçek geri yükleme deneyi. |
| Ayarlar / erişim | Beş dil, tema, azaltılmış hareket, veri yolu, yazıcı/profil, yerel kilit ve saklama tercihleri. Yerel PIN, Windows yöneticisine karşı güvenlik sınırı değildir. |
| Yardım / işlem geçmişi | İşlem sonucu ve kurtarma adımı, kişisel veri içermeyen hata kodu; kullanıcı açıkça istemeden destek dosyası gönderilmez. |

## 6. Pencere, tasarım ve hata sözleşmesi

- Mevcut `WindowFrame`, tek `useWindowManager` ve ortak odak yüzeyi kullanılır. Yeni modül kendine ikinci pencere yöneticisi yazmaz. MarbleOS'tan alınacak ortak çekirdek sonraki adımda açık bağımlılık sınırıyla çıkarılır; mevcut Next iş modülleri içe aktarılmaz.
- Odak/z-index hemen değişir. Odak yerleşmesi 220 ms yalnız opacity/transform; blur animasyonu ve odak için remount yok. Küçültme içerik state'ini korur; kapatma kaydedilmemiş değişiklik varsa kullanıcıya seçenek sunmalı.
- Kapat, Dock'a küçült, boyut küçült, büyüt ve tam ekran farklı anlamlardır. İki/üç/dört pencere bölme, ekran değişimi ve eski geometriye dönme test edilmeli.
- Sistem/açık/koyu tema; mevcut saf siyah ve sade tipografi korunur. Turuncu aksan ve gereksiz hap rozet eklenmez. Orijinal renkli Dock ikonları korunur.
- Navbar altında sürekli teknik açıklama/durum yazısı gösterilmez. Kullanıcının 5 Kasım talebiyle kaldırıldı; yalnız gerçek işlem/kayıt hatası gerektiğinde bildirilir.
- Azaltılmış hareket yalnız CSS odağı değil Dock büyütme/zıplama ve pencere açılış/kapanışını da kapsamalı. [Apple Motion rehberi](https://developer.apple.com/design/human-interface-guidelines/motion) tasarım ilkesidir; “Apple seviyesinde” tamamlanmış kalite sertifikası değildir.
- Klavye odak sırası, görünür odak, erişilebilir isimler ve odaklanan pencerenin etkinleşmesi gerekir. Ekran okuyucu ve klavye kabulü henüz tamamlanmadı.
- Her modül render hata sınırı; async/import/kayıt işleri için ayrı sonuç ve tekrar deneme yolu. Eksik dosya, disk dolu, izin yok, bozuk DB, desteklenmeyen sürüm, çıktı üretilemedi ve genel ölümcül hata ayrı ekran/mesajdır. Kullanıcı verisini veya ham SQL/stack trace'i hata ekranına dökme.

## 7. Güvenlik ve veri bütünlüğü

- Zod renderer'da erken geri bildirim sağlar; yerel Rust komutu da DTO, boyut, kimlik ve kapsam doğrulamalı. UI doğrulaması atlanabildiğinde veri bozulmamalı.
- React Query iş verilerinin okuma/mutation/cache durumlarını yönetebilir. Gelecek SQLite adaptöründe verinin sahibi SQLite olacak; aynı veriyi bağımsız store ve Query cache içinde iki ayrı kaynak hâline getirme. Geometri/tema ayrı UI state'idir.
- Renderer'a serbest SQL, komut çalıştırma, genel dosya sistemi yazma veya rastgele URL açma yetkisi verme. Tipli komut allowlist'i, parametreli sorgular ve dar Tauri capabilities kullan.
- Sadece kullanıcının seçtiği girdiyi al; yönetilen medya alanına UUID adıyla kopyala. `../`, mutlak hedef, UNC ve sembolik bağlantı yoluyla kök dışına çıkışı engelle. Dosya uzantısına/MIME beyanına güvenme; decode/piksel sınırı da doğrula.
- Öğrenci numarası metindir; `001` korunur. UUID ilişki kimliğidir. Okul/dönem çapraz bağlantıları composite FK ve transaction ile engellenir. Tek fotoğrafı iki kişiye bağlama; eşleştirme değişince eski onayı kaldır.
- CSV formül enjeksiyonu ve tırnak/ayraç kaçışı korunur. XLSX/ZIP içe alma dosya, satır/hücre ve açılmış veri limitine sahip olur.
- Normal SQLite kendiliğinden şifreli değildir. Öğrenci verileri için DB+orijinal fotoğraf+yedek kapsayan şifreleme ve anahtar kurtarma tasarımı tamamlanmalı. DB'yi şifreleyip fotoğrafları açık bırakmak yeterli değildir.
- Arka planda telemetri, fotoğraf yükleme veya yapay zekâ servisine gönderim yok. AI sonradan eklenirse ayrı açık kullanıcı tercihi ve dar işlem yetkisi gerekir.
- Bağımlılık taraması uygulama güvenliğinin yalnız bir kontrolüdür. Gerçek verilerle kullanıma geçmeden native dosya, DB, yedek ve kurulum senaryoları da doğrulanmalı.

## 8. Geliştirme sırası

### P0 — Yerel masaüstü temeli

- [ ] Tauri Cargo/Rust/CLI projesi, Windows build araçları ve dar capabilities kurulumu. Bu bilgisayarda `cargo`/`rustc` PATH'te bulunamadı; büyük toolchain indirmesi bu incelemede yapılmadı.
- [ ] Gerçek SQLite bağlantısı, sürümlü migration, veri klasörünün otomatik oluşması ve “Veri klasörünü aç”. İlk açılışta hiçbir örnek veri eklenmez.
- [ ] Yerel fotoğraf dosya deposu; tarayıcı localStorage/data URL adaptörünün gerçek kullanım yolundan çıkarılması. Eski yerel kullanıcı verisi için açık aktarım/kurtarma aracı.
- [ ] Transaction, FK ve eşleme invariant'ları; hata/kota/enerji kesintisi/restart senaryoları.
- [ ] Şifreleme/anahtar saklama, dış diske yedek ve geri yükleme kabulü.
- [ ] Çevrimdışı Windows kurulum paketi. Taslakta `offlineInstaller` seçildi. WebView2 eksik temiz Windows'ta internet kapalı kurulum ve ilk açılış doğrulanacak. [Tauri Windows rehberi](https://v2.tauri.app/distribute/windows-installer/).

### P1 — Baştan sona bir gerçek yerel iş

- [ ] Boş uygulama → kendi okulu/dönemi/sınıfı → Excel önizleme/onay → fotoğraf aktarımı → eşleştirme incelemesi → tek orijinal şablon → gerçek boyutlu PDF → yerel yedek → uygulamayı yeniden açıp aynı işi bulma.
- [ ] Tüm akış ağ kapalıyken ve hiçbir cloud hesabı olmadan geçer.
- [ ] İmzalı EXE/MSI ile temiz Windows'ta kurulum, güncelleme ve veri koruma testi. Web build başarısı bu kabulün yerine geçmez.

### P2 — Ürün kapsamı ve kalite

- [ ] 4K/8K yerel fotoğraf hattı: disk orijinali, sınırlı önizleme cache'i, sanallaştırılmış galeri, iptal edilebilir CPU iş havuzu; GPU backend teknik denemesi ve CPU fallback. Arayüz compositing'i görüntü işleme motoru sayılmaz.
- [ ] Katalogdaki ek ürünler, toplu düzenleme, çok sayfa/cilt, yeniden baskı, etiket/ayraç, yerel sipariş/maliyet takibi.
- [ ] Beş dilde tüm pencere, hata, tarih/sayı ve baskı fontları; kullanıcı dil değiştirince iş kaybı yok.
- [ ] Kayıp foto, çok büyük okul, disk dolu, USB çıkması, bozuk yedek, kesilen işlem ve desteklenmeyen şema kabulü.
- [ ] Lab test baskısında %100 ölçek cetveli, kesim ve ön/arka hizası. 300 DPI varsayılan hedef olabilir; gerçek piksel/mm ölçülmeden onaylanmaz. PDF/X/CMYK/TIFF/RAW ayrıca teknik deneme ve bağımsız doğrulama ister.

### P3 — Kullanıcı isterse daha sonra

- [ ] İmzalı çevrimdışı lisans doğrulama, yayıncıda kalan özel anahtar ve makine değişimi/kurtarma. Lisans süresi dolunca müşteri verisini silme veya dışa aktarımı engelleme yok; ayrıntılar güvenlik/lisans belgesinde.
- [ ] Microsoft Store başvurusu, yayıncı kimliği ve imzalama. Tauri otomatik MSIX üretmez; EXE/MSI Store yolu da vardır. [Tauri Store rehberi](https://v2.tauri.app/distribute/microsoft-store/).
- [ ] Bulut, ekip ve çok cihaz eşitleme için yeni kapsam kararı. PostgreSQL/Supabase seçimi şimdi yapılmış kurulum değildir; yerel işi buluta bağımlı yapma.

## 9. Tamamlanma kanıtı

Her özellik için kod yolu, davranış testi ve gerçek cihaz/çıktı gerektiriyorsa o deneyin kaydı gerekir. `npm run verify` yerel tip/test/paket/build kontrolleridir; native güvenlik, profesyonel baskı, kurulum ve gerçek SQLite tamamlandı iddiası değildir. Git'e gönderim/yayın kullanıcının ayrı talebine bağlıdır.
