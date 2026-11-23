import React, { useMemo } from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import { schoolNameFor, useSelectSchoolMutation } from '../../system/query/useSchoolQueries';
import {
  useApproveBranchForPrintMutation,
  useStudioSnapshotQuery,
  useUpdateAlbumConfigMutation,
} from '../../system/query/useStudioQueries';
import { sortClassRecords } from '../../system/sqlite/classOrder';
import { isStaffBranch } from '../../system/sqlite/rosterImportActions';
import type { AlbumLayoutKind, AlbumTemplateConfig, ClassRecord } from '../../system/sqlite/types';
import { useResolvedSchoolAssetUrl } from '../../system/storage/useSchoolAssetUrl';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { PrintCenterHandoff } from '../../window-system/types';
import {
  resolveAlbumPrintTargetClassId,
  resolveAlbumTelemetryScope,
} from './albumScopeHelper';
import { PvcCardWorkspace } from './pvc-cards/PvcCardWorkspace';
import { TeacherChartsWorkspace } from './teacher-charts/TeacherChartsWorkspace';
import { useAlbumViewSelection } from './useAlbumViewSelection';
import { useDebouncedTextField } from './useDebouncedTextField';
import { YearbookKutukWorkspace } from './yearbook-kutuk/YearbookKutukWorkspace';
import './album-designer.css';
import './album-workspace.css';

/**
 * İZOLE MODÜL 03: Canlı Albüm, Sınıf Çizelgesi ve Kimlik Tasarımı
 * Sekme ve şube seçimi anında tepki verir; ağır sahne arka planda hazırlanıp yumuşak geçişle açılır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const AlbumDesignerWindow: React.FC<{
  onApproveForPrint?: (payload: Omit<PrintCenterHandoff, 'seq'>) => void;
}> = React.memo(({ onApproveForPrint }) => {
  const { data: db } = useStudioSnapshotQuery();
  const updateConfigMut = useUpdateAlbumConfigMutation();
  const approveBranchMut = useApproveBranchForPrintMutation();
  const selectSchoolMut = useSelectSchoolMutation();
  const view = useAlbumViewSelection(db.albumConfig);

  const activeSchool =
    db.schools.find((s) => s.id === db.activeSchoolId) ?? db.schools[0] ?? null;
  const scopedClasses = useMemo(
    () => sortClassRecords(activeSchool ? db.classes.filter((c) => c.schoolId === activeSchool.id) : db.classes),
    [activeSchool, db.classes],
  );
  const findClass = (id: string): ClassRecord | undefined =>
    scopedClasses.find((c) => c.id === id) ?? scopedClasses[0];
  // Üst şerit (seçici + telemetri) anında; çalışma sahnesi ertelenmiş değerle güncellenir.
  const activeClass = findClass(view.selectedClassId);
  const contentClass = findClass(view.contentClassId);
  const albumConfig = useMemo<AlbumTemplateConfig>(
    () => ({ ...db.albumConfig, layoutKind: view.layoutKind, selectedClassId: activeClass?.id ?? db.albumConfig.selectedClassId }),
    [db.albumConfig, view.layoutKind, activeClass?.id],
  );
  const contentConfig = useMemo<AlbumTemplateConfig>(
    () => ({ ...db.albumConfig, layoutKind: view.contentLayout, selectedClassId: contentClass?.id ?? db.albumConfig.selectedClassId }),
    [db.albumConfig, view.contentLayout, contentClass?.id],
  );
  const activeSchoolName = activeSchool?.name || schoolNameFor(db, activeClass?.schoolId) || 'OKUL ADI';
  const classStudents = useMemo(
    () => db.students.filter((s) => s.classId === activeClass?.id && s.showInAlbum !== false),
    [db.students, activeClass?.id],
  );
  const contentClassStudents = useMemo(
    () => db.students.filter((s) => s.classId === contentClass?.id && s.showInAlbum !== false),
    [db.students, contentClass?.id],
  );
  const allSchoolStudents = useMemo(() => {
    const validIds = new Set(scopedClasses.map((c) => c.id));
    return db.students.filter((s) => validIds.has(s.classId) && s.showInAlbum !== false);
  }, [db.students, scopedClasses]);
  const photoMap = useMemo(() => new Map(db.photos.map((p) => [p.id, p])), [db.photos]);
  const schoolOptions = useMemo(
    () => db.schools.map((school) => ({ value: school.id, label: school.name, iconHint: 'Okul' })),
    [db.schools],
  );
  const classOptions = useMemo(
    () =>
      scopedClasses.map((cls) => {
        const cleanTeacher = cls.teacherName.trim();
        return {
          value: cls.id,
          label: cleanTeacher ? `${cls.name} · ${cleanTeacher}` : cls.name,
          iconHint: 'Şube',
        };
      }),
    [scopedClasses],
  );

  const isStaffCard = isStaffBranch(contentClass?.name ?? '');

  const logoUrl = useResolvedSchoolAssetUrl(activeSchool?.logoDataUrl, 'original');
  const watermarkOpacity = (activeSchool?.transparentLogoOpacity ?? 35) / 100;
  const principalSigUrl = useResolvedSchoolAssetUrl(activeSchool?.principalSignatureDataUrl, 'original');
  const deputySigUrl = useResolvedSchoolAssetUrl(activeSchool?.deputySignatureDataUrl, 'original');
  const coverUrl = useResolvedSchoolAssetUrl(activeSchool?.schoolPhotoDataUrl, 'original');
  const coverZoom = activeSchool?.schoolPhotoZoom ?? 1;

  const patchConfig = (patch: Partial<AlbumTemplateConfig>) =>
    updateConfigMut.mutate(patch, {
      onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
    });

  const handleApproveAndOpenPrint = () => {
    if (!activeSchool || !activeClass) return;
    const targetClassId = resolveAlbumPrintTargetClassId({
      albumConfig,
      scopedClasses,
      activeClass,
      allSchoolStudents,
    });

    approveBranchMut.mutate(
      { schoolId: activeSchool.id, classId: targetClassId },
      {
        onSuccess: (approvedCount) => {
          notifyStudio(
            approvedCount > 0
              ? `${approvedCount} eşleşen kayıt baskıya onaylandı; Baskı Merkezi açılıyor.`
              : 'Seçili tasarım Baskı Merkezine aktarıldı.',
            'success',
          );
          onApproveForPrint?.({
            classId: targetClassId,
            layoutKind: albumConfig.layoutKind,
          });
        },
        onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
      },
    );
  };

  const telemetryScope = useMemo(
    () =>
      resolveAlbumTelemetryScope({
        albumConfig,
        scopedClasses,
        activeClass,
        classStudents,
        allSchoolStudents,
      }),
    [albumConfig, scopedClasses, activeClass, classStudents, allSchoolStudents],
  );

  const readyInScope = useMemo(
    () => telemetryScope.students.filter((s) => s.printReady).length,
    [telemetryScope.students],
  );
  const readyPct =
    telemetryScope.students.length > 0
      ? Math.round((readyInScope / telemetryScope.students.length) * 100)
      : 0;
  const isAllReady =
    telemetryScope.students.length > 0 && readyInScope === telemetryScope.students.length;
  const headerTitleField = useDebouncedTextField(albumConfig.headerTitle, (headerTitle) =>
    patchConfig({ headerTitle }),
  );
  const schoolKey = activeSchool?.id ?? 'none';

  return (
    <div className="mod-pane mod-album-pane">
      <div className="mod-header">
        <div>
          <span className="mod-eyebrow">STÜDYO MİZANPAJ MASASI · YILLIK ALBÜM &amp; PVC KİMLİK</span>
          <h3>Sınıf Çizelgesi, Yıllık Sayfası ve Kimlik Tasarımı</h3>
        </div>
      </div>

      {!activeClass && (
        <p className="mod-empty-banner">
          Önce Sınıf Listesi penceresinden kendi okul ve sınıfınızı ekleyin.
        </p>
      )}

      <section className="mod-command-deck" aria-label="Albüm ve mizanpaj komut şeridi">
        <div className="mod-deck-controls mod-album-deck-bar">
          <div className="mod-album-deck-primary">
            {schoolOptions.length > 0 && (
              <AppleSelect
                ariaLabel="Tasarım okulu seç"
                inline
                value={activeSchool?.id ?? ''}
                placeholder="Okul seçin"
                options={schoolOptions}
                onChange={(schoolId) => {
                  if (!schoolId || schoolId === activeSchool?.id) return;
                  selectSchoolMut.mutate(schoolId, {
                    onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
                  });
                }}
              />
            )}

            <AppleSelect
              ariaLabel="Tasarım şubesi seç"
              inline
              value={activeClass?.id ?? ''}
              placeholder="Şube seçin"
              options={classOptions}
              onChange={view.selectClass}
            />

            <span className="mod-album-deck-divider" aria-hidden="true" />

            <AppleGlassSegment
              ariaLabel="Albüm ve kimlik şablonu"
              compact
              hideArrows
              activeId={view.layoutKind}
              onChange={(id) => view.selectLayout(id as AlbumLayoutKind)}
              items={[
                { id: 'class-chart', label: 'Sınıf Çizelgesi', iconHint: 'Şube' },
                { id: 'yearbook-spread', label: 'Yıllık & Kütük', iconHint: 'Görsel' },
                { id: 'id-card', label: 'PVC Kimlik Kartı', iconHint: 'Öğrenci' },
              ]}
            />
          </div>

          {view.layoutKind !== 'id-card' ? (
            <div className="mod-album-deck-meta">
              <input
                type="text"
                className="mod-input mod-album-title-input"
                maxLength={120}
                value={headerTitleField.value}
                onChange={(e) => headerTitleField.onChange(e.target.value)}
                onBlur={headerTitleField.onBlur}
                placeholder="Albüm / Çizelge Başlığı"
              />

              <label className="mod-check-label mod-album-num-toggle">
                <input
                  type="checkbox"
                  checked={albumConfig.showStudentNumbers}
                  onChange={(e) => patchConfig({ showStudentNumbers: e.target.checked })}
                />
                Okul No
              </label>
            </div>
          ) : (
            <span className="mod-album-deck-spacer" aria-hidden="true" />
          )}

          <button
            type="button"
            className="mod-approve-print-btn"
            disabled={!activeSchool || !activeClass || approveBranchMut.isPending}
            onClick={handleApproveAndOpenPrint}
          >
            <SheetAutoIcon text="Onay" size={13} />
            Baskıya Onayla &amp; Baskıda Aç
          </button>
        </div>

        <div className="mod-deck-telemetry">
          <div className="mod-telemetry-group">
            <span className="mod-telemetry-item">
              <SheetAutoIcon text="Şube" size={12.5} />
              <strong>{telemetryScope.label}</strong>
            </span>
            <span className="mod-telemetry-sep" aria-hidden="true">·</span>
            <span className="mod-telemetry-item">
              <SheetAutoIcon text="Öğrenci" size={12.5} />
              <strong>{telemetryScope.students.length} Kayıt Dizgide</strong>
            </span>
            {activeClass?.academicYear && (
              <>
                <span className="mod-telemetry-sep" aria-hidden="true">·</span>
                <span className="mod-telemetry-muted">{activeSchoolName} · {activeClass.academicYear}</span>
              </>
            )}
          </div>

          <div className={`mod-approval-gauge ${isAllReady ? 'is-complete' : ''}`.trim()}>
            <SheetAutoIcon text="Onay" size={12.5} />
            <span className="mod-gauge-label">Baskı Onayı</span>
            <div className="mod-gauge-track" aria-hidden="true">
              <div className="mod-gauge-fill" style={{ width: `${readyPct}%` }} />
            </div>
            <strong className="mod-gauge-value">
              {readyInScope} / {telemetryScope.students.length} (%{readyPct})
            </strong>
          </div>
        </div>
      </section>

      <AppleCrossfadeSlot
        activeKey={
          view.contentLayout === 'yearbook-spread'
            ? `${schoolKey}::yearbook-spread`
            : `${schoolKey}::${contentClass?.id ?? 'none'}::${view.contentLayout}`
        }
        direction={view.layoutDir}
        variant="page"
        className="mod-album-workspace"
      >
        {view.contentLayout === 'class-chart' ? (
          <TeacherChartsWorkspace
            albumConfig={contentConfig}
            activeSchoolName={activeSchoolName}
            activeClass={contentClass}
            allSchoolStudents={allSchoolStudents}
            classStudents={contentClassStudents}
            photoMap={photoMap}
            logoUrl={logoUrl}
            watermarkOpacity={watermarkOpacity}
            principalSigUrl={principalSigUrl}
            onPatchConfig={patchConfig}
          />
        ) : view.contentLayout === 'yearbook-spread' ? (
          <YearbookKutukWorkspace
            albumConfig={contentConfig}
            activeSchoolName={activeSchoolName}
            scopedClasses={scopedClasses}
            activeClass={contentClass}
            allSchoolStudents={allSchoolStudents}
            photoMap={photoMap}
            logoUrl={logoUrl}
            watermarkOpacity={watermarkOpacity}
            principalSigUrl={principalSigUrl}
            deputySigUrl={deputySigUrl}
            coverUrl={coverUrl}
            coverZoom={coverZoom}
            onPatchConfig={patchConfig}
          />
        ) : (
          <PvcCardWorkspace
            albumConfig={contentConfig}
            activeSchool={activeSchool}
            activeSchoolName={activeSchoolName}
            activeClass={contentClass}
            classStudents={contentClassStudents}
            photoMap={photoMap}
            isStaffCard={isStaffCard}
            logoUrl={logoUrl}
            principalSigUrl={principalSigUrl}
            deputySigUrl={deputySigUrl}
            onPatchConfig={patchConfig}
          />
        )}
      </AppleCrossfadeSlot>
    </div>
  );
});
