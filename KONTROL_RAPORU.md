# MarbleOS Studio — Kod Kontrolü ve Teslim Kaydı

İnceleme: 4–5 Kasım 2026. Kapsam: masaüstündeki `MarbleOS-Studio` klasörünün uygulama, pencere, veri, import/çıktı, test, bağımlılık ve Tauri yapılandırması. Kaynak dosyalar incelendi; üretim öğrenci verisi, kurulu NonStop, native SQLite veya fiziksel yazıcı testi yapılmadı.

**Sonuç:** React çalışma alanı geliştirilebilir bir başlangıç. Gerçek SQLite, yerel medya güvenliği ve native kurulum henüz mevcut olmadığından tamamlanmış/güvenliği onaylanmış masaüstü ürün sayılmaz. Zod/React Query seçimi uygundur; uygulama güvenliğinin tamamı değildir.

## İnceleme öncesi koruma

Kaynakların kopyası `C:\Users\Acer\Desktop\MarbleOS-Studio-inceleme-oncesi-20261104.zip` dosyasında saklandı. `node_modules`, `dist`, Git ve native build çıktıları bu kaynak yedeğine dahil edilmedi. Bu, müşteri verisi için uygulama yedekleme özelliği değildir.

## Somut bulgular ve yapılan düzeltmeler

| Önem | Önceki davranış / kanıt | Son durum ve doğrulama |
| --- | --- | --- |
| Yüksek | `studioDatabase.ts` 120 ms gecikmeli localStorage yazıyordu, yazma hatasını yutuyordu. Kullanıcı arayüzü disk yazılmadan başarı görebiliyordu. | Geçici adaptörde depolama kabulünden önce state yayımlanmıyor. Yazma hatası mutation'ı reddeder ve hata gösterir. Kota testi eski snapshot'ın değişmediğini denetliyor. Bu hâlâ SQLite/OS fsync garantisi değildir. |
| Yüksek | Yerel JSON yalnız `classes`/`students` array kontrolüyle kabul ediliyor; bozuk kayıt sessiz örnek veriyle değişebiliyordu. | Tam şekil/ilişki doğrulaması; bozuk yeni alan korunur ve yazma durdurulur. Otomatik sıfırlama yok. Özel kurtarma aracı henüz yapılmadı. |
| Yüksek | `markAllQueueSynced` sunucu çağrısı olmadan bütün işlemleri `SYNCED` yapıyordu. | Sunucu olmadan işlem artık hata verir. Bulut penceresi aktif katalog ve Dock'tan çıkarıldı. “Sunucu onayı olmadan eşitleme yok” testi geçiyor. Bulut geliştirmesi ertelendi. |
| Yüksek | `uploadPhotos` dosya içindeki herhangi rakamı bütün öğrenciler arasında ilk eşleşene bağlıyor ve otomatik baskı onayı veriyordu. | Açık sınıf kapsamı + tam numara öneki + tek aday şartı; boş/çakışan eşleşme elle incelenir. Var olan eşleşme üzerine sessiz yazılmaz, otomatik onay yok. |
| Yüksek | `assignPhotoToStudent` yeni kişinin eski fotoğrafını ayırmadığı için iki fotoğraf aynı öğrenciye bağlı kalabiliyordu. | İki yöndeki eski bağlantılar temizleniyor, baskı onayları sıfırlanıyor, bilinmeyen kimlik reddediliyor. İlişki ve değiştirmeme testleri var. |
| Orta | `appendSyncLog(...).slice(0,100)` eski gönderilmemiş kayıtları sessiz atıyordu. `Date.now()` kimlikleri aynı milisaniyede çakışabiliyordu. | Liste sessiz kesilmiyor; UUID kullanılıyor. 105 işlem testi geçiyor. Bu liste payload/revision içermediğinden gerçek ağ outbox'ı değildir. |
| Orta | CSV çıkışı hücreleri kaçırmadan birleştiriyordu; dışarıdan girilen `=`, `+`, `-`, `@` ile başlayan içerik Excel formülü olabiliyordu. | Formül başlangıçları metne çevriliyor; tırnak, ayraç ve satır sonları kaçırılıyor. 9 CSV/manifest davranış kontrolü mevcut. |
| Orta | Import `.filter(Boolean)` ile boş hücreleri siliyor, numarası eksik satırda ad/soyadı kaydırabiliyordu. | Boş hücreli/uygunsuz satır reddedilir; tırnaklı ayraç ve baştaki sıfırlar korunur. Büyük girdi ve hatalı tırnak reddedilir. Çok satırlı hücreler henüz desteklenmez, açık hata verilir. |
| Orta | `useWindowManager` tiling effect'i, her state yazımında değişen array bağımlılığıyla tekrar state yazıyordu. | Effect bağımlılığı sabit içerikli kimlik anahtarına bağlandı. Gerçek hook testi akıllı bölmenin durulmasını, odağın sıralamayı değiştirmemesini ve küçültmenin açık state'i korumasını sınar. |
| Orta | Modül render hatası tüm React kökünü düşürebiliyordu. | Pencere başına `ModuleErrorBoundary`; hata veren modülün kardeş penceresi çalışmaya devam ediyor. Render hatası testi var; async hatalar ayrı ele alınıyor. |
| Orta | Fotoğraf/FileReader işlerinde dosya sınırı ve okuma hata yolu yoktu. Zod yalnız Query çağrısında olup doğrudan store action'ında atlanabiliyordu. | Dosya sayısı/tür/boyut ön kontrolü, toplu hata dönüşü ve sınırda tekrar Zod eklendi. İçerik imzası/decode/piksel kontrolü native medya hizmetinde hâlâ gerekli. |
| Orta | Tema localStorage okumaları/yazmaları izin engelinde kökü çökertebiliyordu. | Tema depolama hatası çalışma alanını düşürmez; yalnız mevcut oturumun tercihi korunur. İş verisi kaydındaki hata ise sessiz geçilmez. |
| Doğruluk | Arayüz ve MD'ler “SQLite”, “300 DPI kalibrasyon”, “baskı paketi”, “MSIX hazır” gibi uygulanmamış sonuçlar iddia ediyordu. | Aktif arayüz metinleri ve belgeler mevcut kabiliyete göre düzeltildi. CSV kontrol listesi/PDF, CSS önizleme/gerçek görüntü işleme ve config/native kurulum ayrıldı. |
| Kullanıcı kararı | Örnek öğrenci/okul/portreler uygulama açılışında yükleniyordu. | Yeni v3 alanı boş açılır. Test verisi yalnız `tests/fixtures/` altında; uygulamadan import yok. Eski v2 alanı korunur; otomatik taşınmış değildir. |

## Bağımlılık denetimi

İlk `npm audit --json`: 3 etkilenen paket; Vite ve Zod yüksek, esbuild orta önem derecesi. Bunlar internete açık ürünün istismar edildiğinin kanıtı değildir. Vite bulguları geliştirme sunucusu araç zinciriyle ilgilidir; Zod bulgusu koleksiyon doğrulamasında kaynak tüketimiyle ilgilidir.

- [Zod kaynak tüketimi bildirimi](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- [Windows launch-editor bildirimi](https://github.com/advisories/GHSA-587h-7wmj-h5pm).
- [esbuild geliştirme sunucusu bildirimi](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

Vite `7.3.7`, React Vite eklentisi `5.2.0`, Zod `4.6.7` ve Vitest `5.1.0` kuruldu; kilit dosyası yenilendi. Otomatik `audit fix --force` kullanılmadı. Son audit: **0 bildirilmiş zafiyet**. Bu sonuç gelecekte yeni açık çıkmayacağı veya bütün kodun güvenli olduğu anlamına gelmez.

Vite yalnız `127.0.0.1` geliştirme arayüzüne bağlanacak biçimde sınırlandı. Tauri dev URL / host davranışı gerçek native çalıştırmada ayrıca doğrulanmalı. npm kurulumunda ilk ağ denemesi kesildi, tekrar kurulum tamamlandı. Çalışan eski esbuild dosyası için Windows cleanup uyarısı çıktı; kullanıcı süreçleri zorla sonlandırılmadı. Yeni araç zinciriyle build geçti.

## Otomatik doğrulama

Önceki dört `.test.ts` dosyası yalnız export edilen fonksiyonlardan oluşuyordu; test runner/script ve test kaydı yoktu. Bunlar çalıştırılabilir Vitest testlerine dönüştürüldü. Eski “örnek veri mutlaka bulunmalı” kontrolü, kullanıcının örnek veri istememe kararı doğrultusunda boş açılış ve gerçek kayıt davranışıyla değiştirildi.

5 Kasım 2026 çalıştırılan `npm run verify`:

- TypeScript: geçti.
- Vitest: **13 dosya, 57 test geçti**.
- `npm audit`: **0 zafiyet**.
- Üretim web build: geçti.

React hata sınırı testinde kasıtlı hata üretilir; testin amacı diğer pencerenin ayakta kaldığını ve ham hatanın UI'a sızmadığını doğrulamaktır. Zod paketindeki PURE yorumlarına ilişkin iki Rollup derleme uyarısı var; build'i durdurmuyor. ESLint henüz kurulmadı. Native, SQLite, fiziksel baskı, şifreleme ve yedek restore testleri bu sayılara dahil değildir.

## Tema ve arayüz performansı

### Akıllı bölmede somut ikinci düzeltme

`useWindowDragMaximize` effect'i eski `layoutBounds` nesnesine bağımlıydı. Yeni sınır nesnesi gelince önceki hareket cleanup ile duruyor, tiled/maximized boolean'ları aynı kaldığında tekrar başlamıyordu. Böylece eski sürükleme offset'i yarıda kalabiliyordu. Bağımlılık artık yalnız mod değişimine bağlı; devam eden sıfırlama yeni hücre sınırında kesilmiyor. Bu hata yolu ve eski serbest konuma dönüş iki davranış testinde sınanıyor.

İkinci bulgu: yönetici ekran değişimini dinlemiyordu, sabit yüzdeli üst/alt boşluklar küçük ekranda navbar/Dock ile çakışabiliyordu. Ortak viewport kaynağı tek resize dinleyicisi ve kare başına tek yayın kullanır; aynı ölçüde yayın yapmaz, dinleyici kalmayınca bekleyen işi iptal eder. Bölme ve manuel snap bu ölçüden yeniden hesaplanır; aynı sınırda state yeniden yazılmaz. Bölünmüş pencerede serbest resize tutamaçları kapatıldı. İçerik ekranın değil kendi pencere genişliğinin container query'lerine göre sarılır.

2/3/4 pencere için 1366×768, 1920×1080, 2560×1440 geometrileri pozitif alan, taşmama ve çakışmama testlerinden geçti. Hook testlerinde pencere ekleme/kapama, ekran değişiminde 3→2 sütun, manuel snap ve maximize korunması denetlendi. Bunlar native ekran/DPI kabulünün tamamı değildir.

Gerçek tarayıcıda sürüklenmiş pencereyi bölme denendi. 1920×1080'de üç pencere `x=16/649/1283`, `y=84`, `w=621`, `h=892`; bütün transform'lar `none`. Normal 1382×1084 görünümünde dört pencere `x=16/697`, `y=84/538`, `w=669`, `h=442`; son sağ sınır 1366, alt sınır 980. Navbar/Dock boşlukları korunur. [Dört pencerenin ekran görüntüsü](docs/evidence/studio-smart-layout-20261105.jpg).

Bu kontroller sıfır FPS kaybı veya belirli FPS garantisi değildir; layout geçişi, gerçek donanım ve yüksek çözünürlüklü iş yüküyle ayrıca ölçülmelidir.

Açık/koyu tema için 280 ms View Transition eklendi; desteklemeyen ortamda renk geçişi, azaltılmış hareket tercihinde doğrudan güncelleme var. Hızlı ardışık tema seçiminde son tercih kazanır; üç davranış testi bulunur. Tarayıcıda tema değiştirirken kaydedilmemiş form değeri korundu. Açık tema logo/filigran ve objektif halkaları düzenlendi. Objektif, navbar ve Dock için ayrılan boşluklara göre ölçeklenir; Dock etiketleri daha okunaklı yazı ve klavye odağıyla düzenlendi.

Yeni Studio simgesi, MarbleOS'un üç katmanlı çizimini kâğıt ve kalemle birleştirir. Uygulama ve tarayıcı sekmesi aynı SVG'yi kullanır. Açık kâğıt ile grafit çerçevenin koyu temadaki görünümü yerel önizlemede kontrol edildi. [Koyu tema ekran görüntüsü](docs/evidence/studio-dark-icon-20261105.jpg).

Görsellerde lazy/async decode ve Dock'ta gereksiz kalıcı layer ipucunun kaldırılması uygulandı. `?motion-profile=1` yalnız geliştirme ortamında kısa rAF ölçümü açar; normal adreste çalışmaz. Ölçüm özeti ve sınırları [performans belgesinde](docs/PERFORMANS_VE_GORUNTU.md). Bu ölçüm GPU kullanımı, fiziksel ekran FPS'i veya 4K/8K işleme kapasitesi kanıtı değildir. Gerçek GPU görüntü işleme motoru henüz yok.

Tam görev listesi [YAPILACAKLAR.md](YAPILACAKLAR.md); şifreleme, anahtar kurtarma ve gelecekteki lisanslama [güvenlik belgesinde](docs/GUVENLIK_VE_LISANS.md). Bunlar plan; şifreleme ve lisans doğrulama uygulanmış değildir.

## Üretimden önce kalan kritik işler

1. **Yerel masaüstü.** Tauri girişi, Cargo, ana pencereye bağlı üç komut ve kurulum ikonu eklendi. Rust 1.99.1 x64 MSVC doğrulandı. Visual Studio Installer henüz C++ iş yükünü tamamlanmış göstermiyor. Windows derleme ve kurulum kabulü açık.
2. **SQLite ve medya.** Sürümlü migration, AppData deposu, dosya içeriği denetimi, ayrı orijinal/önizleme ve eşzamanlı kayıt koruması native kaynakta var. Tarayıcı önizlemesi eski localStorage yolunu kullanır. Windows'ta depo ve IPC bütünleşme testi açık.
3. **Veri koruma.** SQLite iş kaydı ve medya için Windows kullanıcı kapsamlı DPAPI kodu eklendi. Harici şifreli yedek, başka bilgisayarda kurtarma ve kurulu uygulamada şifreleme kabulü açık.
4. **SQL:** `schema.ts` çağrılmayan taslak; çapraz okul/dönem composite FK, güçlü CHECK/UNIQUE, sürümlü migration ve gerçek DB davranış testleri eksik.
5. **Profesyonel çıktı:** gerçek DPI, font/ICC, PDF/TIFF ve lab/kesim/ön-arka hizası testleri yok. `window.print()` masaüstü ekranı için taslaktır.
6. **İçe alım ve büyük işler:** XLSX sütun eşleme/önizleme, çok satırlı CSV, iş iptal/kurtarma, dosya decode/piksel sınırları ve büyük okul performansı eksik. Tarayıcı prototipindeki küçük batch sınırları ürünün nihai kapasitesi değildir.
7. **Pencere erişilebilirliği:** tam klavye odak yönetimi, ekran okuyucu, serbest sürüklenmiş pencerelerin ekran küçülünce yeniden sınırlandırılması ve tüm JS hareketlerinde reduced motion kabulü henüz yok. Akıllı bölme/manuel snap viewport değişiminde güncellenir; serbest pencere/DPI/çok monitör kabulü ayrıca gerekir.
8. **Kurulum.** Tauri taslağı Vite ile aynı `127.0.0.1:1420` adresini kullanır ve WebView2 için `offlineInstaller` seçer. İmzalı paket üretimi, temiz Windows'ta çevrimdışı kurulum ve veri koruyan yükseltme kabulü gerekli.
9. **Beş dil:** hazırlık sayfasında var; masaüstü uygulama henüz Türkçe sabit metinlerden oluşuyor.

Bu eksikler `MIMARI_VE_PLAN.md` içinde fazlara ayrıldı. Önce Windows'ta yerel kayıt yolu doğrulanacak. Yedek ve geri yükleme bundan sonraki üretim kabulüdür.

## 6 Kasım yerel temel doğrulaması

Önceki tablodaki beş yüksek bulgunun düzeltmeleri korunuyor. Okul ve dönem metni tekrar kontrolünden önce kırpılır. Değişen kadraj veya eşleşme önce kaydedilir, baskı onayı ayrı işlemde verilir.

- 63 TypeScript davranış testi geçti. Bunlar native çağrı onayı gelmeden veri yayınlamamayı, eşzamanlı isteklerin sıraya alınmasını, çatışmada yenilemeyi ve okuma hatasında tarayıcı deposuna geçmemeyi de kapsar.
- Sürümlü migration gerçek SQLite motorunda çalıştırıldı. Sürüm, benzersiz medya kimliği, hatalı kayıt reddi ve transaction rollback doğrulandı.
- Windows DPAPI işletim sistemi düzeyinde ayrı denendi. Aynı kullanıcı ve kapsam veriyi açtı, yanlış kayıt kapsamı reddedildi. Bu deney Rust/Tauri bütünleşme testi değildir.
- Rust bağımlılıkları `src-tauri/Cargo.lock` dosyasına kaydedildi. `scripts/build-windows.ps1` sözdizimi doğrulandı. Visual Studio denetimi C++ iş yükünü tamamlanmamış gösterdi. Ayrı Rust programını derleme deneyi `link.exe not found` ile durdu. Windows, bekleyen yeniden başlatma bildirdi.
- Excel'de çok sınıflı XLSX aktarımı ve sınıfa göre fotoğraf çalışma akışı, kullanıcının isteğiyle mevcut fotoğrafçı programı incelenene kadar beklemede.

## Git ve yayın

Bu klasör bağımsız geliştirme klasörüdür; Git deposu oluşturulmadı. Kullanıcının göndermeme talebi korundu: commit/push/deploy yapılmadı. Ana MerbleOS deposuna kod değişikliği uygulanmadı; mevcut muhasebe AI çalışmaları bırakıldı. Ana depo kontrolünde dal `merbleos-test`, yerel HEAD/origin farkı 0 ileri / 0 geri idi; çalışma ağacı önceki değişiklikler nedeniyle temiz değildi.
