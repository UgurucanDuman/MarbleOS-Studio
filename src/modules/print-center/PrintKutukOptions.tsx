import React from 'react';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import {
  DEFAULT_KUTUK_NAME_BOX_STYLE,
  DEFAULT_KUTUK_PHOTO_FRAME,
  KUTUK_COL_CHOICES,
  KUTUK_LANDSCAPE_COL_CHOICES,
  KUTUK_LANDSCAPE_ROW_CHOICES,
  KUTUK_NAME_BOX_STYLE_META,
  KUTUK_PHOTO_FRAME_META,
  KUTUK_ROW_CHOICES,
  KUTUK_TEMPLATES,
} from '../../system/storage/yearbook-kutuk/catalog';
import type {
  KutukNameBoxStyle,
  KutukPhotoFrame,
  KutukTemplateId,
  KutukTemplateSpec,
} from '../../system/storage/yearbook-kutuk/types';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import type { PrintSheetMode } from './printSpecs';

/**
 * İZOLE MODÜL 04 ALT BİLEŞENİ: İdareci Kütük Dosyası Şablon, Esnek Sütun×Satır Izgara ve Başlık/İmza Kontrolleri
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const kutukTemplateOptions = KUTUK_TEMPLATES.map((tpl) => ({
  value: tpl.id,
  label: `${tpl.name} (${tpl.shortBadge})`,
  iconHint: 'Klasör',
}));

const kutukBoxStyleOptions = KUTUK_NAME_BOX_STYLE_META.map((item) => ({
  value: item.id,
  label: `${item.label} — ${item.description}`,
  iconHint: 'Görsel',
}));

const kutukPhotoFrameOptions = KUTUK_PHOTO_FRAME_META.map((item) => ({
  value: item.id,
  label: `${item.label} Portre Çerçevesi`,
  iconHint: 'Portre',
}));

export const PrintKutukOptions: React.FC<{
  albumConfig: AlbumTemplateConfig;
  kutukTemplate: KutukTemplateSpec;
  onPatch: (value: Partial<AlbumTemplateConfig>) => void;
  onChangeSheetMode?: (mode: PrintSheetMode) => void;
}> = React.memo(({ albumConfig, kutukTemplate, onPatch, onChangeSheetMode }) => {
  const showHeader = albumConfig.kutukShowHeader ?? true;
  const showSubtitle = albumConfig.kutukShowSubtitle ?? true;
  const colChoices = kutukTemplate.landscape ? KUTUK_LANDSCAPE_COL_CHOICES : KUTUK_COL_CHOICES;
  const rowChoices = kutukTemplate.landscape ? KUTUK_LANDSCAPE_ROW_CHOICES : KUTUK_ROW_CHOICES;

  return (
    <div className="pc-control-field">
      <span className="pc-control-label">İdareci Kütük Şablonu</span>
      <AppleSelect
        ariaLabel="İdareci kütük şablonu"
        value={kutukTemplate.id}
        options={kutukTemplateOptions}
        onChange={(nextId) => {
          const picked = KUTUK_TEMPLATES.find((t) => t.id === nextId);
          if (!picked) return;
          onPatch({
            kutukTemplateId: picked.id as KutukTemplateId,
            ...(picked.isCover ? {} : { columns: picked.cols, kutukCols: picked.cols, kutukRows: picked.rows }),
          });
          onChangeSheetMode?.(picked.landscape ? 'a4-album-landscape' : 'a4-kutuk-portrait');
        }}
      />
      {!kutukTemplate.isCover && (
        <>
          <div className="pc-section-head" style={{ marginTop: 4 }}>
            <span className="pc-control-label">Soldan Sağa (Sütun)</span>
            <span className="pc-ink-active-name">
              {kutukTemplate.cols}×{kutukTemplate.rows} · {kutukTemplate.studentsPerPage} portre
            </span>
          </div>
          <AppleGlassSegment
            ariaLabel="Baskı kütük sütun sayısı"
            fullWidth
            compact
            hideArrows
            hideIcons
            activeId={String(kutukTemplate.cols)}
            items={colChoices.map((n) => ({ id: String(n), label: String(n) }))}
            onChange={(val) => {
              const n = Number(val);
              onPatch({ kutukCols: n, columns: n });
            }}
          />
          <span className="pc-control-label" style={{ marginTop: 4 }}>Yukarıdan Aşağı (Satır)</span>
          <AppleGlassSegment
            ariaLabel="Baskı kütük satır sayısı"
            fullWidth
            compact
            hideArrows
            hideIcons
            activeId={String(kutukTemplate.rows)}
            items={rowChoices.map((n) => ({ id: String(n), label: String(n) }))}
            onChange={(val) => onPatch({ kutukRows: Number(val) })}
          />
          <span className="pc-control-label" style={{ marginTop: 4 }}>İsim Kutusu Tasarımı</span>
          <AppleSelect
            ariaLabel="Kütük isim kutusu stili"
            value={albumConfig.kutukNameBoxStyle ?? DEFAULT_KUTUK_NAME_BOX_STYLE}
            options={kutukBoxStyleOptions}
            onChange={(val) => onPatch({ kutukNameBoxStyle: val as KutukNameBoxStyle })}
          />
          <span className="pc-control-label" style={{ marginTop: 4 }}>Fotoğraf Çerçevesi</span>
          <AppleSelect
            ariaLabel="Kütük fotoğraf çerçevesi"
            value={albumConfig.kutukPhotoFrame ?? DEFAULT_KUTUK_PHOTO_FRAME}
            options={kutukPhotoFrameOptions}
            onChange={(val) => onPatch({ kutukPhotoFrame: val as KutukPhotoFrame })}
          />
          <label className="mod-check-label" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={showHeader}
              onChange={(e) => onPatch({ kutukShowHeader: e.target.checked })}
            />
            Üst Başlık Bloğunu Göster (Okul · Sınıf)
          </label>
          {showHeader && (
            <label className="mod-check-label">
              <input
                type="checkbox"
                checked={showSubtitle}
                onChange={(e) => onPatch({ kutukShowSubtitle: e.target.checked })}
              />
              Orta Başlık Satırını Göster
            </label>
          )}
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={Boolean(albumConfig.kutukIncludeCover)}
              onChange={(e) => onPatch({ kutukIncludeCover: e.target.checked })}
            />
            Dosya Başına Ön Kapak Ekle
          </label>
        </>
      )}
      <label className="mod-check-label">
        <input
          type="checkbox"
          checked={albumConfig.kutukShowStaffPortraits ?? true}
          onChange={(e) => onPatch({ kutukShowStaffPortraits: e.target.checked })}
        />
        Üstte İdareci &amp; Öğretmen Portresi
      </label>
      {!kutukTemplate.isCover && (
        <>
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.kutukShowTeacherSig ?? true}
              onChange={(e) => onPatch({ kutukShowTeacherSig: e.target.checked })}
            />
            Sınıf / Rehber Öğretmeni İmzası
          </label>
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.kutukShowDeputySig ?? true}
              onChange={(e) => onPatch({ kutukShowDeputySig: e.target.checked })}
            />
            Sorumlu Müdür Yardımcısı İmzası
          </label>
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.kutukShowPrincipalSig ?? true}
              onChange={(e) => onPatch({ kutukShowPrincipalSig: e.target.checked })}
            />
            Okul Müdürü İmzası
          </label>
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.kutukShowPageNumber ?? true}
              onChange={(e) => onPatch({ kutukShowPageNumber: e.target.checked })}
            />
            Alt Sayfa Numarasını Göster
          </label>
        </>
      )}
    </div>
  );
});
