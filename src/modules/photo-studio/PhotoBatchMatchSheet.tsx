import { useMemo, useState } from 'react';
import { useApplyClassPhotoMatchesMutation } from '../../system/query/usePhotoManagementQueries';
import { photoBatchMatchModeSchema, type PhotoBatchMatchMode } from '../../system/schemas/photoManagementSchemas';
import { planClassPhotoMatches } from '../../system/sqlite/classPhotoMatching';
import type { ClassRecord, StudioDatabaseSnapshot } from '../../system/sqlite/types';
import { StudioPhotoImage } from '../../system/storage/StudioPhotoImage';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { OriginSheet } from '../../window-system/sheet/OriginSheet';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';

export function PhotoBatchMatchSheet({ controller, db, selectedClass, onNotice }: {
  controller: OriginSheetController;
  db: StudioDatabaseSnapshot;
  selectedClass: ClassRecord;
  onNotice: (message: string) => void;
}) {
  const [mode, setMode] = useState<PhotoBatchMatchMode>('smart');
  const [error, setError] = useState<string | null>(null);
  const mutation = useApplyClassPhotoMatchesMutation();
  const classId = selectedClass.id;
  const openKey = controller.isOpen ? classId : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setMode('smart');
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const preview = useMemo(() => {
    if (!controller.isOpen) return null;
    const plan = planClassPhotoMatches(db, classId, mode);
    const photos = new Map(db.photos.map((photo) => [photo.id, photo]));
    const students = new Map(db.students.map((student) => [student.id, student]));
    return {
      ...plan,
      rows: plan.pairs.map(({ studentId, photoId }) => ({
        student: students.get(studentId)!,
        photo: photos.get(photoId)!,
      })),
    };
  }, [controller.isOpen, db, classId, mode]);

  const submit = async () => {
    if (!preview?.pairs.length) return;
    try {
      const count = await mutation.mutateAsync({ classId, mode, pairs: preview.pairs });
      onNotice(`${count} fotoğraf ${selectedClass.name} sınıfıyla eşleştirildi.`);
      controller.close();
    } catch (cause) {
      setError(formErrorMessage(cause));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Otomatik Eşleştir"
      description={`${selectedClass.name} · ${selectedClass.academicYear}`}
      width={660}
      submitLabel={preview?.pairs.length ? `${preview.pairs.length} Fotoğrafı Eşleştir` : 'Fotoğrafları Eşleştir'}
      busy={mutation.isPending}
      canSubmit={Boolean(preview?.pairs.length)}
      error={error}
      onSubmit={() => void submit()}
    >
      <label className="mod-field-label">
        Eşleştirme yöntemi
        <AppleSelect
          ariaLabel="Eşleştirme yöntemi" value={mode} disabled={mutation.isPending}
          options={[
            { value: 'smart', label: 'Okul numarası / tam ad', iconHint: 'Fotoğraf' },
            { value: 'sequence', label: 'Çekim sırası', iconHint: 'Sıra' },
          ]}
          onChange={(val) => { setMode(photoBatchMatchModeSchema.parse(val)); setError(null); }}
        />
      </label>
      <p>
        {mode === 'sequence'
          ? 'Fotoğraf dosyaları numaraya göre sıralanır ve sınıf listesindeki mevcut sırayla karşılaştırılır. Çekimin bu sırada yapıldığını doğrulayın.'
          : 'Dosya adında okul numarası veya tam ad aranır. Kamera numaralı dosyalar için Çekim sırası seçilebilir.'}
      </p>
      {preview?.rows.length ? (
        <div className="mod-table-wrap studio-match-preview">
          <table className="mod-table">
            <caption>{preview.rows.length} yeni eşleşme · Mevcut bağlantılar korunur</caption>
            <thead><tr><th>Okul no</th><th>Ad</th><th>Soyad</th><th>Fotoğraf</th></tr></thead>
            <tbody>
              {preview.rows.map(({ student, photo }) => (
                <tr key={photo.id}>
                  <td>{student.studentNumber}</td><td>{student.firstName}</td><td>{student.lastName}</td>
                  <td><div className="mod-student-cell">
                    <StudioPhotoImage photo={photo} loading="lazy" decoding="async" className="mod-mini-thumb" alt="" />
                    {photo.fileName}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p role="status">{preview?.blocked ?? 'Bu yöntemle yeni eşleşme bulunamadı.'}</p>}
    </OriginSheet>
  );
}
