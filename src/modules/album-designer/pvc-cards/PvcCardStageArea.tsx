import React, { useMemo, useRef } from 'react';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type { PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import type { PrintFontPoint } from '../../../system/storage/printTypography';
import {
  PvcCardLiveView,
  type PvcCardInteractiveProps,
} from '../../../system/storage/pvc-cards/PvcCardLiveView';
import type {
  PvcCardDataContext,
  PvcCardSide,
  PvcResolvedDesign,
} from '../../../system/storage/pvc-cards/types';
import type { TeacherChartPalette } from '../../../system/storage/teacher-charts/types';
import { useProgressiveSlice } from '../../../system/storage/useProgressiveSlice';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import {
  StageZoomBar,
  type StageZoomValue,
  useViewportWheelZoom,
} from '../../../window-system/StageZoomBar';
import { PvcStudentFilmstrip } from './PvcStudentFilmstrip';

/**
 * İZOLE MODÜL 03 SAĞ CANLI KART SAHNESİ:
 * Çakışmasız Apple Pro 2 satırlı sahne başlığı: Üstte Şablon + Ön/Arka/Sınıf + Kılavuz,
 * altta Gerçek Öğrenci Seçicisi + "Kartta Düzenle" + Yakınlaştırma; en altta tekerlekli öğrenci şeridi.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export type PvcStageViewMode = 'front' | 'back' | 'both' | 'class-grid';

const VIEW_MODE_ORDER: readonly PvcStageViewMode[] = ['front', 'back', 'both', 'class-grid'];

export const PvcCardStageArea: React.FC<{
  design: PvcResolvedDesign;
  designWithDraft: PvcResolvedDesign;
  palette: TeacherChartPalette;
  viewMode: PvcStageViewMode;
  activeSide: PvcCardSide;
  showSafeGuides: boolean;
  canDragEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: StageZoomValue;
  classId: string;
  classStudents: readonly StudentRecord[];
  activeStudentIndex: number;
  activeStudent: StudentRecord | null;
  activePhoto: PhotoRecord | null;
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl: string;
  studioLogoUrl: string;
  principalSigUrl: string;
  deputySigUrl: string;
  printFontPt?: PrintFontPoint;
  cardRef: React.RefObject<HTMLDivElement | null>;
  interactive?: PvcCardInteractiveProps;
  makeDataContext: (student: StudentRecord | null) => PvcCardDataContext;
  onChangeViewMode: (mode: PvcStageViewMode) => void;
  onToggleSafeGuides: () => void;
  onChangeZoom: (z: StageZoomValue) => void;
  onSelectStudentId: (id: string) => void;
  onSwitchToEditor: () => void;
  onUndo: () => void;
  onRedo: () => void;
}> = React.memo(({
  design, designWithDraft, palette, viewMode, activeSide, showSafeGuides, canDragEdit,
  canUndo, canRedo, zoom, classId, classStudents, activeStudentIndex, activeStudent,
  activePhoto, photoMap, logoUrl, studioLogoUrl, principalSigUrl, deputySigUrl, printFontPt,
  cardRef, interactive, makeDataContext, onChangeViewMode, onToggleSafeGuides, onChangeZoom,
  onSelectStudentId, onSwitchToEditor, onUndo, onRedo,
}) => {
  const viewportRef = useViewportWheelZoom<HTMLDivElement>(zoom, onChangeZoom);
  const prevViewRef = useRef<PvcStageViewMode>(viewMode);
  const viewDirRef = useRef(1);
  if (prevViewRef.current !== viewMode) {
    const prevIdx = VIEW_MODE_ORDER.indexOf(prevViewRef.current);
    const nextIdx = VIEW_MODE_ORDER.indexOf(viewMode);
    if (prevIdx !== nextIdx) viewDirRef.current = nextIdx > prevIdx ? 1 : -1;
    prevViewRef.current = viewMode;
  }
  const activeData = useMemo(() => makeDataContext(activeStudent), [makeDataContext, activeStudent]);

  const studentSelectOptions = useMemo(
    () =>
      classStudents.map((s) => ({
        value: s.id,
        label: `${s.studentNumber} · ${s.firstName} ${s.lastName}${s.matchedPhotoId ? '' : ' (Foto Yok)'}`,
        iconHint: 'Öğrenci',
      })),
    [classStudents],
  );

  const { visibleItems: gridStudents, hasMore, sentinelRef, handleScroll } = useProgressiveSlice(
    classStudents,
    `${classId}:${design.id}:grid`,
    48,
  );

  const baseCardPx = design.orientation === 'portrait' ? 315 : 500;
  const stageCardWidth =
    zoom === 'fit'
      ? `min(${baseCardPx}px, ${viewMode === 'both' ? '45cqi' : '94cqi'})`
      : `${Math.round(baseCardPx * zoom)}px`;

  return (
    <div className="tc-stage-panel pvc-stage-panel">
      <div className="tc-stage-bar pvc-stage-bar">
        <div className="tc-stage-info pvc-stage-title">
          <strong>{design.name}</strong>
          <small>
            CR80 {design.widthMm}×{design.heightMm} mm · Köşe {design.cardRadiusMm.toFixed(1)} mm · 300 DPI
          </small>
        </div>

        <div className="pvc-stage-toolbar">
          {canDragEdit && (
            <div className="pvc-undo-group" role="group" aria-label="Geri al ve ileri al">
              <button type="button" className="pvc-mini-btn" disabled={!canUndo} title="Geri Al (Ctrl+Z)" onClick={onUndo}>↶</button>
              <button type="button" className="pvc-mini-btn" disabled={!canRedo} title="İleri Al (Ctrl+Y)" onClick={onRedo}>↷</button>
            </div>
          )}
          <AppleGlassSegment
            ariaLabel="Kart sahne görünümü"
            compact
            activeId={viewMode}
            items={[
              { id: 'front', label: 'Ön Yüz', iconHint: 'Kimlik' },
              { id: 'back', label: 'Arka Yüz', iconHint: 'Not' },
              { id: 'both', label: 'Ön + Arka', iconHint: 'Kopya' },
              { id: 'class-grid', label: `Sınıf (${classStudents.length})`, iconHint: 'Sınıf' },
            ]}
            onChange={(id) => onChangeViewMode(id as PvcStageViewMode)}
          />
          <button
            type="button"
            className={`pvc-guide-toggle ${showSafeGuides ? 'is-on' : ''}`.trim()}
            aria-pressed={showSafeGuides}
            onClick={onToggleSafeGuides}
          >
            3 mm Kılavuz
          </button>
        </div>
      </div>

      {viewMode !== 'class-grid' && (
        <div className="pvc-student-bar">
          <div className="pvc-student-controls">
            {classStudents.length > 0 ? (
              <div className="pvc-student-nav">
                <button
                  type="button"
                  className="tc-step-btn"
                  aria-label="Önceki öğrenci kartı"
                  disabled={activeStudentIndex <= 0}
                  onClick={() => onSelectStudentId(classStudents[Math.max(0, activeStudentIndex - 1)]!.id)}
                >
                  ‹
                </button>
                <div className="pvc-student-select-wrap">
                  <AppleSelect
                    ariaLabel="Önizlenen öğrenci seç"
                    value={activeStudent?.id ?? ''}
                    options={studentSelectOptions}
                    onChange={onSelectStudentId}
                  />
                </div>
                <button
                  type="button"
                  className="tc-step-btn"
                  aria-label="Sonraki öğrenci kartı"
                  disabled={activeStudentIndex >= classStudents.length - 1}
                  onClick={() =>
                    onSelectStudentId(classStudents[Math.min(classStudents.length - 1, activeStudentIndex + 1)]!.id)
                  }
                >
                  ›
                </button>
                <span className="pvc-student-counter">
                  {activeStudentIndex + 1} / {classStudents.length}
                </span>
              </div>
            ) : (
              <small className="pvc-student-empty-hint">
                Sınıfa öğrenci ve fotoğraf eklediğinizde gerçek veriler doğrudan bu karta yansır.
              </small>
            )}
            {!canDragEdit && (
              <button
                type="button"
                className="pvc-mini-btn is-primary pvc-edit-canvas-btn"
                onClick={onSwitchToEditor}
                title="Bu şablonun tüm yazı, fotoğraf, barkod ve şekillerini tuvalde serbestçe düzenleyin"
              >
                Kartta Düzenle
              </button>
            )}
          </div>

          <StageZoomBar zoom={zoom} onChangeZoom={onChangeZoom} />
        </div>
      )}

      <div ref={viewportRef} className="tc-paper-viewport pvc-stage-viewport" onScroll={handleScroll}>
        <AppleCrossfadeSlot
          activeKey={`${viewMode}::${design.id}`}
          direction={viewDirRef.current}
          variant="page"
          className="pvc-stage-crossfade"
          cellClassName="pvc-stage-crossfade-cell"
        >
          {viewMode === 'class-grid' ? (
            <div className={`pvc-class-card-grid ${design.orientation === 'portrait' ? 'is-portrait' : ''}`.trim()}>
              {gridStudents.length === 0 ? (
                <p className="pvc-empty-custom-note">Bu şubede henüz kayıtlı öğrenci bulunmuyor.</p>
              ) : (
                gridStudents.map((stu) => (
                  <div
                    key={stu.id}
                    className="pvc-grid-item"
                    onClick={() => {
                      onSelectStudentId(stu.id);
                      onChangeViewMode('front');
                    }}
                  >
                    <PvcCardLiveView
                      design={design}
                      side="front"
                      palette={palette}
                      data={makeDataContext(stu)}
                      photo={stu.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) ?? null : null}
                      logoUrl={logoUrl}
                      studioLogoUrl={studioLogoUrl}
                      principalSigUrl={principalSigUrl}
                      deputySigUrl={deputySigUrl}
                      printFontPt={printFontPt}
                    />
                  </div>
                ))
              )}
              {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
            </div>
          ) : viewMode === 'both' ? (
            <div className="pvc-both-stage">
              {(['front', 'back'] as const).map((side) => (
                <div key={side} className="pvc-card-column" style={{ width: stageCardWidth }}>
                  <span className="pvc-side-caption">
                    {side === 'front' ? 'Ön Yüz' : 'Arka Yüz'} ({design.widthMm}×{design.heightMm} mm)
                  </span>
                  <PvcCardLiveView
                    design={design}
                    side={side}
                    palette={palette}
                    data={activeData}
                    photo={activePhoto}
                    logoUrl={logoUrl}
                    studioLogoUrl={studioLogoUrl}
                    principalSigUrl={principalSigUrl}
                    deputySigUrl={deputySigUrl}
                    printFontPt={printFontPt}
                    showSafeGuides={showSafeGuides}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="tc-paper-stage">
              <div
                className="pvc-card-column"
                style={{ width: stageCardWidth }}
                onDoubleClick={!canDragEdit ? onSwitchToEditor : undefined}
                title={!canDragEdit ? 'Çift tıklayarak bu şablonu tuvalde serbestçe düzenleyebilirsiniz' : undefined}
              >
                <PvcCardLiveView
                  cardRef={cardRef}
                  design={designWithDraft}
                  side={activeSide}
                  palette={palette}
                  data={activeData}
                  photo={activePhoto}
                  logoUrl={logoUrl}
                  studioLogoUrl={studioLogoUrl}
                  principalSigUrl={principalSigUrl}
                  deputySigUrl={deputySigUrl}
                  printFontPt={printFontPt}
                  showSafeGuides={showSafeGuides}
                  interactive={interactive}
                />
              </div>
            </div>
          )}
        </AppleCrossfadeSlot>
      </div>

      {viewMode !== 'class-grid' && classStudents.length > 1 && (
        <PvcStudentFilmstrip
          students={classStudents}
          activeStudentId={activeStudent?.id ?? null}
          photoMap={photoMap}
          onSelectStudentId={onSelectStudentId}
        />
      )}
    </div>
  );
});
