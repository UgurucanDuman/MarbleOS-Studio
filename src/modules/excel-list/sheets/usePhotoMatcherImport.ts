import { useState } from 'react';
import { pickStudioPhotoFolder } from '../../../system/desktop/desktopFolderPicker';
import { useUploadPhotosMutation } from '../../../system/query/useStudioQueries';
import type { PhotoMatchMode } from '../../../system/schemas/studioSchemas';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { photoImportNotice, preparePhotoSelection } from '../../../system/storage/photoImport';
import { usePhotoImport } from '../../../system/storage/usePhotoImport';
import { filterNewClassPhotoFiles } from '../classPhotoHelpers';
import { formErrorMessage } from './formHelpers';
import type { PendingFolderImport } from './PhotoFolderConfirmCard';

/**
 * İZOLE MODÜL 01 KANCASI: Sınıf Fotoğraf Klasörü Seçimi, Uygulama İçi Onay & Toplu Aktarım
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function usePhotoMatcherImport(options: {
  activeClass: ClassRecord;
  students: StudentRecord[];
  photos: PhotoRecord[];
  matchMode: PhotoMatchMode;
  activeStudent: StudentRecord | null;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
  onFallbackFolderInput: () => void;
}) {
  const { activeClass, students, photos, matchMode, activeStudent, onNotice, onError, onFallbackFolderInput } = options;
  const uploadPhotosMut = useUploadPhotosMutation();
  const { run: importPhotos, reading, progress } = usePhotoImport();
  const [pickingFolder, setPickingFolder] = useState(false);
  const [pendingFolder, setPendingFolder] = useState<PendingFolderImport | null>(null);

  const stageFolderForConfirm = (folderName: string, rawFiles: File[], fromWebkitFolder: boolean) => {
    const validated = preparePhotoSelection(rawFiles, fromWebkitFolder);
    const { freshFiles, skippedCount } = filterNewClassPhotoFiles(
      validated.photos.map((item) => item.file),
      activeClass.id,
      students,
      photos,
    );
    const totalBytes = freshFiles.reduce((sum, file) => sum + file.size, 0);
    setPendingFolder({ folderName, files: freshFiles, totalBytes, skippedCount });
  };

  const handlePickFolderClick = async () => {
    onError(null);
    setPickingFolder(true);
    try {
      const outcome = await pickStudioPhotoFolder();
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'fallback-input') {
        onFallbackFolderInput();
        return;
      }
      stageFolderForConfirm(outcome.folderName, outcome.files, false);
    } catch (err) {
      onError(formErrorMessage(err));
    } finally {
      setPickingFolder(false);
    }
  };

  const handleConfirmPendingFolder = async () => {
    if (!pendingFolder) return;
    onError(null);
    const current = pendingFolder;
    setPendingFolder(null);
    try {
      const result = await importPhotos(current.files, false, matchMode === 'sequence', (files) =>
        uploadPhotosMut.mutateAsync({ files, classId: activeClass.id, matchMode }),
      );
      const msg = current.skippedCount > 0
        ? `${photoImportNotice(result)} (${current.skippedCount} mevcut fotoğraf korundu.)`
        : photoImportNotice(result);
      onNotice(msg);
    } catch (err) {
      onError(formErrorMessage(err));
    }
  };

  const handleBatchSelect = async (e: React.ChangeEvent<HTMLInputElement>, folder = false) => {
    const fileList = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!fileList.length) return;
    onError(null);
    try {
      if (folder) {
        const rel = fileList[0]?.webkitRelativePath ?? '';
        stageFolderForConfirm(rel.split('/')[0]?.trim() || activeClass.name, fileList, true);
        return;
      }
      const { freshFiles, skippedCount } = filterNewClassPhotoFiles(fileList, activeClass.id, students, photos);
      const result = await importPhotos(freshFiles, false, matchMode === 'sequence', (files) =>
        uploadPhotosMut.mutateAsync({ files, classId: activeClass.id, matchMode }),
      );
      const msg = skippedCount > 0 ? `${photoImportNotice(result)} (${skippedCount} mevcut fotoğraf korundu.)` : photoImportNotice(result);
      onNotice(msg);
    } catch (err) {
      onError(formErrorMessage(err));
    }
  };

  const handleSingleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!fileList.length || !activeStudent) return;
    onError(null);
    try {
      await importPhotos(fileList, false, false, (files) =>
        uploadPhotosMut.mutateAsync({ files, classId: activeClass.id, targetStudentId: activeStudent.id }),
      );
    } catch (err) {
      onError(formErrorMessage(err));
    }
  };

  return {
    busy: pickingFolder || reading || uploadPhotosMut.isPending,
    importing: reading || uploadPhotosMut.isPending,
    progress,
    pendingFolder,
    clearPendingFolder: () => setPendingFolder(null),
    handlePickFolderClick,
    handleConfirmPendingFolder,
    handleBatchSelect,
    handleSingleSelect,
  };
}
