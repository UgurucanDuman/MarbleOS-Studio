import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useCompanyLogoUrl, useCompanyProfile } from '../../../system/desktop/desktopPersonalization';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type {
  AlbumTemplateConfig, ClassRecord, PhotoRecord, SchoolRecord, StudentRecord,
} from '../../../system/sqlite/types';
import { cloneDesignToCustom } from '../../../system/storage/pvc-cards/catalog';
import { pvcCardDimensions, type PvcCardDataContext, type PvcCardSide, type PvcCustomDesign } from '../../../system/storage/pvc-cards/types';
import { resolveTeacherChartConfig } from '../../../system/storage/teacher-charts/paginationMath';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { useOriginSheet } from '../../../window-system/sheet/useOriginSheet';
import type { StageZoomValue } from '../../../window-system/StageZoomBar';
import '../teacher-charts/teacher-charts-ui.css';
import { NewPvcDesignSheet } from './NewPvcDesignSheet';
import { PvcCardStageArea, type PvcStageViewMode } from './PvcCardStageArea';
import { PvcCardSurfacePanel } from './PvcCardSurfacePanel';
import { PvcSelectedElementInspector } from './PvcSelectedElementInspector';
import { PvcStudioBrandPanel } from './PvcStudioBrandPanel';
import { PvcTemplateGalleryPanel } from './PvcTemplateGalleryPanel';
import { PvcToolboxPanel, type PvcPaletteToolPayload } from './PvcToolboxPanel';
import { usePvcCanvasDrag } from './usePvcCanvasDrag';
import { usePvcDesignController } from './usePvcDesignController';
import './pvc-cards-stage.css';
import './pvc-cards-ui.css';

/**
 * İZOLE MODÜL 03 PRO PVC KİMLİK KARTI STÜDYOSU:
 * 5 stüdyo sınıfı hazır tasarım + sınırsız sürükle-bırak/döndür/şekillendir serbest tasarımcı
 * + arka yüzde fotoğrafçının kendi logosu, adı, telefonu ve adresi + gerçek öğrenci fotoğrafları.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

type RailTab = 'templates' | 'editor' | 'studio';
const RAIL_TAB_ORDER: readonly RailTab[] = ['templates', 'editor', 'studio'];

export const PvcCardWorkspace: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeSchool: SchoolRecord | null;
  activeSchoolName: string;
  activeClass: ClassRecord | undefined;
  classStudents: readonly StudentRecord[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  isStaffCard: boolean;
  logoUrl: string;
  principalSigUrl: string;
  deputySigUrl: string;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig, activeSchool, activeSchoolName, activeClass, classStudents,
  photoMap, isStaffCard, logoUrl, principalSigUrl, deputySigUrl, onPatchConfig,
}) => {
  const company = useCompanyProfile();
  const studioLogoUrl = useCompanyLogoUrl() ?? '';
  const [railTab, setRailTab] = useState<RailTab>('templates');
  const [railDir, setRailDir] = useState(1);
  const [viewMode, setViewMode] = useState<PvcStageViewMode>('front');
  const [showSafeGuides, setShowSafeGuides] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<StageZoomValue>('fit');
  const [renameTarget, setRenameTarget] = useState<PvcCustomDesign | null>(null);
  const [sheetBaseId, setSheetBaseId] = useState<string>('blank');
  const designSheet = useOriginSheet();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const activeSide: PvcCardSide = viewMode === 'back' ? 'back' : 'front';
  const isEditorOpen = railTab === 'editor';
  const canDragEdit = isEditorOpen && (viewMode === 'front' || viewMode === 'back');

  const ctrl = usePvcDesignController({
    albumConfig, activeSide, canDragEdit, selectedElementId, setSelectedElementId, onPatchConfig,
  });

  const { palette, activeInk } = useMemo(
    () => resolveTeacherChartConfig(albumConfig, activeClass?.name),
    [albumConfig, activeClass?.name],
  );

  const activeStudentIndex = useMemo(() => {
    if (classStudents.length === 0) return -1;
    const found = classStudents.findIndex((s) => s.id === selectedStudentId);
    return found >= 0 ? found : 0;
  }, [classStudents, selectedStudentId]);
  const activeStudent = activeStudentIndex >= 0 ? classStudents[activeStudentIndex]! : null;
  const activePhoto = activeStudent?.matchedPhotoId ? photoMap.get(activeStudent.matchedPhotoId) ?? null : null;

  const drag = usePvcCanvasDrag({
    enabled: canDragEdit,
    cardWidthMm: ctrl.activeDesign.widthMm,
    cardHeightMm: ctrl.activeDesign.heightMm,
    elements: ctrl.activeElements,
    cardRef,
    onCommitTransform: ctrl.patchElementById,
  });

  const designWithDraft = useMemo(() => {
    if (!drag.draft) return ctrl.activeDesign;
    const { elId, xMm, yMm, wMm, hMm, rotationDeg } = drag.draft;
    const sideSpec = activeSide === 'back' ? ctrl.activeDesign.back : ctrl.activeDesign.front;
    return {
      ...ctrl.activeDesign,
      [activeSide]: {
        ...sideSpec,
        elements: sideSpec.elements.map((el) => (el.id === elId ? { ...el, xMm, yMm, wMm, hMm, rotationDeg } : el)),
      },
    };
  }, [activeSide, ctrl.activeDesign, drag.draft]);

  const makeDataContext = useCallback(
    (student: StudentRecord | null): PvcCardDataContext => ({
      schoolName: activeSchoolName,
      schoolAddress: activeSchool?.address,
      institutionCode: activeSchool?.institutionCode,
      academicYear: activeClass?.academicYear,
      className: activeClass?.name,
      isStaffCard,
      student,
      studio: {
        companyName: company.companyName, ownerName: company.ownerName,
        phone: company.phone, address: company.address,
      },
      backNote: albumConfig.pvcBackNote,
    }),
    [activeSchoolName, activeSchool?.address, activeSchool?.institutionCode, activeClass?.academicYear, activeClass?.name, isStaffCard, company, albumConfig.pvcBackNote],
  );

  const openEditorTab = useCallback(() => {
    setRailTab('editor');
    if (viewMode === 'both' || viewMode === 'class-grid') setViewMode('front');
  }, [viewMode]);

  const selectedEl = ctrl.activeElements.find((e) => e.id === selectedElementId) ?? null;

  return (
    <div className={`tc-workspace pvc-studio-workspace ${isEditorOpen ? 'is-pro-editor' : ''}`.trim()}>
      <aside className="tc-rail pvc-rail" aria-label="PVC kimlik kartı denetçisi" tabIndex={0}>
        <AppleGlassSegment
          ariaLabel="PVC tasarım sekmesi"
          fullWidth
          compact
          activeId={railTab}
          items={[
            { id: 'templates', label: '5 Şablon', iconHint: 'Şablon' },
            { id: 'editor', label: 'Tasarla', iconHint: 'Düzenle' },
            { id: 'studio', label: 'Stüdyo', iconHint: 'Stüdyo düzenle' },
          ]}
          onChange={(id) => {
            const next = id as RailTab;
            const prevIdx = RAIL_TAB_ORDER.indexOf(railTab);
            const nextIdx = RAIL_TAB_ORDER.indexOf(next);
            if (prevIdx !== nextIdx) setRailDir(nextIdx > prevIdx ? 1 : -1);
            setRailTab(next);
            if (next === 'editor' && (viewMode === 'both' || viewMode === 'class-grid')) setViewMode('front');
          }}
        />

        <AppleCrossfadeSlot activeKey={railTab} direction={railDir} variant="page">
          {railTab === 'templates' ? (
            <PvcTemplateGalleryPanel
              albumConfig={albumConfig}
              activeDesign={ctrl.activeDesign}
              customDesigns={ctrl.customDesigns}
              activePalette={palette}
              activeInk={activeInk}
              onPatchConfig={ctrl.commitAlbumPatch}
              onLivePreview={ctrl.setLivePreview}
              onChangeCardRadius={(cardRadiusMm) => {
                if (ctrl.activeDesign.isCustom) {
                  ctrl.mutateActiveDesign((prev) => ({ ...prev, cardRadiusMm, updatedAt: new Date().toISOString() }));
                } else {
                  ctrl.commitAlbumPatch({ pvcCardRadiusMm: cardRadiusMm });
                }
              }}
              onChangeCardSize={ctrl.changeCardSize}
              onChangeViewMode={(mode) => { setViewMode(mode); setSelectedElementId(null); }}
              onOpenNewSheet={(e, baseId) => {
                setRenameTarget(null);
                setSheetBaseId(baseId ?? 'blank');
                designSheet.openFrom('pvc-new-design', e.currentTarget);
              }}
              onOpenRenameSheet={(e, target) => {
                setRenameTarget(target);
                designSheet.openFrom(`pvc-rename-${target.id}`, e.currentTarget);
              }}
              onCloneActiveToCustom={() => {
                if (ctrl.createCustom(cloneDesignToCustom(ctrl.activeDesign, `${ctrl.activeDesign.name} (Özel)`))) openEditorTab();
              }}
              onQuickUploadBgToCustom={(dataUrl) => {
                ctrl.mutateActiveDesign((prev) => ({
                  ...prev,
                  updatedAt: new Date().toISOString(),
                  [activeSide]: { ...(activeSide === 'back' ? prev.back : prev.front), backgroundDataUrl: dataUrl, backgroundFit: 'cover', backgroundOpacity: 1 },
                }));
                openEditorTab();
              }}
              onDeleteCustomDesign={ctrl.deleteCustomDesign}
              onSwitchToEditor={openEditorTab}
            />
          ) : railTab === 'studio' ? (
            <PvcStudioBrandPanel
              showStudioInfo={albumConfig.pvcShowStudioInfo ?? true}
              onToggleShowStudioInfo={(pvcShowStudioInfo) => ctrl.commitAlbumPatch({ pvcShowStudioInfo })}
              onPreviewBackSide={() => setViewMode('back')}
            />
          ) : (
            <PvcToolboxPanel
              elements={ctrl.activeElements}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onAddTool={(p) => ctrl.addToolToActiveSide(p)}
              onAddCustomImage={(url) => ctrl.addToolToActiveSide({ kind: 'image' }, undefined, undefined, url)}
              onToggleVisibility={(id) => {
                const target = ctrl.activeElements.find((e) => e.id === id);
                if (target) ctrl.patchElementById(id, { visible: target.visible === false });
              }}
              onDeleteElement={(id) => ctrl.handleQuickAction(id, 'delete')}
            />
          )}
        </AppleCrossfadeSlot>
      </aside>

      <PvcCardStageArea
        design={ctrl.activeDesign}
        designWithDraft={designWithDraft}
        palette={palette}
        viewMode={viewMode}
        activeSide={activeSide}
        showSafeGuides={showSafeGuides}
        canDragEdit={canDragEdit}
        canUndo={ctrl.canUndo}
        canRedo={ctrl.canRedo}
        zoom={zoom}
        classId={activeClass?.id ?? 'none'}
        classStudents={classStudents}
        activeStudentIndex={activeStudentIndex}
        activeStudent={activeStudent}
        activePhoto={activePhoto}
        photoMap={photoMap}
        logoUrl={logoUrl}
        studioLogoUrl={studioLogoUrl}
        principalSigUrl={principalSigUrl}
        deputySigUrl={deputySigUrl}
        printFontPt={albumConfig.printFontPt}
        cardRef={cardRef}
        interactive={
          canDragEdit
            ? {
                selectedElementId,
                snapGuideXMm: drag.snapGuideXMm,
                snapGuideYMm: drag.snapGuideYMm,
                onSelectElement: setSelectedElementId,
                onStartMove: drag.onStartMove,
                onStartResize: drag.onStartResize,
                onStartRotate: drag.onStartRotate,
                onInlineTextChange: (elId, text) => ctrl.patchElementById(elId, { text }),
                onQuickAction: ctrl.handleQuickAction,
                onDropPaletteItem: (raw, xMm, yMm) => {
                  try { ctrl.addToolToActiveSide(JSON.parse(raw) as PvcPaletteToolPayload, xMm, yMm); } catch { /* ignore */ }
                },
              }
            : undefined
        }
        makeDataContext={makeDataContext}
        onChangeViewMode={(mode) => { setViewMode(mode); setSelectedElementId(null); }}
        onToggleSafeGuides={() => setShowSafeGuides((v) => !v)}
        onChangeZoom={setZoom}
        onSelectStudentId={setSelectedStudentId}
        onSwitchToEditor={openEditorTab}
        onUndo={ctrl.handleUndo}
        onRedo={ctrl.handleRedo}
      />

      {isEditorOpen && (
        <aside className="tc-rail pvc-right-inspector" aria-label="Kart yüzeyi ve seçili öğe özellikleri" tabIndex={0}>
          <AppleCrossfadeSlot activeKey={selectedEl ? `el-${selectedEl.id}` : 'surface'} variant="card">
            {selectedEl ? (
              <PvcSelectedElementInspector
                element={selectedEl}
                cardWidthMm={ctrl.activeDesign.widthMm}
                cardHeightMm={ctrl.activeDesign.heightMm}
                onLivePatch={(patch) => ctrl.setLivePreview({ elementPatch: { id: selectedEl.id, patch } })}
                onChange={(patch) => ctrl.patchElementById(selectedEl.id, patch)}
                onDuplicate={() => ctrl.handleQuickAction(selectedEl.id, 'duplicate')}
                onDelete={() => ctrl.handleQuickAction(selectedEl.id, 'delete')}
                onReorder={(dir) => ctrl.handleQuickAction(selectedEl.id, dir)}
              />
            ) : (
              <PvcCardSurfacePanel
                design={ctrl.activeDesign}
                activeSide={activeSide}
                onLiveCardRadius={(cardRadiusMm) => ctrl.setLivePreview({ cardRadiusMm })}
                onLivePatchSide={(sidePatch) => ctrl.setLivePreview({ sidePatch })}
                onChangeOrientation={(orientation) => {
                  const next = pvcCardDimensions(orientation);
                  ctrl.changeCardSize(next.widthMm, next.heightMm);
                }}
                onChangeCardSize={ctrl.changeCardSize}
                onChangeCardRadius={(cardRadiusMm) =>
                  ctrl.mutateActiveDesign((prev) => ({ ...prev, cardRadiusMm, updatedAt: new Date().toISOString() }))
                }
                onPatchSide={(patch) =>
                  ctrl.mutateActiveDesign((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    [activeSide]: { ...(activeSide === 'back' ? prev.back : prev.front), ...patch },
                  }))
                }
              />
            )}
          </AppleCrossfadeSlot>
        </aside>
      )}

      <NewPvcDesignSheet
        controller={designSheet}
        renameTarget={renameTarget}
        defaultBaseId={sheetBaseId}
        onCreate={(d) => { if (ctrl.createCustom(d)) openEditorTab(); }}
        onRename={(id, nextName) => {
          ctrl.commitAlbumPatch({
            pvcCustomDesigns: ctrl.customDesigns.map((d) =>
              d.id === id ? { ...d, name: nextName, updatedAt: new Date().toISOString() } : d,
            ),
          });
          notifyStudio('Tasarım adı güncellendi.', 'success');
        }}
      />
    </div>
  );
});
