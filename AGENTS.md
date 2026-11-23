# MarbleOS Studio — AI & Mühendislik Sözleşmesi (AGENTS.md)

## Önce oku ve gerçek durumu koru

1. `README.md`, `MIMARI_VE_PLAN.md`, `docs/YEREL_VERI_VE_SQL.md`, `KONTROL_RAPORU.md`.
   Görev durumu: `YAPILACAKLAR.md`; güvenlik/lisans: `docs/GUVENLIK_VE_LISANS.md`; büyük görüntü/CPU/GPU: `docs/PERFORMANS_VE_GORUNTU.md`.
2. İlgili kod, çağıranlar ve testler; planlanan ile çalışan özelliği ayır.
3. Kullanıcının son kararı: **Windows masaüstü + yerel SQLite/dosya depolama; bulut daha sonra istenirse.** Uygulama boş başlar; sahte okul/kişi/fotoğraf/sipariş ekleme. Test fixture'ları uygulama girişinden import edilemez.
4. Tarayıcı önizlemesi IndexedDB kullanır ve eski v4 localStorage kaydını korur. Tauri yolu `src-tauri/migrations/` ve Rust yerel deposuna bağlıdır. `schema.ts` gelecekteki ilişkisel şema taslağıdır. Windows derlemesi ve kurulum kabulü doğrulanmadan hazır deme.

## 1. Dosya Satır Sınırı Kuralı (240 – 350 Satır)
- Tüm `.ts` dosyaları en fazla **240 toplam satır**, tüm `.tsx` ve `.css` dosyaları en fazla **350 toplam satır** (boş satırlar ve yorumlar dahil) olmalıdır.
- Kod sıkıştırılarak (tek satıra yığılarak) bu sınır aşılmaz. Bir dosya büyüdüğünde aynı izole domain/modül altında tek sorumluluklu alt dosyalara bölünür.

## 2. Katı Modül ve Sistem İzolasyonu
- `public/` klasörü yayındaki hazırlık sayfasına aittir ve ayrı tutulur.
- `src/modules/<modül-adı>/` altındaki hiçbir modül başka bir modülün iç dosyalarını import edemez.
- Ortak sistem servisleri `src/system/{brand,desktop,motion,sqlite,storage,sync,theme}` altında birbirinden izole klasörlerde bulunur.
- Sorgu/mutation adaptörleri `src/system/query/`, ortak input şemaları `src/system/schemas/` içindedir. Geometri ile iş verisinin state sahibi ayrı kalır.
- Mevcut dört uygulama kimliğini koru; yeni pencere yöneticisi, bağımsız iş verisi cache'i veya aynı domain'in ikinci dizinini üretme.

## 3. Pencere, Dock ve Animasyon Standardı
- Tüm modüller `src/window-system/WindowFrame.tsx` ve `WindowControlCapsule.tsx` ile pencere mantığında çalışır.
- Pencere açılış/küçültme/kapanış hareketleri Dock ikon koordinatlarına (`useWindowDockLifecycle.ts`) göre `easeAppleGenieOpen` / `easeAppleGenieClose` ile akar.
- Odak değişimi `220ms` `WindowFocusSurface` ile yalnızca `opacity` ve `transform` günceller; pencere içeriği asla remount edilmez.
- Alt görev çubuğu (`StudioDock.tsx`) 3D rengarenk ekosistem ikonları (`StudioDockIcons.tsx`) ve Gaussian büyüteç (`dockMagnification.ts`) kullanır.
- **Form Kartları (`OriginSheet` & `useSheetMorph` — Kesin Koruma Kuralı):** Projeye eklenen tüm yeni modal/form/düzenleme pencereleri zorunlu olarak `useOriginSheet` + `OriginSheet` (`src/window-system/sheet/`) kullanır. Kart tıklanan butonun gerçek kutusundan (`relativeTriggerRect`) `springOriginSheet` ve yatay `scale3d(currentW / targetW)` eşlemesiyle büyüyerek açılır (sağdan/soldan kırpılmaz, butonun mavi/beyaz arka plan rengini karta taşımaz); kapanırken aktif odak (`blur()`) temizlenir, içerik yarı yolda erir ve `.os-sheet-ghost` belirerek kart `easeOriginSheetClose` (`0.34s`) ile tıklanan butona dönüşüp yerine oturur. Bu animasyon mimarisi kesinlikle değiştirilmez veya bozulmaz.
- **Sayfa İçi Geçişler ve Özel Seçiciler (Sabit Standart):** Ham tarayıcı `<select>` kesinlikle kullanılmaz; tüm açılır seçiciler `AppleSelect` (`src/window-system/sheet/AppleSelect.tsx`), sekme seçiciler kayan `xl-glass-pill` (`AppleGlassSegment`) kullanır. Modül içi sayfa/sekme ve seçili denetçi kartı geçişleri `AppleCrossfadeSlot` (`src/system/motion/AppleCrossfadeSlot.tsx`) ile 1×1 Grid üzerinde yalnızca GPU compositor (`opacity` + `transform`, durgun halde `transform: none`, sıfır CPU/layout yükü) kullanılarak yapılır.

## 4. Kesin Tasarım Kuralları (Apple Pro Saf Siyah & Sıfır Baloncuk)
- **AI Baloncuk/Hap Rozet Yasağı:** Üst barda, pencere başlığında veya içerikte `BY MARBLEOS`, `SQLITE • ÇEVRİMDIŞI` gibi etrafı çizgili/kutulu hap baloncuklar (`pill badge`) kesinlikle kullanılmaz; düz, yalın ve keskin tipografi kullanılır.
- **Turuncu Yasağı:** Butonlarda, çerçevelerde, slider'larda veya aktif seçimlerde turuncu renk kesinlikle kullanılmaz.
- **Tam Saf Siyah (`#000000`) Dark Mode & Tıraşlanmış Çerçeveler:** Karanlık mod tam siyah (`#000000` / `#060607`) zeminde çalışır. Pencerelerde ve iç kartlarda göze batan çizgili çerçeveler bulunmaz; tıraşlanmış Apple tarzı pürüzsüz yüzey geçişleri kullanılır.
- **Tam Ekran Büyütme (Full Screen Maximize):** Pencere büyütüldüğünde (`isMaximized`) boşluk bırakmadan tam ekran (`left: 0`, `top: 0`, `100vw × 100vh`, `borderRadius: 0`) kaplar.
- **Ultra İnce Scrollbar:** Kaydırma çubuğu `3px` inceliğinde, oksuz ve izsiz profesyonel Apple tarzındadır.

## 5. Windows masaüstü ve yerel depolama

- Hedef EXE/MSI kurulumudur; Cargo/CLI/native bağlantı ve gerçek cihaz kabulü olmadan “kuruluma hazır” deme. Microsoft Store sonra ele alınır; Tauri otomatik MSIX üretmez.
- Hedef veri kökü `%LOCALAPPDATA%\MarbleOS-Studio\`: `data/`, `media/originals/`, `media/previews/`, `projects/`, `exports/`, `backups/`, `logs/`. Kullanıcı adı hardcode edilmez.
- Native ilk açılış SQLite migration'ını çalıştırır. Kullanıcıya SQL çalıştırma işi yüklenmez. Tarayıcı verisi için ayrı, açık aktarım akışı tasarlanır.
- Kişisel müşteri verisi kaynak klasöre, public/static/dist içine veya Git'e konmaz. Fotoğraflar veritabanı yerine yönetilen yerel dosya alanında tutulur.
- Cloud hesabı, Supabase/PostgreSQL veya otomatik ağ gönderimi şimdi ekleme. İş akışı internet kapalıyken ve hesap açmadan tamamlanmalı.

## 6. Veri, hata ve güvenlik

- Zod her uygulama girişinde; native komutta tekrar DTO/kapsam/boyut doğrulaması. Renderer yetki kaynağı değildir. Serbest SQL/shell veya genel filesystem erişimi açma.
- Parametreli sorgu, FK/constraint, atomik transaction; okul/dönem kapsamı ve fotoğraf-kişi eşleşmesini koru. Eşleştirme/boyut değişince eski baskı onayını geçersiz kıl.
- React Query SQLite okuma/mutation durumunu yönetebilir. Disk commit olmadan başarı/cache güncellemesi yok. Yerel prototip tek external store üzerinden okunur; bunu gerçek SQLite diye adlandırma.
- Dosya türünü decode/imza ve piksel/boyut limitleriyle doğrula; orijinali değiştirme, kök dışına yol kaçışını engelle. CSV formüllerini etkisizleştir; içe alımda boş hücreleri filtreleyerek sütun kaydırma.
- Okuma hatasında sessiz boşaltma, kota hatasında sahte kayıt, onaysız fotoğraf atama ve sunucu yanıtı olmadan eşitlendi bildirimi yasaktır.
- Modül hata sınırını koru; async hataları ayrıca ele al. Ham veri/stack/anahtar ekrana veya loglara dökülmez.
- SQLite ve dosyalar için şifreleme/anahtar kurtarma ile DB+orijinal yedek birlikte tasarlanır; localStorage veya AppData tek başına şifreleme değildir.

## 7. Doğrulama ve teslim

- `npm run verify`: typecheck, Vitest, audit, build. Bu projenin kendi yerel kontrolüdür; ana MerbleOS deposunun kancasının yerine geçmez.
- Güvenlik/bütünlük değişiminde davranış testi gerekir. `.skip/.only/.todo`, düşürülmüş eşik veya silinen assertion ile yeşil elde etme.
- Native/SQLite/çıktı henüz yoksa bunların test edildiğini söyleme. İmzalı kurulum, ağ kapalı açılış, restart, disk dolu, bozuk yedek ve fiziksel baskı kabulü ayrıca gerekir.
- Kullanıcının Git'e göndermeme talebi geçerli: izinsiz commit/push/deploy yok. Ana MerbleOS deposundaki mevcut çalışmalara dokunma.
