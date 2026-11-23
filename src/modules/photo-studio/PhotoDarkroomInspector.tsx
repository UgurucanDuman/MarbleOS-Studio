import React, { useMemo } from 'react';
import type { ClassRecord, PhotoAdjustments, PhotoRecord, StudentRecord } from '../../system/sqlite/types';
import { GpuPhotoPreview } from '../../system/storage/GpuPhotoPreview';
import { DEFAULT_PHOTO_ADJUSTMENTS, isDefaultAdjustments } from '../../system/storage/photoColorMath';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { PhotoDarkroomSliders } from './PhotoDarkroomSliders';
import './photo-darkroom-controls.css';

/**
 * İZOLE MODÜL 02 ALT BİLEŞENİ: Duyarlı Apple Pro Karanlık Oda Denetçisi (Normal & Büyük Sahne)
 * Tek kalıcı WebGL bağlamı kullanır; kare geçişlerinde yeni WebGL context veya shader derlemesi üretmez.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoDarkroomInspector: React.FC<{
  photo: PhotoRecord;
  adjustments: PhotoAdjustments;
  matchedStudent?: StudentRecord;
  scopedClasses: ClassRecord[];
  assignableStudents: StudentRecord[];
  isApproved: boolean;
  showGuide: boolean;
  compareOriginal: boolean;
  expandedStage: boolean;
  checkedCount: number;
  scopeCount: number;
  batchBusy: boolean;
  canAdvanceNext: boolean;
  onToggleGuide: () => void;
  onToggleCompare: () => void;
  onToggleExpand: () => void;
  onAssignStudent: (studentId: string | null) => void;
  onPatchAdjustments: (patch: Partial<PhotoAdjustments>, immediate?: boolean) => void;
  onFlushAdjustments: () => void;
  onApplyBatch: (target: 'checked' | 'scope', copyFraming: boolean) => void;
  onResetBatch: (target: 'checked' | 'scope') => void;
  onToggleApproval: () => void;
  onApproveAndNext: () => void;
}> = React.memo(({
  photo,
  adjustments,
  matchedStudent,
  scopedClasses,
  assignableStudents,
  isApproved,
  showGuide,
  compareOriginal,
  expandedStage,
  checkedCount,
  scopeCount,
  batchBusy,
  canAdvanceNext,
  onToggleGuide,
  onToggleCompare,
  onToggleExpand,
  onAssignStudent,
  onPatchAdjustments,
  onFlushAdjustments,
  onApplyBatch,
  onResetBatch,
  onToggleApproval,
  onApproveAndNext,
}) => {
  const isDefault = isDefaultAdjustments(adjustments);
  const studentTitle = matchedStudent
    ? matchedStudent.studentNumber === '0' || matchedStudent.studentNumber.startsWith('0-')
      ? `${matchedStudent.firstName} ${matchedStudent.lastName}`
      : `${matchedStudent.studentNumber} ${matchedStudent.firstName} ${matchedStudent.lastName}`
    : 'Eşleşmeyen Portre';

  const studentOptions = useMemo(() => {
    const classMap = new Map(scopedClasses.map((c) => [c.id, c]));
    return [
      { value: '', label: '— Öğrenci Seçin —' },
      ...assignableStudents.map((stu) => {
        const cls = classMap.get(stu.classId);
        const noPrefix =
          stu.studentNumber === '0' || stu.studentNumber.startsWith('0-') ? '' : `${stu.studentNumber} `;
        return {
          value: stu.id,
          label: `[${cls?.name ?? 'Şube'}] ${noPrefix}${stu.firstName} ${stu.lastName}`,
          iconHint: 'Öğrenci',
        };
      }),
    ];
  }, [assignableStudents, scopedClasses]);

  return (
    <aside className="mod-inspector-card ps-inspector" aria-label="Karanlık oda denetçisi">
      <div className="ps-inspector-head">
        <div className="ps-inspector-id">
          <strong>{studentTitle}</strong>
          <small>{photo.fileName} · %{Math.round(adjustments.zoom * 100)}</small>
        </div>
        <div className="ps-stage-toggles">
          <button
            type="button"
            className={`ps-stage-pill ${expandedStage ? 'is-on' : ''}`}
            aria-pressed={expandedStage}
            title="Portre çalışma sahnesini büyüt / normal boyuta al (fotoğrafa çift tıklayabilirsiniz)"
            onClick={onToggleExpand}
          >
            {expandedStage ? 'Küçült' : 'Büyüt'}
          </button>
          <button
            type="button"
            className={`ps-stage-pill ${showGuide ? 'is-on' : ''}`}
            aria-pressed={showGuide}
            title="50×60 / 45×60 mm biyometrik kafa-çene hiza kılavuzu"
            onClick={onToggleGuide}
          >
            Kılavuz
          </button>
          <button
            type="button"
            className={`ps-stage-pill ${compareOriginal ? 'is-on' : ''}`}
            aria-pressed={compareOriginal}
            title="Orijinal kare ile karşılaştır (\ tuşu)"
            onClick={onToggleCompare}
          >
            Önce/Sonra
          </button>
          <button
            type="button"
            className="ps-stage-pill"
            disabled={isDefault}
            title="Yalnızca bu karenin ışık ve kadraj ayarlarını sıfırla"
            onClick={() => onPatchAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS }, true)}
          >
            Sıfırla
          </button>
          {scopeCount > 1 && (
            <button
              type="button"
              className="ps-stage-pill"
              disabled={batchBusy}
              title={
                checkedCount > 0
                  ? `Seçili ${checkedCount} kareyi orijinal boyut ve ışığa döndür`
                  : `Listedeki tüm ${scopeCount} kareyi orijinal boyut ve ışığa döndür`
              }
              onClick={() => onResetBatch(checkedCount > 0 ? 'checked' : 'scope')}
            >
              {checkedCount > 0 ? `Orijinale Dön (${checkedCount})` : 'Tümünü Orijinale Dön'}
            </button>
          )}
        </div>
      </div>

      <div className="ps-inspector-body">
        <div className="ps-stage-col">
          <div className={`ps-stage-well ${expandedStage ? 'is-expanded' : ''}`.trim()}>
            <div className={`mod-inspector-preview ps-portrait-frame ${expandedStage ? 'is-expanded' : ''}`.trim()}>
              <GpuPhotoPreview
                photo={photo}
                adjustments={adjustments}
                alt={photo.fileName}
                showGuide={showGuide}
                compareOriginal={compareOriginal}
                onDoubleClickStage={onToggleExpand}
                onInteractiveFrame={(patch, commitNow) => {
                  if (Object.keys(patch).length > 0) {
                    onPatchAdjustments(patch, Boolean(commitNow));
                  } else if (commitNow) {
                    onFlushAdjustments();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="ps-inspector-controls">
          <label className="mod-field-label">
            Eşleşen Öğrenci Kaydı
            <AppleSelect
              ariaLabel="Eşleşen Öğrenci Kaydı"
              value={photo.studentId ?? ''}
              placeholder="— Öğrenci Seçin —"
              options={studentOptions}
              onChange={(val) => onAssignStudent(val ? val : null)}
            />
          </label>

          <PhotoDarkroomSliders
            adjustments={adjustments}
            checkedCount={checkedCount}
            scopeCount={scopeCount}
            batchBusy={batchBusy}
            onPatch={onPatchAdjustments}
            onFlush={onFlushAdjustments}
            onApplyBatch={onApplyBatch}
            onResetBatch={onResetBatch}
          />
        </div>
      </div>

      <div className="ps-approve-row">
        <button
          type="button"
          onClick={onToggleApproval}
          className={isApproved ? 'mod-approve-btn approved' : 'mod-approve-btn'}
        >
          <SheetAutoIcon text={isApproved ? 'Onay' : 'Görsel'} size={13} />
          <span>{isApproved ? '✓ Kullanıcı Onaylı' : 'Fotoğrafı Kontrol Ettim'}</span>
        </button>
        <button
          type="button"
          className="mod-action-btn ps-approve-next-btn"
          disabled={!canAdvanceNext && isApproved}
          onClick={onApproveAndNext}
          title="Bu fotoğrafı onayla ve listedeki sıradaki kareye geç"
        >
          <span>Onayla &amp; Sonraki</span>
        </button>
      </div>
    </aside>
  );
});
