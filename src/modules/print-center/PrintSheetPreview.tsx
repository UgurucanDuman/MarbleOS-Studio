import React from 'react';
import type { PrintDuplexMode, PrintScaleMode } from '../../system/desktop/desktopPrinter';
import { usesDesktopStorage } from '../../system/desktop/desktopStorage';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { DEFAULT_LOCAL_STORAGE_LAYOUT } from '../../system/storage/localMediaStorage';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../system/storage/StudioPhotoImage';
import { StageZoomBar, useViewportWheelZoom } from '../../window-system/StageZoomBar';
import type { PortraitExportFormat } from './jpgSheetExporter';
import { PrintPageStrip } from './PrintPageStrip';
import { PrintPaperCanvas, type PrintStageZoom } from './PrintPaperCanvas';
import {
  normalizeSheetModeForProduct,
  PRINT_PRODUCTS,
  type ImpositionPage,
  type PrintableStudentEntry,
  type PrintProductId,
  type PrintSheetMode,
} from './printSpecs';
import { PrintStudioIcon } from './PrintStudioIcons';
import { isStaffStudentNumber } from './sheetComposer';
import './print-sheet-preview.css';

/**
 * İZOLE MODÜL 04 SAĞ CANLI BASKI SAHNESİ:
 * Geniş Karanlık Oda Sahnesi, 0.5x – 5x (%500) Yakınlaştırma, Kesim & Cetvel Anahtarı, Sayfa Şeridi ve ZIP Görünümü
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PrintSheetPreview: React.FC<{
  schoolName: string;
  scopeLabel: string;
  productId: PrintProductId;
  sheetMode: PrintSheetMode;
  albumConfig: AlbumTemplateConfig;
  entries: readonly PrintableStudentEntry[];
  pages: readonly ImpositionPage[];
  pageIndex: number;
  pageDir: number;
  stageZoom: PrintStageZoom;
  showCropMarks: boolean;
  scaleMode?: PrintScaleMode;
  duplex?: PrintDuplexMode;
  exportFormat?: PortraitExportFormat;
  logoUrl?: string;
  watermarkOpacity?: number;
  principalSigUrl?: string;
  deputySigUrl?: string;
  coverUrl?: string;
  coverZoom?: number;
  schoolAddress?: string;
  institutionCode?: string;
  onChangePage: (nextIndex: number, dir: number) => void;
  onChangeZoom: (zoom: PrintStageZoom) => void;
  onToggleCropMarks: () => void;
}> = React.memo(({
  schoolName,
  scopeLabel,
  productId,
  sheetMode,
  albumConfig,
  entries,
  pages,
  pageIndex,
  pageDir,
  stageZoom,
  showCropMarks,
  scaleMode = 'actual-100',
  duplex = 'simplex',
  exportFormat = 'pdf',
  logoUrl = '',
  watermarkOpacity = 0.08,
  principalSigUrl = '',
  deputySigUrl = '',
  coverUrl = '',
  coverZoom = 1,
  schoolAddress = '',
  institutionCode = '',
  onChangePage,
  onChangeZoom,
  onToggleCropMarks,
}) => {
  const viewportRef = useViewportWheelZoom<HTMLDivElement>(stageZoom, onChangeZoom);
  const product = PRINT_PRODUCTS[productId];
  const normalizedMode = normalizeSheetModeForProduct(productId, sheetMode);
  const isZipMode = productId === 'e-okul-zip' || normalizedMode === 'single-zip';
  const safeIndex = pages.length > 0 ? Math.min(pageIndex, pages.length - 1) : 0;
  const activePage = pages[safeIndex] ?? null;
  const outboxLabel = usesDesktopStorage
    ? `exports/${product.subfolder}/`
    : DEFAULT_LOCAL_STORAGE_LAYOUT.printOutboxDir;
  const showEmpty = isZipMode ? entries.length === 0 : pages.length === 0;

  return (
    <section className="pc-stage-shell" aria-label="Canlı baskı ve paket sahnesi">
      <div className="pc-stage-toolbar">
        <div className="pc-stage-meta">
          <strong>
            {isZipMode
              ? `ZIP Paket Sahnesi · ${entries.length} Dosya`
              : activePage?.kind === 'student-list'
                ? `Öğrenci Sıra Listesi · ${activePage.titleLabel}`
                : activePage
                  ? `Canlı Baskı Sahnesi · ${activePage.widthMm}×${activePage.heightMm} mm · ${scaleMode === 'fit-page' ? 'Sığdır' : '%100 mm'}${duplex !== 'simplex' ? ' · Çift Yüz' : ''} · 300 DPI${exportFormat === 'jpg' ? ' · JPG' : ''}`
                  : `Canlı Baskı Sahnesi · ${product.shortLabel}`}
          </strong>
          <small>
            {product.fullLabel} · Hedef: {outboxLabel}
          </small>
        </div>

        {!isZipMode && (
          <div className="pc-stage-tools">
            {sheetMode !== 'a4-student-list' && <button
              type="button"
              className={`pc-crop-toggle-btn ${showCropMarks ? 'is-on' : ''}`.trim()}
              aria-pressed={showCropMarks}
              onClick={onToggleCropMarks}
            >
              <PrintStudioIcon kind="ruler" size={13} />
              <span>Kesim &amp; Cetvel</span>
            </button>}

            <StageZoomBar zoom={stageZoom} onChangeZoom={onChangeZoom} />

            {pages.length > 1 && (
              <div className="pc-page-stepper" role="group" aria-label="Dizgi sayfaları">
                <button
                  type="button"
                  className="pc-step-btn"
                  disabled={safeIndex <= 0}
                  aria-label="Önceki dizgi sayfası"
                  onClick={() => onChangePage(Math.max(0, safeIndex - 1), -1)}
                >
                  ‹
                </button>
                <span>
                  {safeIndex + 1} / {pages.length}
                </span>
                <button
                  type="button"
                  className="pc-step-btn"
                  disabled={safeIndex >= pages.length - 1}
                  aria-label="Sonraki dizgi sayfası"
                  onClick={() => onChangePage(Math.min(pages.length - 1, safeIndex + 1), 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={viewportRef} className="pc-stage-viewport">
        {showEmpty ? (
          <div className="pc-empty-preview">
            <PrintStudioIcon kind="portrait" size={28} />
            <strong>{sheetMode === 'a4-student-list' ? 'Seçili kapsamda öğrenci bulunmuyor' : 'Baskı Sahnesine Girecek Portre Bulunmuyor'}</strong>
            {sheetMode !== 'a4-student-list' && <small>
              Seçili kapsamda baskı onayı verilmiş portre yoksa soldaki denetçiden filtreyi &ldquo;Eşleşen&rdquo;
              yapabilir veya Albüm Tasarım modülünden &ldquo;Baskıya Onayla&rdquo; tuşuna basabilirsiniz.
            </small>}
          </div>
        ) : isZipMode ? (
          <AppleCrossfadeSlot
            activeKey={`zip-${productId}-${normalizedMode}`}
            direction={pageDir}
            variant="page"
            className="pc-stage-crossfade"
            cellClassName="pc-stage-crossfade-cell"
          >
            <div className="pc-zip-preview">
              <div className="pc-zip-meta">
                <span>Toplam {entries.length} JPEG dosya</span>
                <span>·</span>
                <span>{product.widthPx}×{product.heightPx} px</span>
                <span>·</span>
                <span>SHA-256 manifest.json &amp; kontrol_listesi.csv</span>
              </div>
              <ul className="pc-zip-list" aria-label="Arşivlenecek örnek dosyalar">
                {entries.slice(0, 16).map(({ student, photo, className }) => {
                  const sampleName =
                    productId === 'e-okul-zip'
                      ? `${className ? `${className}/` : ''}${student.studentNumber}.jpg`
                      : `${className ? `${className}/` : ''}${student.studentNumber}_${student.firstName}_${student.lastName}.jpg`;
                  const subText = isStaffStudentNumber(student.studentNumber)
                    ? `${student.firstName} ${student.lastName}`
                    : `${student.studentNumber} ${student.firstName} ${student.lastName}`;
                  return (
                    <li key={student.id} className="pc-zip-item">
                      <div className="pc-zip-thumb">
                        <StudioPhotoImage
                          photo={photo}
                          alt={student.firstName}
                          loading="lazy"
                          decoding="async"
                          style={photoAdjustmentStyle(photo.adjustments)}
                        />
                      </div>
                      <div className="pc-zip-item-text">
                        <strong>{sampleName}</strong>
                        <small>{subText}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {entries.length > 16 && (
                <small className="pc-zip-more">+ {entries.length - 16} portre daha pakete eklenecek</small>
              )}
            </div>
          </AppleCrossfadeSlot>
        ) : (
          activePage && (
            <div className="pc-sheet-stage">
              <AppleCrossfadeSlot
                activeKey={`page-${safeIndex}-${productId}-${normalizedMode}`}
                direction={pageDir}
                variant="page"
                className="pc-stage-crossfade"
                cellClassName="pc-stage-crossfade-cell"
              >
                <PrintPaperCanvas
                  page={activePage}
                  pageNumber={safeIndex + 1}
                  totalPages={pages.length}
                  productId={productId}
                  schoolName={schoolName}
                  scopeLabel={scopeLabel}
                  albumConfig={albumConfig}
                  showCropMarks={showCropMarks}
                  scaleMode={scaleMode}
                  stageZoom={stageZoom}
                  logoUrl={logoUrl}
                  watermarkOpacity={watermarkOpacity}
                  principalSigUrl={principalSigUrl}
                  deputySigUrl={deputySigUrl}
                  coverUrl={coverUrl}
                  coverZoom={coverZoom}
                  schoolAddress={schoolAddress}
                  institutionCode={institutionCode}
                />
              </AppleCrossfadeSlot>
            </div>
          )
        )}
      </div>

      {!isZipMode && pages.length > 1 && (
        <PrintPageStrip pages={pages} activeIndex={safeIndex} onChangePage={onChangePage} />
      )}
    </section>
  );
});
