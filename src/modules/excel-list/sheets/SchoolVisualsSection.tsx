import React, { useRef } from 'react';
import type { SchoolParsedInput } from '../../../system/schemas/schoolSchemas';
import { useResolvedSchoolAssetUrl } from '../../../system/storage/useSchoolAssetUrl';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import { SheetSection } from '../../../window-system/sheet/SheetFields';
import { rangeFill } from '../../../window-system/sheet/rangeFill';
import { formErrorMessage } from './formHelpers';
import { readValidatedSchoolImage, type SchoolImageSlotKind } from './schoolImageHelper';

type ImageKey = 'logoDataUrl' | 'principalSignatureDataUrl' | 'deputySignatureDataUrl' | 'schoolPhotoDataUrl';
type SetSchoolField = <K extends keyof SchoolParsedInput>(key: K, value: SchoolParsedInput[K]) => void;

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/** Gizli dosya girişi: seçilen dosyayı doğrulamaya iletir, aynı dosya tekrar seçilebilsin diye değeri sıfırlar. */
const HiddenFileInput = React.forwardRef<HTMLInputElement, { onFile: (file: File) => void }>(
  function HiddenFileInput({ onFile }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    );
  },
);

/** Boşken tıklanınca dosya seçtiren, doluyken görseli kâğıt/koyu zeminde gösteren Apple önizleme kutusu. */
function DropBox({ dataUrl, alt, paper, emptyText, imgClass, imgStyle, className = '', onPick }: {
  dataUrl: string; alt: string; paper?: boolean; emptyText: string; imgClass: string;
  imgStyle?: React.CSSProperties; className?: string; onPick?: () => void;
}) {
  const resolvedUrl = useResolvedSchoolAssetUrl(dataUrl, 'preview');
  if (dataUrl) {
    return (
      <div className={`xl-sv-box ${paper ? 'is-paper' : ''} ${className}`.trim()}>
        {resolvedUrl ? <img src={resolvedUrl} alt={alt} className={imgClass} style={imgStyle} /> : null}
      </div>
    );
  }
  if (!onPick) {
    return <div className={`xl-sv-box is-empty ${className}`.trim()}><span>{emptyText}</span></div>;
  }
  return (
    <button type="button" className={`xl-sv-box is-empty ${className}`.trim()} onClick={onPick}>
      <SheetAutoIcon text="Görsel" size={16} />
      <span>{emptyText}</span>
    </button>
  );
}

/** Logo / imza karosu: başlık, önizleme ve Seç·Değiştir / Sil aksiyonları. */
function ImageTile({ label, hint, dataUrl, paper, onFile, onClear }: {
  label: string; hint: string; dataUrl: string; paper?: boolean;
  onFile: (file: File) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pick = () => inputRef.current?.click();
  return (
    <div className="xl-sv-tile">
      <div className="xl-sv-tile-head">
        <strong className="os-icon-inline"><SheetAutoIcon text={label} size={12.5} />{label}</strong>
        <small>{hint}</small>
      </div>
      <DropBox
        dataUrl={dataUrl} alt={label} paper={paper} emptyText="Görsel Ekle"
        imgClass={paper ? 'xl-asset-sig' : 'xl-sv-img'} onPick={pick}
      />
      <div className="xl-sv-tile-foot">
        <HiddenFileInput ref={inputRef} onFile={onFile} />
        <button type="button" className="xl-mini-btn" aria-label={`${label} seç`} onClick={pick}>
          <SheetAutoIcon text="Seç" size={12} />
          {dataUrl ? 'Değiştir' : 'Seç'}
        </button>
        {dataUrl && (
          <button type="button" className="xl-mini-btn" aria-label={`${label} sil`} onClick={onClear}>
            <SheetAutoIcon text="Sil" size={12} />
            Sil
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Tek formdaki sağ sütun: Kütük kapağı Okul Resmi (4:3 + yakınlaştırma) üstte,
 * Okul Logosu, Transparan Logo, Müdür ve Müdür Yrd. imzaları 2×2 Apple karolarında altta.
 */
export const SchoolVisualsPanel: React.FC<{
  form: SchoolParsedInput;
  onChange: SetSchoolField;
  onError: (msg: string | null) => void;
}> = React.memo(({ form, onChange, onError }) => {
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (key: ImageKey, kind: SchoolImageSlotKind) => async (file: File) => {
    onError(null);
    try {
      onChange(key, await readValidatedSchoolImage(file, kind));
    } catch (err) {
      onError(formErrorMessage(err));
    }
  };
  const pickCover = () => coverInputRef.current?.click();
  const zoomPct = Math.round(form.schoolPhotoZoom * 100);

  return (
    <aside className="xl-sv-col" aria-label="Okul görselleri">
      <SheetSection title="Okul Resmi">
        <div className="xl-sv-cover-row">
          <DropBox
            dataUrl={form.schoolPhotoDataUrl} alt="Okul Resmi" emptyText="Okul Resmi Ekle"
            imgClass="xl-sv-cover-img" className="xl-sv-cover-box" onPick={pickCover}
            imgStyle={{ transform: `translate3d(0, 0, 0) scale3d(${form.schoolPhotoZoom}, ${form.schoolPhotoZoom}, 1)` }}
          />
          <div className="xl-sv-cover-side">
            <p>Kütük defteri kapağında kullanılır. Önerilen oran 4:3, en fazla 8 MB.</p>
            <div className="xl-sv-tile-foot">
              <HiddenFileInput ref={coverInputRef} onFile={(f) => void handleFile('schoolPhotoDataUrl', 'cover')(f)} />
              <button type="button" className="xl-mini-btn" onClick={pickCover}>
                <SheetAutoIcon text="Okul Resmi Seç" size={12} />
                {form.schoolPhotoDataUrl ? 'Değiştir' : 'Okul Resmi Seç'}
              </button>
              {form.schoolPhotoDataUrl && (
                <button type="button" className="xl-mini-btn" aria-label="Okul resmini sil" onClick={() => onChange('schoolPhotoDataUrl', '')}>
                  <SheetAutoIcon text="Sil" size={12} />
                  Sil
                </button>
              )}
            </div>
            <label className="xl-sv-range-label">
              <span>Yakınlaştırma <em>%{zoomPct}</em></span>
              <input
                type="range" className="xl-sv-range" aria-label="Okul resmi yakınlaştırma"
                min={1} max={2} step={0.005} value={form.schoolPhotoZoom}
                style={rangeFill(form.schoolPhotoZoom, 1, 2)} disabled={!form.schoolPhotoDataUrl}
                onChange={(e) => onChange('schoolPhotoZoom', Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </SheetSection>

      <SheetSection title="Logo ve İmzalar">
        <div className="xl-sv-grid">
          <ImageTile
            label="Okul Logosu" hint="Kimlik ve çizelge · 3 MB" dataUrl={form.logoDataUrl}
            onFile={(f) => void handleFile('logoDataUrl', 'logo')(f)} onClear={() => onChange('logoDataUrl', '')}
          />
          <div className="xl-sv-tile">
            <div className="xl-sv-tile-head">
              <strong className="os-icon-inline"><SheetAutoIcon text="Transparan Logo" size={12.5} />Transparan Logo</strong>
              <small>Logodan otomatik filigran</small>
            </div>
            <DropBox
              dataUrl={form.logoDataUrl} alt="Transparan Logo" paper emptyText="Önce okul logosunu ekleyin"
              imgClass="xl-asset-watermark" imgStyle={{ opacity: form.transparentLogoOpacity / 100 }}
            />
            <label className="xl-sv-range-label is-inline">
              <span>Yoğunluk <em>%{form.transparentLogoOpacity}</em></span>
              <input
                type="range" className="xl-sv-range" aria-label="Transparan logo yoğunluğu"
                min={10} max={100} step={5} value={form.transparentLogoOpacity}
                style={rangeFill(form.transparentLogoOpacity, 10, 100)}
                onChange={(e) => onChange('transparentLogoOpacity', Number(e.target.value))}
              />
            </label>
          </div>
          <ImageTile
            label="Müdür İmzası" hint="Kimlik ve çizelge · 3 MB" dataUrl={form.principalSignatureDataUrl} paper
            onFile={(f) => void handleFile('principalSignatureDataUrl', 'signature')(f)}
            onClear={() => onChange('principalSignatureDataUrl', '')}
          />
          <ImageTile
            label="Müdür Yrd. İmzası" hint="Kimlik ve çizelge · 3 MB" dataUrl={form.deputySignatureDataUrl} paper
            onFile={(f) => void handleFile('deputySignatureDataUrl', 'signature')(f)}
            onClear={() => onChange('deputySignatureDataUrl', '')}
          />
        </div>
      </SheetSection>
    </aside>
  );
});
