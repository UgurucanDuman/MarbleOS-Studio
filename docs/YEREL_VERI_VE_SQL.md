# Yerel veri, SQLite ve kurtarma sözleşmesi

6 Kasım 2026. Tauri yolunun ilk migration'ı `src-tauri/migrations/001_local_workspace.sql` dosyasında. `src/system/sqlite/schema.ts` gelecekteki ilişkisel şemanın çağrılmayan taslağıdır. Tarayıcı önizlemesi IndexedDB kullanır ve eski v4 kayıtlarını yerinde korur.

İlk masaüstü sürümü SQLite'ta sürüm numarası ve DPAPI korumalı çalışma kaydı tutar. Öğrenci ve fotoğraf ilişkileri Rust'ta doğrulanır. Medya kayıtları rastgele kimlikle yönetilir, orijinal ve 512 piksele kadar önizleme ayrı şifreli dosyalarda saklanır. Sürümü eskimiş bir yazma isteği reddedilir. Kullanıcı kaydı SQLite işlemi tamamlandıktan sonra görür.

Bu ilk şemada SQLite başlığı, sürüm ve rastgele medya kimlikleri görülebilir. Okul, öğrenci, fotoğraf adı ve düzenleme verileri şifreli içeriktedir. İlişkisel ve sayfalı şema, harici yedek/geri yükleme ve mevcut tarayıcı kayıtlarını içe alma sonraki çalışmadır.

## Kullanıcının göreceği mantık

Windows uygulamasını kur → programı aç → kendi stüdyo/okulunu ekle → internet olmadan çalış. SQLite uygulamanın içinde çalışan dosya tabanlı veritabanıdır; ayrı sunucu kurulumu veya SQL komutu yoktur. [SQLite uygulama kullanım rehberi](https://www.sqlite.org/whentouse.html).

Kök dizin `%LOCALAPPDATA%\MarbleOS-Studio\` olacak. Windows adı hardcode edilmez; işletim sisteminin yerel veri dizininden hesaplanır. Bu belge bir klasör oluşturulduğunu iddia etmez.

| Alt yol | Sahibi / içerik |
| --- | --- |
| `data/marbleos_studio.db` | Yerel SQLite; kişiler, kapsamlar, işler, tarifler, şablon referansları ve işlem durumu |
| `media/originals/<uuid>.<ext>` | Değiştirilmeyen fotoğraflar; kullanıcı dosya adı ayrı metadata |
| `media/previews/` | Boyutu sınırlı, yeniden üretilebilir önizlemeler |
| `projects/` | Tasarım varlıkları; kritik kaynaklar yedek kapsamına dahil |
| `exports/` | İstendiğinde yeniden üretilebilir PDF/görüntü ve manifest; kullanıcı başka hedef seçebilir |
| `backups/` | Uygulama kurtarma noktaları; tek diskte bulunması disk arızasına karşı yeterli yedek değildir |
| `logs/` | Fotoğraf/öğrenci adı/iletişim bilgisi içermeyen hata kodları ve teknik sürüm |

## Komut ve veri sınırı

React ekranı → React Query → tipli yerel komut adaptörü → Rust doğrulama/kapsam kontrolü → SQLite transaction + yönetilen dosya hizmeti.

Zod erken hata için korunur. Rust tarafı ayrıca input tipi, alan uzunluğu, batch/piksel/boyut sınırı ve kaydın okul/dönem ilişkisini denetler. Renderer serbest SQL veya dosya yolu yollayarak işlem yapamaz. Tauri SQL eklentisi SQLite ve migration desteği sunar; bu üründe plugin'in genel SQL arayüzünü renderer'a açmak zorunda değiliz. [Tauri SQL dokümanı](https://v2.tauri.app/plugin/sql/).

Tek DB state sahibi yerel veritabanıdır. React Query okuma cache'i ve mutation sonucunu taşır; commit olmadan “kaydedildi” göstermez. Mevcut tarayıcı external store adaptörü geçicidir; ikinci bağımsız gerçek veri kaynağına dönüştürülmez.

## Planlanan tablo aileleri

| Aile | Tablolar / ana ilişki |
| --- | --- |
| Kapsam | `studios`, `schools`, `academic_years`, `classes`; sınıf okul+döneme bağlı |
| Kişiler | `people`, `enrollments`, `class_staff`; öğretmen/öğrenci rolleri ve dönemsel yerleşim ayrı |
| İçeri alma | `import_batches`, `import_rows`; kaynak hash'i, eşleme ve hatalar; onaylanana kadar staging |
| Çekim | `shoot_jobs`, `shoot_subjects`; sıra ve yerel çekim kartı/QR ilişkisi |
| Medya | `assets`, `photo_assignments`, `edit_recipes`; dosya hash'i, boyut/piksel/yön ve sürümlü düzenleme tarifi |
| Tasarım | `templates`, `template_versions`, `documents`, `document_pages`, `document_items` |
| Ürün / sipariş | `product_presets`, `orders`, `order_items`; para küçük birimde integer + para birimi |
| İşler / çıktı | `export_jobs`, `export_artifacts`; iptal/yeniden dene, sürüm ve manifest |
| Güvence | `backup_runs`, `operation_journal`, `user_preferences`, `schema_migrations` |

Her tablo ilk sürümde birden açılmaz. P1 dikey akışın minimum şeması çıkarılıp gerçek SQLite üzerinde denenir. Bulut üyelikleri, ağ outbox'ı ve sunucu kullanıcıları şimdi eklenmez. Yerel işlem günlüğü ağ eşitleme garantisi değildir.

## SQL invariant'ları

1. Dahili kimlik UUID; okul numarası metin. `001` ile `1` kullanıcı onayı olmadan birleştirilmez.
2. Okul/dönem/sınıf tutarlılığı composite `UNIQUE` + composite FK ile korunur. Bir kayıtta `school_id` bulundurmak tek başına çapraz okul bağlantısını engellemez.
3. Okul numarası için unique kapsamı iş kararıyla açık seçilir: aynı sınıf mı, okul+dönem mi? İçe alımda farklı sınıflardaki aynı numara hata/inceleme olarak sunulur. Native şema kararı verilmeden global unique uydurulmaz.
4. Etkin kişi-foto eşleşmesi tek yerde otorite olur. İki yönlü yinelenen kolonlar tutulacaksa tek transaction içinde güncellenir ve tutarsızlık test edilir. Eşleşme değişince baskı onayı iptal edilir.
5. `FOREIGN KEY`, `CHECK` (pozitif adet, geçerli boolean/durum), `NOT NULL` ve gerekli index'ler kullanılır. Her SQLite bağlantısında FK enforcement açılır ve gerçek hatalı INSERT/UPDATE ile sınanır.
6. Kişi silmek orijinal fotoğraf dosyasını hemen fiziksel silmez; ilişki kaldırılır, bağlı iş/çıktı ve saklama kuralları kontrol edilir. Okul silme için kapsam/etki önizlemesi ve yedek gerekir.
7. Bir aktarım ya tamamen commit olur ya hiç yazılmaz. Tekrarlanan aktarım/çıktı komutu idempotent olmalı; kullanıcı düğmeye iki kez bastığında iki iş oluşmaz.
8. Tasarım şablonu ve baskı profili sürümlüdür. Geçmiş çıktının hangi orijinal, tarif, font, sayfa ve ayarlarla üretildiği saklanır.
9. Hata halinde DB ve dosya sistemi farklı durumda kalabilir: içeri alma önce geçici alana yazar, hash doğrular, atomik rename/iş kaydı ile finalize eder. Başlangıçta yarım işler bulunup güvenle kurtarılır.

## Migration sırası

- `001_local_core`: migration geçmişi, stüdyo/okul/dönem/sınıf, kişi ve yerleşim.
- `002_local_media`: yönetilen dosyalar, fotoğraf atama ve tarifler, dosya bütünlüğü.
- `003_import_jobs`: önizleme/staging, hata raporu, atomik aktarım ve iş günlüğü.
- `004_templates_exports`: sürümlü şablon/belge, fiziksel çıktı profili, çıktı işleri.
- `005_orders_backup`: yerel ürün/sipariş ve yedek manifestleri.

Bu adlar plan sırasıdır; bu dosyalar henüz yok. Üretime uygulanmış migration yeniden yazılmaz. Uygulama açılışında sürüm kontrolü, migration öncesi doğrulanabilir yedek, transaction ve başarısızlıkta güvenli durma gerekir. Yeni uygulamayla yükseltilmiş DB'yi eski sürüm sessizce açamaz.

## Güvenlik ve şifreleme

AppData kullanıcı ayrımı sağlar; tek başına uygulama düzeyinde şifreleme değildir. Normal SQLite kendiliğinden şifreli değildir. [SQLCipher](https://www.zetetic.net/sqlcipher/) gibi çözüm seçilirse Rust uyumu, lisansı, anahtar saklama/kurtarma ve yedek şifrelemesi teknik deneyle doğrulanmalı. Orijinal fotoğraflar da aynı koruma kapsamındadır. Anahtar frontend sabiti, localStorage, log veya Git içinde olmaz; Windows korumalı anahtar deposu ve kurtarma modeli gerekir.

Diskteki koruma Windows yönetici yetkisi, açık kullanıcı oturumu veya kötü amaçlı yazılıma karşı mutlak garanti değildir. Yerel kilit/rol, OS dosya erişimi ve şifreleme ayrı sınırlar olarak belgelenir. Kullanıcı açıkça istemeden ağ servisine veri gönderilmez.

## Yedek ve geri yükleme

- Açık SQLite dosyasını özellikle WAL kullanımında tek başına dosya kopyasıyla yedeklemek yeterli değildir. SQLite backup API/uygun tutarlı snapshot yöntemi seçilmeli. [SQLite online backup API](https://www.sqlite.org/backup.html).
- Yedek = tutarlı DB + orijinaller + tasarım kaynakları + dosya/hash manifesti + uygulama/şema sürümü. Önizlemeler yeniden üretilebilir.
- Harici disk/USB hedefi seçilebilmeli. Şifreli yedeğin anahtarı aynı pakete açık olarak yazılmaz.
- Geri yükleme önce ayrı geçici klasöre açılır; zip-slip/zip-bomb, hash, DB bütünlüğü, ilişki ve sürüm kontrolü yapılır. Çalışan veri üstüne doğrulamasız yazılmaz.
- USB çıkarılması, disk dolu, bozuk arşiv, eksik fotoğraf, yanlış parola ve yarıda kalan geri yükleme denenir. Başarı mesajı gerçekten açılabilen kurtarılmış işten sonra gelir.

## Bulut daha sonra istenirse

Yerel uygulama tamamlanmadan PostgreSQL/Supabase kurulmaz. İstenirse ayrı kapsamda hesap/izin, RLS, cihaz eşitleme, idempotency, revision çatışmaları, özel fotoğraf depolama ve ağ kesintisinde devam etme tasarlanır. SQL dialect'leri ve migration'lar ayrı olur; SQLite dosyası ağ sürücüsünde ortak veritabanı gibi kullanılmaz.
