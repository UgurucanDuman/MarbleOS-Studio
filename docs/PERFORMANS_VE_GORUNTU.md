# Animasyon, CPU/GPU ve yüksek çözünürlük planı

6 Kasım 2026. Windows yerel aktarımı en fazla 150 dosya, dosya başına 10 MB ve kayıt grubu başına 16 MB kabul eder. Orijinal görüntü en fazla 8.192 piksel genişlik ve yükseklik ile 40 MP toplam piksel sınırından geçer. Galeride 512 piksellik önizlemeler kullanılır. Yüksek çözünürlüklü 150 dosya ile uçtan uca süre ve bellek ölçümü ayrı kabul maddesidir.

## Büyük fotoğrafın maliyeti

Bir RGBA8 decode tamponu yaklaşık `genişlik × yükseklik × 4` byte yer kaplar. Kendi hesabımız: 3840×2160 yaklaşık **31,6 MiB**, 7680×4320 yaklaşık **126,6 MiB**. Orijinal sıkıştırılmış JPEG boyutu bu bellek maliyetini göstermez. Kaynak, çıktı, çalışma tamponları ve GPU texture kopyaları aynı anda tutulursa ihtiyaç artar. 16-bit/float/RAW işlemede format maliyeti ayrıca hesaplanır.

“8K” tek bir fotoğraf ebatı standardı sayılmaz. Gerçek piksel ölçüleri, codec, bit derinliği, EXIF yönü, ICC ve dosya boyutu doğrulanır; desteklenen profil listesi ölçülerek yayınlanır. RAW/HEIC, JPEG/PNG desteğinden otomatik türetilmez.

## Diskten ekrana boru hattı — yapılacak

1. Kullanıcı dosyayı seçer; native hizmet dosya imzası/piksel/boyut sınırını kontrol eder. UUID ile yönetilen orijinal alanına kopyalar, hash ve metadata kaydeder.
2. Orijinal değişmez. 256/512 px thumbnail ve örneğin en uzun kenarı 1600 px ekran önizlemesi ayrı, yeniden üretilebilir cache'tir; boyutlar cihaz ölçümüyle kesinleşir.
3. Galeri yalnız görünür satır/kareleri sanallaştırır. SQL sayfalı sorgu kullanır; 10.000 kişinin bütün fotoğrafı ve metadata'sı tek React snapshot'ında tutulmaz.
4. Aynı anda decode edilecek iş sayısı CPU çekirdeği sayısına körlemesine eşitlenmez. Açılmış görüntü byte bütçesi, aktif iş ve GPU belleği hesaba katılır; ilk güvenli profil 1 ağır iş + sınırlı thumbnail işi olarak denenir.
5. Büyük görselde ROI/tile işleme ve gerekli çözünürlük düzeyi seçilir; grafik kartı texture sınırını aşan dosya tek texture'a zorlanmaz.
6. Önizleme interaktif düşük maliyetli olabilir; son baskı orijinal ve sürümlü tariften gerçek kalite/renk profiliyle üretilir. Küçük thumbnail çıktı kaynağı olmaz.
7. İş iptal/öncelik/ilerleme/kaldığı yerden güvenli devam etme desteğine sahip olur; disk/DB işi main UI thread'ini kilitlemez.
8. Kullanılmayan bitmap, object URL, canvas ve GPU texture'ları bırakılır; LRU cache byte bütçesine tabidir. [ImageBitmap.close](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close).

## CPU ve GPU

- Tauri native hizmette decode, dosya/hash, DB ve PDF işleri sınırlı job pool üzerinde çalışmalı; async handler içine bloklayan ağır iş yığılmaz. [Tauri process model](https://v2.tauri.app/concept/process-model/).
- Uygun crop/renk önizleme operasyonları WebGL/WebGPU veya native GPU arka ucuyla hızlandırılabilir. Backend, cihaz desteği/driver/renk doğruluğu ve lisans/dağıtım denemesiyle seçilecek; şu an seçilip uygulanmadı.
- Worker/OffscreenCanvas uygun destek varsa UI'dan iş ayırabilir; **OffscreenCanvas kullanmak tek başına tüm işin GPU'da çalıştığı anlamına gelmez**. [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).
- GPU yoksa, devre dışıysa veya context/device kaybolursa CPU fallback ile iş korunur. “Auto / CPU / GPU (destekleniyorsa)” ayarı ve anlaşılır hata/kurtarma akışı tasarlanır.
- GPU hızlandırmalı önizleme ile CPU son çıktısı piksel/renk doğruluğu bakımından karşılaştırılır. Daha hızlı olmak tek kabul ölçütü değildir.
- Ekran kartını zorla devreye sokan bir CSS etiketi yoktur. WebView/OS compositing kararı ile fotoğraf hesaplama motoru farklıdır; GPU kullanım yüzdesi ölçülmeden kullanılıyor diye raporlanmaz.

## Animasyon standardı

- Pencere odağı 220 ms opacity/transform; tema 280 ms crossfade. Renk değişimi tüm masaüstünü remount etmez; form/düzenleme state'i korunur.
- Sürükleme MotionValue ile, pointer/resize yayını rAF ile ekran karelerine bağlanır. `setInterval(16)` veya “her cihazı 60 FPS'e sabitle” yaklaşımı yok. [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
- 60 Hz için kare bütçesi yaklaşık 16,7 ms, 120 Hz için 8,3 ms, 144 Hz için 6,9 ms. Bunlar hedef bütçeler; ölçülmüş ürün performansı değildir.
- Transform/opacity compositor için uygundur; width/height, top/left, SVG filtreleri ve blur repaint/layout maliyeti ayrıca profile edilir. `will-change` her elemana kalıcı eklenmez.
- Dock büyüteci az sayıda ikon için width layout'u kullanıyor; yeniden yazmadan önce trace ile maliyeti ölçülür. Gizli/minimize modüller state korurken sürekli iş/preview decode çalıştırmamalı.
- Azaltılmış hareket tema geçişinde uygulanıyor. Tüm Dock/pencere JS hareketleri ve klavye/focus kabulü ayrıca tamamlanacak.

## Yapılan küçük iyileştirmeler

- Tema için native View Transition API ve uyumlu fallback; hızlı seçimde eski callback son tercihi ezemez. Pencere state'i korunur.
- Light filigran/ikon ve objektif dış çizgileri light palete uyarlandı.
- Dock'ta kalıcı width/height `will-change` kaldırıldı. Thumbnail'lerde lazy ve async decode kullanılıyor. Bunlar görüntü boyutlandırma, sanallaştırma veya native GPU motoru değildir.
- Akıllı bölmenin state/effect döngüsü giderildi; rAF pointer yaşam döngüsünde iptal/cleanup var.
- Üst bar ve Dock cam katmanları GPU katmanına izole edildi (`contain: layout paint` ile saat kutusu yalıtıldı); pencere tam ekranken veya sekme gizliyken arkada kalan masaüstü saat/widget zamanlayıcıları durduruldu. Görsel buzlu cam (`backdrop-filter`) değerleri korunur.

## Yerel ölçüm ve sınırları

`npm run dev` ile yalnız geliştirmede `http://127.0.0.1:1420/?motion-profile=1` açılır. İlk pointerdown 6 saniyelik rAF aralığı örneğini başlatır. Sonuç yalnız yerel developer console'a çıkar; kişisel veri/ağ gönderimi yok. Sekme gizlenirse ölçüm iptal edilir; kalıcı boşta döngü çalışmaz. Üretim build'inde profiler kurulmaz.

5 Kasım 2026 in-app browser örneği: 986 aralık, median **5,6 ms**, p95 **6,7 ms**, en uzun **72,2 ms**, medianın 1,5 katını aşan 48 aralık. Burada raporlanan yaklaşık 178,6 Hz **rAF callback ritmidir**; fiziksel ekranın Hz'i, GPU FPS'i veya bütün animasyonun düşmesiz çalıştığının kanıtı değildir. Dev ortamı/otomasyon yükü ve kısa stall'lar dahil. 72,2 ms sıçrama nedeniyle kusursuz animasyon iddiası yapılmaz; production trace ile kaynağı ayrıştırılmalı.

Tarayıcıda açık/koyu değişimi, pencere açma/küçültme ve tema değişirken kaydedilmemiş form yazısının korunması kontrol edildi. Müşteri kaydı oluşturulmadı. Yüksek çözünürlük, GPU kullanım yüzdesi ve büyük veri performansı bu ölçüme dahil değildir.

## Performans kabul listesi

- [ ] Production/native build'de pencere/dock/tema etkileşimi için frame trace, p95/p99, uzun task ve dropped frame ölçümü.
- [ ] Gerçek 4K/8K JPEG/PNG koleksiyonu, bozuk/aşırı piksel dosyası, EXIF ve ICC çeşitleri.
- [ ] 1.000 ve 10.000 kayıtta sorgu, sanal galeri, ilk görünür thumbnail ve sayfa geçişi.
- [ ] RAM/VRAM, CPU/GPU yükü, disk I/O; işlem sonrası kaynakların serbest bırakılması ve uzun tekrar döngüsünde büyüme kontrolü.
- [ ] Entegre/dahili GPU, harici GPU, hızlandırma kapalı, context kaybı, düşük bellek ve termal kısıt senaryoları.
- [ ] Aynı işte CPU/GPU çıktı doğruluğu; iptal ve yeniden başlatma veri kaybı üretmiyor.
- [ ] Zayıf donanımda çözünürlük/cache/concurrency kademeli azalırken kullanıcı işi ve orijinal kalite korunuyor.
