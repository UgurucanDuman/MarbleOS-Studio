# Güvenlik, şifreleme ve lisans hedefleri

6 Kasım 2026. İlk native kaynak Windows DPAPI ile SQLite iş kaydını, orijinalleri ve önizlemeleri kullanıcı hesabına bağlı olarak korur. Tarayıcı önizlemesindeki localStorage ve data URL'ler şifresizdir. Aşağıda ilk uygulama ve üretim kabulü ayrı tutulur.

Yerel depo DPAPI'ye kayıt türü ve kimliğiyle bağlı kapsam verir. Arayüze dosya yolları, serbest SQL veya şifreleme anahtarı açılmaz. İlk uygulamada ayrı parola ekranı yoktur. Aynı Windows hesabının dışına taşınabilen şifreli yedek ve kurtarma akışı yapılacak. [Microsoft DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).

**Okul görselleri ve yönetilen medya alanı (9 Kasım 2026, uygulandı):** Masaüstünde okul logosu, müdür/müdür yardımcısı imzaları (`<= 3 MiB`) ve okul kapak resmi (`<= 8 MiB`), öğrenci fotoğraflarıyla aynı Rust görüntü doğrulama hattından (`JPEG/PNG/WebP` sihirli bayt kontrolü, `<= 8192×8192`, `<= 40 MP`, `256 MiB` bellek sınırı ve tam piksel decode) geçer. SQLite `workspace` kaydında ham base64 tutulmaz; görseller `media/originals/schools/<uuid>.dpapi` ve `media/previews/schools/<uuid>.dpapi` altında dosyaya özgü DPAPI kapsamıyla saklanır, veritabanında yalnız `marbleos-school-asset:<uuid>` referansı yer alır. Görsel yenilendiğinde veya okul silindiğinde referansı kalmayan `.dpapi` dosyaları atomik `asset_cleanup` kuyruğuyla diskten silinir; eski satır içi kayıtlar açılışta otomatik taşınır.

**Zarf şifreleme ve 256-bit Kurtarma Anahtarı (9 Kasım 2026, uygulandı):** Masaüstünde SQLite `workspace.encrypted_snapshot` kaydı, öğrenci fotoğrafları ve okul görselleri artık doğrudan Windows DPAPI'ye kilitlenmek yerine CSPRNG ile üretilen 256-bit Ana Veri Anahtarı (`DataKey`, bellekte `Zeroizing<[u8; 32]>`) altında **AES-256-GCM** (`MBLAEAD1`, her yazmada 12 bayt rastgele nonce ve kayıt/dosya kimliğine bağlı AAD) ile şifrelenir. `vault_key` (`004_vault_key.sql`, `STRICT`) tablosu bu `DataKey`'in iki ayrı kriptografik sargısını tutar:
1. Günlük sürtünmesiz açılış için Windows kullanıcı profiline bağlı **DPAPI** sargısı (`dpapi_wrapped_dek`).
2. Windows yeniden kurulumu veya kullanıcı profili bozulmasına karşı **256-bit Kurtarma Anahtarı** (`32` bayt CSPRNG + `3` bayt SHA-256 sağlama toplamı = `56` Crockford Base32 karakter, `7×8` grup) üzerinden **Argon2id (`64 MiB` bellek, `t = 3`, `p = 1`, `16` bayt rastgele tuz)** + **AES-256-GCM** (`MBLRECV1`, tuz ve parmak izi AAD bağlı) ile sarılmış `recovery_wrapped_dek`. Doğrulama sırasında `Argon2id` her zaman parmak izi karşılaştırmasından önce çalıştırılır ve ardışık hatalı denemelere üssel bekleme (`unlock_guard`) uygulanır. DPAPI sargısı açılamadığında uygulama veriyi silmeden kasayı kilitli açar (`VaultUnlockGate`); geçerli kurtarma anahtarı girildiğinde `DataKey` çözülür ve `dpapi_wrapped_dek` yeni Windows hesabına yeniden bağlanır. Eski doğrudan DPAPI kayıtları ve `.dpapi` medya dosyaları ilk açılışta otomatik olarak `MBLAEAD1` zarfına yükseltilir.

**Okul ve tüm çalışma alanı şifreli yedekleri (9 Kasım 2026, uygulandı):** Üst bardaki **Ayarlar** (`StudioSettingsBookSheet` → **Sistem Ayarları** → **Şifreli Yedekleme**) içinden hem tekil okul için `.marbleos-yedek` (`marbleos-school-backup-v2-encrypted`) hem de tüm okulları, şubeleri, öğrencileri, okul görsellerini ve öğrenci fotoğraflarını tek pakette içeren `.marbleos-kasa` (`marbleos-workspace-backup-v1-encrypted`) üretilir ve geri yüklenir (600 fotoğraf / 64 MB sınırına kadar; daha büyük arşivlerde okullar tek tek yedeklenir). 256-bit Kurtarma Anahtarı yönetimi ise aynı Ayarlar el kitabındaki **Veri Kasası & Kurtarma** sayfasındadır; gizlilik ilkeleri ve resmi marka/telif tescil bilgileri ayrı **Gizlilik & Tescil** sekmesinde yer alır. Yedek parolası NFC'ye normalize edilir, PBKDF2-SHA256 (600.000 tur, 16 bayt rastgele tuz) ile AES-256-GCM anahtarı türetilir; her yedekte yeni 12 bayt IV kullanılır. Biçim, tur, tuz ve IV, GCM ek doğrulama verisine (AAD) bağlıdır; zarf ve içerik uçtan uca Zod ile doğrulanır. Parola hiçbir yere yazılmaz; unutulursa yedek açılamaz. Eski şifresiz `marbleos-school-backup-v1` dosyaları yalnız geri yükleme için okunur, yenisi üretilmez.

## Ayrı koruma sınırları

| Sınır | Gereken davranış |
| --- | --- |
| Diskte veri | DB, fotoğraf, tasarım ve yedek için bütünlük doğrulamalı şifreleme; anahtar kaynak/renderer/localStorage/log içinde olmaz. |
| Yerel uygulama | Tauri komut/kaynak allowlist'i, dar dosya kapsamı, runtime doğrulama, parametreli sorgu. [Tauri capabilities](https://v2.tauri.app/security/capabilities/). |
| Gelecek ağ trafiği | HTTPS/TLS ve sertifika doğrulaması; `insecure`/doğrulamayı atlama yok. Şu an müşteri verisi gönderen ağ adaptörü yok. TLS disk şifrelemesi veya uçtan uca şifreleme demek değildir. |
| Dağıtım | Windows imzası ile yayıncı/kurulum bütünlüğü; ayrıca imzalı güncelleme doğrulaması. [Tauri updater](https://v2.tauri.app/plugin/updater/). |
| Lisans | İmzalı kullanım yetkisi; müşteri verisini açan şifreleme anahtarından bağımsız. |

Normal SQLite otomatik şifreli değildir. [SQLCipher](https://www.zetetic.net/sqlcipher/) olası DB çözümüdür; seçilecek sürümün ticari kullanım şartı, Rust bağı, migration/backup uyumu ve performansı doğrulanmalı. Sadece DB'yi korumak fotoğraf dosyalarını korumaz.

## Anahtar ve kurtarma

- Cihazda rastgele üretilmiş veri anahtarı, Windows kullanıcı kapsamındaki korumalı mekanizma ile saklanmalı. [Microsoft DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata) tipik olarak aynı kullanıcı ve bilgisayar bağlamına dayanır; tek kurtarma yolu olarak bırakılmaz.
- Bilgisayar bozulduğunda veya Windows yeniden kurulduğunda harici yedek, açıkça tasarlanmış kurtarma anahtarı/parolasıyla başka bilgisayarda açılabilmeli. Anahtar kaybında geri dönüş garantisi uydurulmaz.
- Dosya şifrelemesi için bakımı yapılan doğrulanmış kütüphane ve kimlik doğrulamalı şifreleme kullanılır; özel algoritma yazılmaz. Her dosya/chunk için nonce ve anahtar kullanım kuralları doğrulanır.
- Şifreli metadata, orijinal, önizleme ve geçici çıktı kapsamı açık olmalı. Hassas açık geçici dosya veya crash dump bırakılmaması ayrıca değerlendirilir. Kullanıcının PDF/USB paylaşımı için açık dışa aktarım seçmesi ayrı işlemdir.
- Yanlış parola, değiştirilmiş ciphertext, bozuk chunk ve yarım yazımda eski dosya bozulmaz; kısmi içerik başarılı sayılmaz.
- Windows oturumu açıkken çalışan kötü amaçlı yazılım veya yönetici yetkisi karşısında mutlak koruma sözü verilmez. Bellekte işlem için çözülen verinin bulunması ayrı tehdit modelidir.

## Çevrimdışı lisans tasarımı — sonraki aşama

1. Lisans belgesi ürün kimliği, lisans kimliği, açık yetki listesi, şema/sürüm ve seçilmiş politikaya göre tarih/cihaz alanları içerir. Gizli öğrenci verisi veya gereksiz donanım bilgisi içermez.
2. Yayıncı lisansı özel anahtarla imzalar; uygulamaya yalnız public doğrulama anahtarı konur. Asimetrik imza için güncel, bakımı yapılan kütüphane seçilir; serbest JSON birleştirmesiyle imza doğrulanmaz. İmzalanan byte'lar ve sürümlü temsil açık tanımlanır.
3. İşlem yetkisi native katmanda doğrulanır. UI'da buton gizlemek veya localStorage `isLicensed=true` değeri kullanmak lisans koruması değildir.
4. Ürün çevrimdışı çalışacağı için sürekli online kontrol şartı konmaz. Süre/cihaz değişimi/saat geri alma/iptal davranışı ticari politika kararıdır; ağ yokken anında uzaktan iptal garanti edilemez.
5. Cihaz bağlama gerekiyorsa taşınabilirlik/kurtarma ve minimum veri toplanması tasarlanır. Bir disk/ekran kartı değişikliği müşteriyi kalıcı kilitlememeli.
6. Lisans süresi/onarım sorunu okul kayıtlarını silmez ve veri şifreleme anahtarını değiştirmez. Veri kurtarma ve yedek erişimi için açık ürün kuralı gerekir.
7. Özel imza anahtarı repoya, frontend'e, kurulum paketine veya örnek env'ye konmaz. Lisans/güncelleme/Windows kod imzası/veri anahtarları ayrı tutulur; rotasyon ve yayıncı erişimi kayda alınır.
8. Değiştirilmiş uygulama ikilisi veya OS yöneticisine karşı kırılamaz lisans iddiası yapılmaz. İmza kontrolleri, güncelleme bütünlüğü ve kullanıcıya anlaşılır kurtarma ticari hazırlığın parçalarıdır.

## Zorunlu kabul örnekleri

- [ ] Veritabanı/fotoğraf/yedek kopyası anahtarsız açılmıyor; anahtar başka paketten bulunamıyor.
- [ ] Kayıt/medya işleminde bilinmeyen kimlik, çapraz okul, bozuk dosya, yol kaçışı ve aşırı boyut reddediliyor.
- [ ] Yanlış lisans imzası/ürün/sürüm/yetki reddediliyor; hatalı lisans müşteri verisini bozmuyor.
- [ ] Kurulum ve güncelleme imzası değiştirildiğinde paket uygulanmıyor.
- [ ] Windows yeniden kurulumunu temsilen başka temiz kullanıcı/cihazda kurtarma prosedürü gerçekten deneniyor.
- [ ] İnternet kapalı normal iş akışı çalışıyor; hiçbir fotoğraf/veri kendiliğinden dışarı gitmiyor.
