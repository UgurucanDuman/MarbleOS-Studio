import React, { useRef } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import type {
  PvcCardElement,
  PvcCodeSource,
  PvcFieldKey,
  PvcFontFamily,
  PvcFontWeight,
  PvcTextAlign,
} from '../../../system/storage/pvc-cards/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';
import { PvcColorSwatchPicker } from './PvcColorSwatchPicker';
import {
  PVC_CODE_SRC_SELECT_OPTIONS,
  PVC_FIELD_SELECT_OPTIONS,
  PVC_FONT_OPTIONS,
  PVC_PHOTO_SHAPE_OPTIONS,
  PVC_SHAPE_VARIANT_OPTIONS,
  PVC_WEIGHT_OPTIONS,
} from './pvcInspectorOptions';
import { SmoothRangeSlider } from './SmoothRangeSlider';

/**
 * İZOLE MODÜL 03 SEÇİLİ KATMAN DENETÇİSİ:
 * Konum/Boyut/Döndürme, Portre Şekli + Sığdırma + Yakınlaştırma + Kadraj, Şekil Türü + Gradyan,
 * Yazı Tipi/Punto/Renk/Hizalama, Gölge, Çerçeve, Barkod/QR ve Özel PNG Görsel kontrolü.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcSelectedElementInspector: React.FC<{
  element: PvcCardElement;
  cardWidthMm: number;
  cardHeightMm: number;
  onLivePatch: (patch: Partial<PvcCardElement>) => void;
  onChange: (patch: Partial<PvcCardElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (dir: 'up' | 'down') => void;
}> = React.memo(({ element: el, cardWidthMm, cardHeightMm, onLivePatch, onChange, onDuplicate, onDelete, onReorder }) => {
  const imgRef = useRef<HTMLInputElement | null>(null);
  const numField = (key: 'xMm' | 'yMm' | 'wMm' | 'hMm', label: string, min: number, max: number) => (
    <label className="pvc-mm-input">
      <span>{label}</span>
      <input
        type="number"
        step={0.5}
        min={min}
        max={max}
        value={el[key]}
        disabled={Boolean(el.locked)}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange({ [key]: Number(Math.min(max, Math.max(min, parsed)).toFixed(2)) });
        }}
      />
    </label>
  );

  const handleReplaceImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || file.size > 2_000_000) {
      if (file) notifyStudio('Özel görsel en fazla 2 MB olabilir.', 'error');
      return;
    }
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      if (encoded[0]?.dataUrl) onChange({ imageDataUrl: encoded[0].dataUrl });
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  const isTextLike = el.kind === 'field' || el.kind === 'text';

  return (
    <div className="pvc-prop-inspector">
      <div className="tc-section-head">
        <span className="tc-section-label">Seçili Öğe</span>
        <div className="pvc-inline-tools">
          <button type="button" className="pvc-mini-btn" title="Arkaya al" onClick={() => onReorder('down')}>↓</button>
          <button type="button" className="pvc-mini-btn" title="Öne al" onClick={() => onReorder('up')}>↑</button>
          <button type="button" className="pvc-mini-btn" onClick={onDuplicate}>Kopyala</button>
          <button type="button" className="pvc-mini-btn is-danger" onClick={onDelete}>Sil</button>
        </div>
      </div>

      <div className="pvc-mm-grid">
        {numField('xMm', 'X (mm)', -20, cardWidthMm)}
        {numField('yMm', 'Y (mm)', -20, cardHeightMm)}
        {numField('wMm', 'Genişlik', 1, cardWidthMm + 15)}
        {numField('hMm', 'Yükseklik', 0.3, cardHeightMm + 15)}
      </div>

      <SmoothRangeSlider
        label={`Döndürme: ${el.rotationDeg ?? 0}°`}
        min={-180}
        max={180}
        step={1}
        disabled={Boolean(el.locked)}
        value={el.rotationDeg ?? 0}
        resetLabel={(el.rotationDeg ?? 0) !== 0 ? 'Sıfırla' : undefined}
        onReset={() => onChange({ rotationDeg: 0 })}
        onLiveChange={(rotationDeg) => onLivePatch({ rotationDeg })}
        onCommit={(rotationDeg) => onChange({ rotationDeg })}
      />

      <div className="pvc-align-btn-row">
        <button type="button" className="pvc-mini-btn" disabled={Boolean(el.locked)} onClick={() => onChange({ xMm: Number(((cardWidthMm - el.wMm) / 2).toFixed(2)) })}>Yatay Ort.</button>
        <button type="button" className="pvc-mini-btn" disabled={Boolean(el.locked)} onClick={() => onChange({ yMm: Number(((cardHeightMm - el.hMm) / 2).toFixed(2)) })}>Dikey Ort.</button>
        <button type="button" className={`pvc-mini-btn ${el.locked ? 'is-active' : ''}`.trim()} onClick={() => onChange({ locked: !el.locked })}>
          {el.locked ? 'Aç' : 'Kilitle'}
        </button>
      </div>

      {el.kind === 'photo' && (
        <div className="pvc-prop-block">
          <span className="pvc-mini-label">Portre Şekli &amp; Sığdırma</span>
          <div className="pvc-shape-pills">
            {PVC_PHOTO_SHAPE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pvc-mini-btn ${(el.photoShape ?? 'rounded') === s.id ? 'is-active' : ''}`.trim()}
                onClick={() => onChange({ photoShape: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <AppleGlassSegment
            ariaLabel="Portre sığdırma biçimi"
            fullWidth
            compact
            activeId={el.imageFit ?? 'cover'}
            items={[
              { id: 'cover', label: 'Kapla', iconHint: 'Kırp' },
              { id: 'contain', label: 'Sığdır', iconHint: 'Görsel' },
            ]}
            onChange={(id) => onChange({ imageFit: id as 'cover' | 'contain' })}
          />
          <SmoothRangeSlider
            label={`Yakınlaştırma: %${Math.round((el.photoZoom ?? 1) * 100)}`}
            min={70}
            max={220}
            step={5}
            value={Math.round((el.photoZoom ?? 1) * 100)}
            resetLabel={(el.photoZoom ?? 1) !== 1 ? '%100' : undefined}
            onReset={() => onChange({ photoZoom: 1 })}
            onLiveChange={(v) => onLivePatch({ photoZoom: Number((v / 100).toFixed(2)) })}
            onCommit={(v) => onChange({ photoZoom: Number((v / 100).toFixed(2)) })}
          />
          <SmoothRangeSlider
            label={`Dikey Kadraj: %${el.photoPosY ?? 50}`}
            min={0}
            max={100}
            step={2}
            value={el.photoPosY ?? 50}
            onLiveChange={(photoPosY) => onLivePatch({ photoPosY })}
            onCommit={(photoPosY) => onChange({ photoPosY })}
          />
          <SmoothRangeSlider
            label={`Yatay Kadraj: %${el.photoPosX ?? 50}`}
            min={0}
            max={100}
            step={2}
            value={el.photoPosX ?? 50}
            onLiveChange={(photoPosX) => onLivePatch({ photoPosX })}
            onCommit={(photoPosX) => onChange({ photoPosX })}
          />
          <label className="mod-check-label">
            <input type="checkbox" checked={Boolean(el.shadow)} onChange={(e) => onChange({ shadow: e.target.checked })} />
            Portre Gölgesi
          </label>
        </div>
      )}

      {el.kind === 'shape' && (
        <div className="pvc-prop-block">
          <span className="pvc-mini-label">Şekil Türü</span>
          <div className="pvc-shape-pills">
            {PVC_SHAPE_VARIANT_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pvc-mini-btn ${(el.shapeVariant ?? 'rect') === s.id ? 'is-active' : ''}`.trim()}
                onClick={() => onChange({ shapeVariant: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <PvcColorSwatchPicker label="Dolgu Rengi" value={el.fillColor ?? ''} allowClear onChange={(fillColor) => onChange({ fillColor })} />
          <PvcColorSwatchPicker label="2. Gradyan Rengi" value={el.fillColor2 ?? ''} allowClear onChange={(fillColor2) => onChange({ fillColor2 })} />
          <label className="mod-check-label">
            <input type="checkbox" checked={Boolean(el.shadow)} onChange={(e) => onChange({ shadow: e.target.checked })} />
            Gölge Efekti
          </label>
        </div>
      )}

      {el.kind === 'image' && (
        <div className="pvc-prop-block">
          <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => void handleReplaceImg(e)} />
          <button type="button" className="mod-cover-upload-btn" onClick={() => imgRef.current?.click()}>Görseli Değiştir (PNG/JPG)</button>
          <AppleGlassSegment
            ariaLabel="Görsel sığdırma"
            fullWidth
            compact
            activeId={el.imageFit ?? 'contain'}
            items={[
              { id: 'contain', label: 'Sığdır', iconHint: 'Görsel' },
              { id: 'cover', label: 'Kapla', iconHint: 'Kırp' },
            ]}
            onChange={(id) => onChange({ imageFit: id as 'cover' | 'contain' })}
          />
        </div>
      )}

      {el.kind === 'field' && (
        <>
          <AppleSelect ariaLabel="Bağlı öğrenci alanı" value={el.fieldKey ?? 'fullName'} options={PVC_FIELD_SELECT_OPTIONS} onChange={(val) => onChange({ fieldKey: val as PvcFieldKey })} />
          <input type="text" className="mod-input" maxLength={32} value={el.prefix ?? ''} placeholder="Önek (Örn: T.C.: )" onChange={(e) => onChange({ prefix: e.target.value })} />
        </>
      )}

      {el.kind === 'text' && (
        <input type="text" className="mod-input" maxLength={180} value={el.text ?? ''} placeholder="Kart metni (veya kartta çift tıklayın)" onChange={(e) => onChange({ text: e.target.value })} />
      )}

      {isTextLike && (() => {
        const currentPt = el.fontSizePt ?? 6.5;
        const currentPx = Math.round(currentPt * 1.3333);
        const buildSizePatch = (nextPx: number) => {
          const clampedPt = Number(Math.min(24, Math.max(4, nextPx * 0.75)).toFixed(2));
          const minH = Number((clampedPt * 0.352778 * (el.maxLines ?? 1) * 1.38).toFixed(2));
          return { fontSizePt: clampedPt, hMm: Number(Math.max(el.hMm, minH).toFixed(2)) };
        };
        return (
          <>
            <AppleSelect ariaLabel="Yazı tipi ailesi" value={el.fontFamily ?? 'sans'} options={PVC_FONT_OPTIONS} onChange={(val) => onChange({ fontFamily: val as PvcFontFamily })} />
            <SmoothRangeSlider
              label={`Yazı Boyutu: ${currentPx} px (${currentPt} pt)`}
              min={5}
              max={32}
              step={1}
              value={currentPx}
              onLiveChange={(px) => onLivePatch(buildSizePatch(px))}
              onCommit={(px) => onChange(buildSizePatch(px))}
            />
            <div className="pvc-mm-grid">
              <label className="pvc-mm-input">
                <span>Boyut (px)</span>
                <input type="number" step={1} min={5} max={32} value={currentPx} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(buildSizePatch(v)); }} />
              </label>
              <label className="pvc-mm-input">
                <span>Satır</span>
                <input type="number" step={1} min={1} max={4} value={el.maxLines ?? 1} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) onChange({ maxLines: Math.min(4, Math.max(1, v)) }); }} />
              </label>
            </div>
            <AppleSelect ariaLabel="Yazı kalınlığı" value={String(el.fontWeight ?? 600)} options={PVC_WEIGHT_OPTIONS} onChange={(val) => onChange({ fontWeight: Number(val) as PvcFontWeight })} />
            <AppleGlassSegment
              ariaLabel="Metin hizalama"
              fullWidth
              compact
              activeId={el.align ?? 'left'}
              items={[
                { id: 'left', label: 'Sol', iconHint: 'Not' },
                { id: 'center', label: 'Orta', iconHint: 'Sırala' },
                { id: 'right', label: 'Sağ', iconHint: 'Not' },
              ]}
              onChange={(id) => onChange({ align: id as PvcTextAlign })}
            />
            <label className="mod-check-label">
              <input type="checkbox" checked={Boolean(el.uppercase)} onChange={(e) => onChange({ uppercase: e.target.checked })} />
              Tamamı Büyük Harf
            </label>
            <PvcColorSwatchPicker label="Yazı Rengi" value={el.textColor ?? 'ink'} onChange={(textColor) => onChange({ textColor })} />
          </>
        );
      })()}

      {(el.kind === 'barcode' || el.kind === 'qrcode') && (
        <>
          <AppleSelect ariaLabel="Barkod veya QR veri kaynağı" value={el.codeSource ?? 'studentNumber'} options={PVC_CODE_SRC_SELECT_OPTIONS} onChange={(val) => onChange({ codeSource: val as PvcCodeSource })} />
          {el.kind === 'barcode' && (
            <label className="mod-check-label">
              <input type="checkbox" checked={el.showCodeText ?? true} onChange={(e) => onChange({ showCodeText: e.target.checked })} />
              Altında Numara Göster
            </label>
          )}
          <PvcColorSwatchPicker label="Kod Rengi" value={el.textColor ?? 'ink'} onChange={(textColor) => onChange({ textColor })} />
        </>
      )}

      {el.kind === 'signature' && (
        <AppleGlassSegment
          ariaLabel="İmza makamı"
          fullWidth
          compact
          activeId={el.sigRole ?? 'principal'}
          items={[
            { id: 'principal', label: 'Müdür', iconHint: 'Müdür' },
            { id: 'deputy', label: 'Md. Yrd.', iconHint: 'Müdür' },
          ]}
          onChange={(id) => onChange({ sigRole: id as 'principal' | 'deputy' })}
        />
      )}

      {(el.kind === 'shape' || el.kind === 'photo' || el.kind === 'school-logo' || el.kind === 'studio-logo' || el.kind === 'image') && (
        <div className="pvc-mm-grid">
          <label className="pvc-mm-input">
            <span>Köşe (mm)</span>
            <input type="number" step={0.5} min={0} max={30} value={el.radiusMm ?? 0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange({ radiusMm: Math.min(30, Math.max(0, v)) }); }} />
          </label>
          {(el.kind === 'shape' || el.kind === 'photo') && (
            <label className="pvc-mm-input">
              <span>Çerçeve</span>
              <input type="number" step={0.1} min={0} max={3} value={el.borderWidthMm ?? 0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange({ borderWidthMm: Math.min(3, Math.max(0, v)) }); }} />
            </label>
          )}
        </div>
      )}

      {(el.kind === 'shape' || el.kind === 'photo') && (el.borderWidthMm ?? 0) > 0 && (
        <PvcColorSwatchPicker label="Çerçeve Rengi" value={el.borderColor ?? 'accent'} allowClear onChange={(borderColor) => onChange({ borderColor })} />
      )}

      <SmoothRangeSlider
        label={`Opaklık: %${Math.round((el.opacity ?? 1) * 100)}`}
        min={5}
        max={100}
        step={5}
        value={Math.round((el.opacity ?? 1) * 100)}
        onLiveChange={(v) => onLivePatch({ opacity: v / 100 })}
        onCommit={(v) => onChange({ opacity: v / 100 })}
      />
    </div>
  );
});
