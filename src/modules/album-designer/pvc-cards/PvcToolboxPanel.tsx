import React, { useRef } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import { PVC_FIELD_MAP } from '../../../system/storage/pvc-cards/fieldResolver';
import type {
  PvcCardElement,
  PvcFieldKey,
  PvcShapeVariant,
} from '../../../system/storage/pvc-cards/types';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';

/**
 * İZOLE MODÜL 03 SÜRÜKLE-BIRAK ARAÇ KUTUSU & KATMAN LİSTESİ:
 * Fotoğrafçı her öğeyi (Portre, Logo, Stüdyo Logosu, Özel Görsel, Şekiller, Öğrenci/Stüdyo Alanları,
 * Barkod, QR) doğrudan tutup kart üzerine sürükleyebilir veya tek tıkla ekleyebilir.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export interface PvcPaletteToolPayload {
  kind: PvcCardElement['kind'];
  fieldKey?: PvcFieldKey;
  shapeVariant?: PvcShapeVariant;
}

interface ToolItem extends PvcPaletteToolPayload {
  label: string;
}

const MEDIA_TOOLS: readonly ToolItem[] = [
  { kind: 'photo', label: 'Öğrenci Portre' },
  { kind: 'school-logo', label: 'Okul Logosu' },
  { kind: 'studio-logo', label: 'Stüdyo Logosu' },
  { kind: 'signature', label: 'Müdür İmzası' },
  { kind: 'barcode', label: 'Code128 Barkod' },
  { kind: 'qrcode', label: 'QR Kod' },
];

const SHAPE_TOOLS: readonly ToolItem[] = [
  { kind: 'shape', shapeVariant: 'rect', label: 'Kutu / Bant' },
  { kind: 'shape', shapeVariant: 'circle', label: 'Daire / Oval' },
  { kind: 'shape', shapeVariant: 'wave', label: 'Dalga Başlık' },
  { kind: 'shape', shapeVariant: 'diagonal', label: 'Çapraz Şerit' },
  { kind: 'shape', shapeVariant: 'line', label: 'Ayırıcı Çizgi' },
  { kind: 'text', label: 'Özel Metin' },
];

const STUDENT_FIELD_TOOLS: readonly ToolItem[] = [
  { kind: 'field', fieldKey: 'fullName', label: 'Ad Soyad' },
  { kind: 'field', fieldKey: 'className', label: 'Sınıf / Şube' },
  { kind: 'field', fieldKey: 'studentNumber', label: 'Okul No' },
  { kind: 'field', fieldKey: 'classAndNumber', label: 'Sınıf & No' },
  { kind: 'field', fieldKey: 'department', label: 'Bölümü / Alanı' },
  { kind: 'field', fieldKey: 'nationalId', label: 'T.C. Kimlik No' },
  { kind: 'field', fieldKey: 'bloodType', label: 'Kan Grubu' },
  { kind: 'field', fieldKey: 'birthInfo', label: 'Doğum Bilgisi' },
  { kind: 'field', fieldKey: 'fatherName', label: 'Baba Adı' },
  { kind: 'field', fieldKey: 'schoolName', label: 'Okul Adı' },
  { kind: 'field', fieldKey: 'schoolAddress', label: 'Okul Adresi' },
  { kind: 'field', fieldKey: 'academicYear', label: 'Eğitim Yılı' },
];

const STUDIO_FIELD_TOOLS: readonly ToolItem[] = [
  { kind: 'field', fieldKey: 'studioName', label: 'Stüdyo Adı' },
  { kind: 'field', fieldKey: 'studioPhone', label: 'Stüdyo Tel' },
  { kind: 'field', fieldKey: 'studioAddress', label: 'Stüdyo Adres' },
  { kind: 'field', fieldKey: 'studioOwner', label: 'Yetkili Adı' },
];

function layerLabel(el: PvcCardElement): string {
  switch (el.kind) {
    case 'photo': return 'Öğrenci Portresi';
    case 'school-logo': return (el.opacity ?? 1) < 0.35 ? 'Logo Filigran' : 'Okul Logosu';
    case 'studio-logo': return 'Stüdyo Logosu';
    case 'image': return 'Özel PNG Görsel';
    case 'signature': return el.sigRole === 'deputy' ? 'Md. Yrd. İmzası' : 'Müdür İmzası';
    case 'barcode': return 'Code128 Barkod';
    case 'qrcode': return 'QR Kod';
    case 'shape': return `Şekil (${el.shapeVariant ?? 'kutu'})`;
    case 'text': return el.text?.slice(0, 20) || 'Sabit Metin';
    case 'field': return el.fieldKey ? (PVC_FIELD_MAP.get(el.fieldKey)?.label ?? el.fieldKey) : 'Alan';
  }
}

const DraggableToolTile: React.FC<{
  item: ToolItem;
  onAdd: (payload: PvcPaletteToolPayload) => void;
}> = ({ item, onAdd }) => (
  <button
    type="button"
    draggable
    className="pvc-drag-tile"
    title="Karta sürükleyip bırakın veya tıklayın"
    onDragStart={(e) => {
      e.dataTransfer.setData(
        'application/x-marbleos-pvc',
        JSON.stringify({ kind: item.kind, fieldKey: item.fieldKey, shapeVariant: item.shapeVariant }),
      );
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onClick={() => onAdd({ kind: item.kind, fieldKey: item.fieldKey, shapeVariant: item.shapeVariant })}
  >
    <span className="pvc-drag-grip" aria-hidden="true">⋮⋮</span>
    <span>{item.label}</span>
  </button>
);

export const PvcToolboxPanel: React.FC<{
  elements: readonly PvcCardElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddTool: (payload: PvcPaletteToolPayload) => void;
  onAddCustomImage: (dataUrl: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteElement: (id: string) => void;
}> = React.memo(({
  elements,
  selectedElementId,
  onSelectElement,
  onAddTool,
  onAddCustomImage,
  onToggleVisibility,
  onDeleteElement,
}) => {
  const stickerInputRef = useRef<HTMLInputElement | null>(null);

  const handleStickerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      notifyStudio('Özel kart görseli/etiket en fazla 2 MB olabilir (PNG, JPG veya WebP).', 'error');
      return;
    }
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      const dataUrl = encoded[0]?.dataUrl;
      if (dataUrl) onAddCustomImage(dataUrl);
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="pvc-editor-stack">
      <p className="pvc-drag-hint">
        İstediğiniz öğeyi <strong>tutup doğrudan kartın üzerine sürükleyin</strong> veya tek tıkla ekleyin.
      </p>

      <div className="tc-section">
        <span className="tc-section-label">Fotoğraf, Logo &amp; Kodlar</span>
        <div className="pvc-drag-grid">
          {MEDIA_TOOLS.map((it) => (
            <DraggableToolTile key={`${it.kind}-${it.label}`} item={it} onAdd={onAddTool} />
          ))}
        </div>
        <input
          ref={stickerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          aria-label="Karta özel PNG veya JPG görsel ekle"
          onChange={(e) => void handleStickerFile(e)}
        />
        <button type="button" className="mod-cover-upload-btn" onClick={() => stickerInputRef.current?.click()}>
          + Özel Görsel / Arma Yükle (PNG)
        </button>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Şekiller &amp; Süsleme</span>
        <div className="pvc-drag-grid">
          {SHAPE_TOOLS.map((it) => (
            <DraggableToolTile key={`${it.kind}-${it.shapeVariant ?? 't'}`} item={it} onAdd={onAddTool} />
          ))}
        </div>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Öğrenci &amp; Okul Alanları</span>
        <div className="pvc-drag-grid">
          {STUDENT_FIELD_TOOLS.map((it) => (
            <DraggableToolTile key={it.fieldKey} item={it} onAdd={onAddTool} />
          ))}
        </div>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Fotoğrafçı / Stüdyo Alanları</span>
        <div className="pvc-drag-grid">
          {STUDIO_FIELD_TOOLS.map((it) => (
            <DraggableToolTile key={it.fieldKey} item={it} onAdd={onAddTool} />
          ))}
        </div>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Katmanlar ({elements.length})</span>
        <div className="pvc-layer-list" role="listbox" aria-label="Kart yüzü katmanları">
          {[...elements].reverse().map((el) => {
            const active = el.id === selectedElementId;
            return (
              <div
                key={el.id}
                role="option"
                aria-selected={active}
                className={`pvc-layer-row ${active ? 'is-active' : ''}`.trim()}
                onClick={() => onSelectElement(el.id)}
              >
                <span className="pvc-layer-name">
                  {layerLabel(el)}
                  {el.locked ? ' · Kilitli' : ''}
                </span>
                <div className="pvc-layer-btns">
                  <button
                    type="button"
                    className="pvc-layer-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(el.id);
                    }}
                  >
                    {el.visible === false ? 'Kapalı' : 'Açık'}
                  </button>
                  <button
                    type="button"
                    className="pvc-layer-icon-btn is-danger"
                    aria-label={`${layerLabel(el)} katmanını sil`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(el.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
