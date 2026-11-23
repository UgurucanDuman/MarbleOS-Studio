import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWindowWorkEnabled } from '../../../system/motion/windowWork';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { loadOriginalPhotoDataUrl } from '../../../system/storage/portraitPrintRenderer';
import {
  photoAdjustmentStyle,
  useResolvedPhotoPreviewUrl,
} from '../../../system/storage/StudioPhotoImage';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { isTeacherClassName } from './formHelpers';
import '../excel-portrait-preview.css';

const PREVIEW_MODES: ReadonlyArray<{ id: 'frame' | 'contain'; label: string; iconHint: string }> = [
  { id: 'frame', label: '3:4 Baskı Kadrajı', iconHint: 'Kadraj' },
  { id: 'contain', label: 'Tam Kare', iconHint: 'Görsel' },
];

function PortraitPreviewContent({ photo, student }: { photo: PhotoRecord; student: StudentRecord }) {
  const [viewMode, setViewMode] = useState<'frame' | 'contain'>('frame');
  const [settledForHiRes, setSettledForHiRes] = useState(false);
  const preview = useResolvedPhotoPreviewUrl(photo, true);
  const workEnabled = useWindowWorkEnabled();

  useEffect(() => {
    setViewMode('frame');
    setSettledForHiRes(false);
    const timer = window.setTimeout(() => setSettledForHiRes(true), 360);
    return () => window.clearTimeout(timer);
  }, [photo.id]);

  const originalQuery = useQuery({
    queryKey: ['studio-photo-original-url', photo.id, photo.contentHash ?? ''],
    queryFn: () => loadOriginalPhotoDataUrl(photo),
    enabled: workEnabled && settledForHiRes,
    subscribed: workEnabled && settledForHiRes,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const resolvedSrc = (settledForHiRes && originalQuery.data) || preview.src;
  const fullName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <div className="xl-portrait-preview-body">
      <div className="xl-portrait-preview-toolbar">
        <AppleGlassSegment
          ariaLabel="Önizleme modu"
          compact
          items={PREVIEW_MODES}
          activeId={viewMode}
          onChange={(id) => setViewMode(id === 'contain' ? 'contain' : 'frame')}
        />
      </div>

      <div className={`xl-portrait-preview-stage ${viewMode === 'contain' ? 'is-contain' : ''}`}>
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={fullName}
            className="xl-portrait-preview-img"
            style={viewMode === 'frame' ? photoAdjustmentStyle(photo.adjustments, true) : undefined}
          />
        ) : (
          <span className="xl-portrait-preview-fallback">
            {preview.isError && originalQuery.isError ? 'Fotoğraf yüklenemedi' : 'Fotoğraf hazırlanıyor…'}
          </span>
        )}
      </div>

      <div className="xl-portrait-preview-meta">
        <span className="xl-portrait-preview-file" title={photo.fileName}>
          {photo.fileName}
        </span>
        <span className={`xl-portrait-preview-status ${student.printReady ? 'is-ready' : ''}`}>
          {student.printReady ? 'Baskıya Onaylı' : 'Kadraj Bekliyor'}
        </span>
      </div>
    </div>
  );
}

/** Sağ denetçideki portreden aynı Apple OriginSheet animasyonuyla açılan tam çözünürlüklü önizleme kartı. */
export const PortraitPreviewSheet: React.FC<{
  controller: OriginSheetController;
  activeClass: ClassRecord | undefined;
  student: StudentRecord | null;
  photo: PhotoRecord | undefined;
  onEditPhotos?: (classId: string, photoId?: string) => void;
}> = ({ controller, activeClass, student, photo, onEditPhotos }) => {
  const isStaff = isTeacherClassName(activeClass?.name);
  const roleLabel = student
    ? (isStaff
      ? (student.isPrincipal ? 'Okul Müdürü' : (student.role || 'Öğretmen'))
      : `Okul No: ${student.studentNumber}`)
    : '';

  return (
    <OriginSheet
      controller={controller}
      title={student ? `Portre Önizleme · ${student.firstName} ${student.lastName}` : 'Portre Önizleme'}
      description={student && activeClass ? `${activeClass.name} · ${roleLabel}` : undefined}
      width={460}
      showCancel={false}
      secondaryAction={
        onEditPhotos && activeClass && photo
          ? {
              label: 'Fotoğrafları Düzenle',
              onClick: () => {
                controller.close();
                onEditPhotos(activeClass.id, photo.id);
              },
            }
          : undefined
      }
      submitLabel="Kapat"
      onSubmit={() => controller.close()}
    >
      {student && photo && <PortraitPreviewContent photo={photo} student={student} />}
    </OriginSheet>
  );
};

