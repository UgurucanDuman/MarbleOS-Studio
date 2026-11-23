import { BookIconOfficialSeal } from '../icons/SettingsBookIcons';

export function LegalRegistrationPage() {
  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconOfficialSeal size={38} /></span>
        <div>
          <h3>Fikri Mülkiyet, Telif Tescili ve Marka Hakları</h3>
          <p>
            MarbleOS ekosistem mimarisi, veritabanı tasarımı ve kurumsal marka ibaresi resmi kayıt ve sınai mülkiyet
            mevzuatı kapsamında tescil ve koruma altındadır.
          </p>
        </div>
      </div>

      <section className="os-book-card os-book-cert-card" aria-label="Telif hakları kayıt tescil belgesi">
        <div className="os-book-cert-header">
          <span>T.C. KÜLTÜR VE TURİZM BAKANLIĞI · TELİF HAKLARI GENEL MÜDÜRLÜĞÜ</span>
          <h4>Bilgisayar Programlarına İlişkin Kayıt-Tescil Belgesi</h4>
        </div>
        <dl className="os-book-kv-grid">
          <div>
            <dt>Eser Adı ve Türü</dt>
            <dd>MarbleOS · Bilgisayar Programı, Veritabanı</dd>
          </div>
          <div>
            <dt>Asıl Eser Sahibi</dt>
            <dd>Uğurcan Duman</dd>
          </div>
          <div>
            <dt>Kayıt-Tescil No / Tarihi</dt>
            <dd>2026/20687 · 25.09.2026</dd>
          </div>
          <div>
            <dt>Üretim Tarihi</dt>
            <dd>15.02.2026</dd>
          </div>
          <div className="is-full">
            <dt>Elektronik İmza Doğrulama Kodu</dt>
            <dd className="os-book-mono">f3c36074-9363-4d54-8a38-ee968fc69dfa</dd>
          </div>
        </dl>
      </section>

      <section className="os-book-card os-book-cert-card" aria-label="Türk Patent marka başvurusu ve bülten kaydı">
        <div className="os-book-cert-header">
          <span>T.C. TÜRK PATENT VE MARKA KURUMU · MARKALAR DAİRESİ BAŞKANLIĞI</span>
          <h4>6769 Sayılı Sınai Mülkiyet Kanunu Kapsamında Marka Kaydı</h4>
        </div>
        <dl className="os-book-kv-grid">
          <div>
            <dt>Marka İbaresi</dt>
            <dd>marbleos enterprise system</dd>
          </div>
          <div>
            <dt>Başvuru Sahibi</dt>
            <dd>Uğurcan Duman</dd>
          </div>
          <div>
            <dt>Başvuru No / Tarihi</dt>
            <dd>2026/996447 · 23.09.2026</dd>
          </div>
          <div>
            <dt>Resmi Marka Bülteni</dt>
            <dd>Bülten No: 503 · 27.10.2026 (Karar: E-71248886-130-260771399)</dd>
          </div>
          <div className="is-full">
            <dt>Belge Doğrulama Kimliği</dt>
            <dd className="os-book-mono">2DD016F2-1972-47B3-BF79-B796631729F9</dd>
          </div>
        </dl>
      </section>

      <p className="os-book-legal-foot">
        © 2026 Uğurcan Duman — MarbleOS &amp; MarbleOS Studio. 5846 sayılı Fikir ve Sanat Eserleri Kanunu ve 6769
        sayılı Sınai Mülkiyet Kanunu uyarınca tüm hakları saklıdır; yazılı izin olmaksızın kopyalanamaz, çoğaltılamaz
        veya tersine mühendislikle türetilemez.
      </p>
    </div>
  );
}

