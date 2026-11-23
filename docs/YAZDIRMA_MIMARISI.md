# Uygulama içi yazdırma — altyapı sözleşmesi

5 Kasım 2026. Kullanıcı kararı: yazıcı/kağıt/ölçek ayarları MarbleOS Studio'nun kendi Baskı Merkezi penceresinde yapılacak. Şimdilik altyapı ve tasarım hazırlanıyor; gerçek yazıcı bağlantısı bu belgede uygulanmış değildir.

## Mevcut ile hedef

Mevcut `window.print()` tarayıcının yazdırma penceresini açar ve mevcut belgeyi yazdırır; yazıcı seçimi parametresi almaz. Mevcut “Ekranı Yazdır (taslak)” gerçek albüm çıktı motoru değildir. [MDN print()](https://developer.mozilla.org/en-US/docs/Web/API/Window/print).

Hedef: React Baskı Merkezi → tipli Tauri komutları → Windows yazıcı hizmeti → Windows sürücüsü/kuyruğu. Windows yazıcı API'leri seçilen yazıcıya doğrudan bir aygıt bağlamı oluşturmayı destekler; standart yazdırma diyalogunun her işte açılması zorunlu değildir. Bu, kurulacak native backend için teknik yaklaşımdır. [Microsoft yazıcı aygıt bağlamı](https://learn.microsoft.com/en-us/windows/win32/printdocs/retrieving-a-printer-device-context).

## Bizim penceremizdeki ayarlar

- Gerçek yüklü/bağlı yazıcılar; varsayılan işaretli ama kullanıcı seçimi açık. Sahte yazıcı listesi yok.
- Seçilen cihazın desteklediği kağıt boyutu ve tepsi, yatay/dikey yön, adet, sayfa aralığı ve harmanlama.
- Destek varsa renk/gri, kalite ve çift taraflı baskı. Desteklenmeyen seçenek seçilebilir gösterilmez.
- Fotoğraf ürünlerinde mm ile ölçü, %100 gerçek boyut veya açıkça seçilen sığdırma, kesim/taşma/güvenli alan ve ön-arka hizalama.
- Aynı çıktı tarifini kullanan sayfa önizlemesi; ölçeği sessiz değiştirme yok. Renk yönetimi uygulamada mı sürücüde mi yapılacak belirlenir; iki kez dönüşüm uygulanmaz.
- “Yazdır” sonrasında uygulama içi iş durumu, hata ve kullanıcının işini iptal etme yolu.
- İsteğe bağlı “Gelişmiş yazıcı ayarları” üreticinin özellik penceresini açabilir. Her sürücünün özel ayarını yeniden tasarlama sözü verilmez. [Microsoft DocumentProperties](https://learn.microsoft.com/en-us/windows/win32/printdocs/documentproperties).

## Native sınır ve performans

1. İlk teknik deney gerçek Windows API'leriyle yazıcı listeleme/yetenek doğrulama ve tek ölçülü test sayfasıdır. `EnumPrinters` yerel ve önceden bağlı yazıcıları listeleyebilir; geniş ağ taraması yapılmaz. [Microsoft EnumPrinters](https://learn.microsoft.com/en-us/windows/win32/printdocs/enumprinters).
2. Önerilen komutlar: `list_printers`, `get_printer_capabilities`, `validate_print_settings`, `submit_print_job`, `get_print_job`, `cancel_print_job`. İsimler sözleşme taslağıdır; henüz callable komut yok.
3. Renderer yalnız kayıtlı çıktı/iş kimliği ve sınırlı ayar DTO'su yollar. Serbest dosya yolu, shell komutu veya renderer'ın hazırladığı ham spool verisi kabul edilmez. Yazıcı ve çıktı kimliği native tarafta yeniden doğrulanır.
4. Windows sürücü ayarları normalize/doğrulanır. DEVMODE/PrintTicket seçimi ve PDF/XPS/GDI çıktı yolu teknik deneyden sonra kesinleştirilir. Rastgele bir PDF'yi RAW olarak yazıcıya göndermek genel PDF yazdırma çözümü sayılmaz.
5. Önizleme/görüntü üretimi ve bloke olabilen sürücü/kuyruk çağrıları UI thread'inde çalışmaz. Sayfa bazlı sınırlı bellek ve iş kuyruğu kullanılır; 8K resimlerin hepsi aynı anda decode edilmez. Microsoft spool çağrılarının senkron/bloke olabileceğini belirtir. [Microsoft StartDocPrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/startdocprinter).
6. Veritabanı `export_jobs` ile çıktı üretimini, ayrı `print_jobs` ile kuyruğa teslimi tutar. İkincisi yazıcı referansı, çıktı sürümü/hash'i, ayar özeti, spool iş kimliği ve durum geçişlerini içerir. İkinci kez tıklama aynı işi sessiz çoğaltmaz; yeniden baskı açık yeni komuttur.
7. “Kuyruğa alındı” fiziksel çıktı alındığı anlamına gelmez. İptal isteği de çoktan basılmış kağıdı geri alamaz. Durum mesajları yalnız ölçülen/geri dönen sonucu söyler; belirsiz işte otomatik yeniden gönderim yok.
8. Ağ yazıcısı kullanıcı seçerse yazıcıya belge gider; bulut paylaşımı açılmaz. Kuyruk geçici dosyaları ve OS spool alanı da veri saklama modeline dahil edilir. Uygulama deposunun şifreli olması Windows spool dosyalarının da şifreli olduğu iddiasına dönüşmez.

## Kabul sırası

- [ ] Tauri/Rust temeli ve dar yetkili yerel komut sınırı.
- [ ] Gerçek yazıcılar, cihaz yetenekleri ve varsayılan ayarların alınması.
- [ ] Bizim penceremizden tek test işi: standart Windows print diyalogu açılmadan seçilen yazıcıya gönderim.
- [ ] Kuyruk kimliği/hata/iptal; bağlantı kesilmesi ve sürücü beklemesi sırasında Dock/pencerelerin yanıt vermesi.
- [ ] Adet, kağıt/tepsi, desteklenen duplex, yön ve sayfa aralığının gerçek cihazda doğrulanması.
- [ ] Cetvelle %100 ölçü, kesim, kenar dışı alan ve ön/arka hizası; renk profili/lab test baskısı.
- [ ] Büyük sayfalar, 4K/8K fotoğraflar ve farklı sürücülerde bellek/iş süresi/arayüz ölçümü.
- [ ] Yazıcı yoksa açık durum; boş/sahte liste veya “başarılı” mesajı yok. Kullanıcı isterse ayrıca PDF dışa aktarım.

Bu kabul yapılmadan doğrudan yazdırma, kusursuz sürücü uyumu veya profesyonel baskı kalitesi tamamlandı denmez.
