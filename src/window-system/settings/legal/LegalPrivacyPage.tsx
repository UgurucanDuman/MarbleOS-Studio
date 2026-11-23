import { BookIconPrivacyShield } from '../icons/SettingsBookIcons';

export function LegalPrivacyPage() {
  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconPrivacyShield size={38} /></span>
        <div>
          <h3>Gizlilik Politikası ve Yerel Veri Egemenliği</h3>
          <p>
            MarbleOS Studio, okul fotoğrafçılığı ve kimlik/albüm üretiminde işlenen öğrenci, öğretmen ve kurum
            verilerini cihaz dışına çıkarmadan korumak üzere çevrimdışı öncelikli mimariyle tasarlanmıştır.
          </p>
        </div>
      </div>

      <div className="os-book-prose-list">
        <section className="os-book-card">
          <h4>1. Sıfır Bulut ve Sıfır Telemetri İlkesi</h4>
          <p>
            Okul listeleri, öğrenci numaraları, kimlik kartı alanları, müdür/idareci imzaları ve portre fotoğrafları
            hiçbir uzak sunucuya, üçüncü taraf bulut depolamasına, reklam/analitik servisine veya yapay zekâ eğitim
            havuzuna aktarılmaz. İnternet bağlantısı tamamen kapalıyken tüm iş akışı çalışır.
          </p>
        </section>

        <section className="os-book-card">
          <h4>2. Kriptografik Saklama ve Piksel Doğrulama</h4>
          <p>
            Windows masaüstü kurulumunda yerel SQLite iş kaydı, öğrenci fotoğrafları ve okul görselleri 256-bit
            ana veri anahtarı (<strong>AES-256-GCM</strong>) ve işletim sistemi kullanıcı koruması (<strong>DPAPI</strong>)
            altında şifrelenir. İçe alınan tüm görseller piksel ve bellek sınırlarıyla doğrulanır; CSV/Excel
            aktarımlarında formül enjeksiyonu etkisizleştirilir.
          </p>
        </section>

        <section className="os-book-card">
          <h4>3. Yedek Parolası ve Kurtarma Anahtarı Sorumluluğu</h4>
          <p>
            Dışa aktarılan <code>.marbleos-kasa</code> ve <code>.marbleos-yedek</code> dosyaları yalnızca sizin
            belirlediğiniz parolayla çözülür; parola veya 56 karakterlik Kurtarma Anahtarı uygulama tarafından düz
            metin olarak kaydedilmez. Kayıp parola veya kurtarma anahtarı üçüncü kişilerce ya da üretici tarafından
            geri döndürülemez.
          </p>
        </section>
      </div>
    </div>
  );
}

