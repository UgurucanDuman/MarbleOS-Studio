import React, { useEffect, useState } from 'react';

/**
 * İZOLE MODÜL 03 ALT BİLEŞENİ: PVC Kimlik Kartı Fiziksel Boyut (Genişlik × Yükseklik mm) Seçici
 * CR80 standart ve özel yaka kartı ölçüleri (40..130 mm) için hazır presetler ve hassas mm girişi.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const CARD_SIZE_PRESETS: ReadonlyArray<{ label: string; w: number; h: number }> = [
  { label: 'CR80', w: 85.6, h: 54 },
  { label: 'Dikey', w: 54, h: 85.6 },
  { label: '90×60', w: 90, h: 60 },
  { label: '100×70', w: 100, h: 70 },
];

function clampMm(raw: string, fallback: number): number {
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(130, Math.max(40, Number(n.toFixed(1))));
}

export const PvcCardSizeControls: React.FC<{
  widthMm: number;
  heightMm: number;
  onChangeSize: (widthMm: number, heightMm: number) => void;
}> = React.memo(({ widthMm, heightMm, onChangeSize }) => {
  const [wText, setWText] = useState(String(widthMm));
  const [hText, setHText] = useState(String(heightMm));

  useEffect(() => { setWText(String(widthMm)); }, [widthMm]);
  useEffect(() => { setHText(String(heightMm)); }, [heightMm]);

  const commit = (nextW: string, nextH: string) => {
    const w = clampMm(nextW, widthMm);
    const h = clampMm(nextH, heightMm);
    setWText(String(w));
    setHText(String(h));
    if (Math.abs(w - widthMm) >= 0.05 || Math.abs(h - heightMm) >= 0.05) {
      onChangeSize(w, h);
    }
  };

  return (
    <div className="pvc-prop-block">
      <span className="pvc-mini-label">Kart Boyutu ({widthMm}×{heightMm} mm)</span>
      <div className="pvc-radius-presets">
        {CARD_SIZE_PRESETS.map((p) => {
          const active = Math.abs(widthMm - p.w) < 0.25 && Math.abs(heightMm - p.h) < 0.25;
          return (
            <button
              key={p.label}
              type="button"
              className={`pvc-mini-btn ${active ? 'is-active' : ''}`.trim()}
              onClick={() => onChangeSize(p.w, p.h)}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="pvc-mm-grid">
        <label className="pvc-mm-input">
          <span>Genişlik (mm)</span>
          <input
            type="number"
            min={40}
            max={130}
            step={0.5}
            aria-label="Kart genişliği (mm)"
            value={wText}
            onChange={(e) => setWText(e.target.value)}
            onBlur={() => commit(wText, hText)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(wText, hText); }}
          />
        </label>
        <label className="pvc-mm-input">
          <span>Yükseklik (mm)</span>
          <input
            type="number"
            min={40}
            max={130}
            step={0.5}
            aria-label="Kart yüksekliği (mm)"
            value={hText}
            onChange={(e) => setHText(e.target.value)}
            onBlur={() => commit(wText, hText)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(wText, hText); }}
          />
        </label>
      </div>
    </div>
  );
});

