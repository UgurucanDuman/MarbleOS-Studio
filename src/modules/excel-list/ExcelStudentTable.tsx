import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StudioPhotoImage } from '../../system/storage/StudioPhotoImage';
import type {
  ClassRecord,
  PhotoRecord,
  StudentRecord,
} from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { useOriginSheet } from '../../window-system/sheet/useOriginSheet';
import { canTransferStudentToClass } from '../../system/sqlite/studentTransfers';
import { StudentRowActions } from './StudentRowActions';
import { TableSkeletonBoxes } from './TableSkeletonBoxes';
import {
  StudentTableBottomBar,
  StudentTableColGroup,
  StudentTableHeader,
} from './ExcelStudentTableParts';
import { isTeacherClassName } from './sheets/formHelpers';
import { StudentTransferSheet } from './sheets/StudentTransferSheet';
import { useInfiniteTableSlice } from './useInfiniteTableSlice';

interface ExcelStudentTableProps {
  activeClass?: ClassRecord;
  schoolClasses?: ClassRecord[];
  students: StudentRecord[];
  resetKey: string;
  photos: PhotoRecord[];
  photoMap?: ReadonlyMap<string, PhotoRecord>;
  checkedIds: string[];
  selectedStudentId?: string | null;
  onToggleAll: () => void;
  onToggleCheck: (studentId: string) => void;
  onSelectStudent?: (studentId: string) => void;
  onToggleShowInAlbum?: (student: StudentRecord) => void;
  onSort?: (by: 'number' | 'name') => void;
  onDeleteChecked: () => void;
  onEditStudent: (student: StudentRecord, triggerEl: HTMLElement) => void;
  onRequestDeleteStudent: (student: StudentRecord, triggerEl: HTMLElement) => void;
}

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Öğrenci & Portre Durum Tablosu (Apple macOS Numbers / Finder Pro)
 * - Başlıkta "Tümünü Seç" + satır seçim kutuları
 * - S/N, okul no, ad, soyad, portre, resim dosyası, göster, grup ve durum sütunları
 * - Satır sağında Düzenle (Kalem) ve Sil (Çöp Kutusu) ikon butonları
 * - Kaydırdıkça 20'şer kayıt ve alt sıralama çubuğu
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const ExcelStudentTable: React.FC<ExcelStudentTableProps> = React.memo(
  ({
    activeClass,
    schoolClasses = [],
    students,
    resetKey,
    photos,
    photoMap: sharedPhotoMap,
    checkedIds,
    selectedStudentId,
    onToggleAll,
    onToggleCheck,
    onSelectStudent,
    onToggleShowInAlbum,
    onSort,
    onDeleteChecked,
    onEditStudent,
    onRequestDeleteStudent,
  }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const headWrapRef = useRef<HTMLDivElement>(null);
    const transferSheet = useOriginSheet();
    const [transferSource, setTransferSource] = useState<{ student: StudentRecord; index: number } | null>(null);
    const moving = transferSheet.phase === 'closed' ? null : transferSource;
    const transferTargets = useMemo(
      () => activeClass ? schoolClasses.filter((target) => canTransferStudentToClass(activeClass, target)) : [],
      [activeClass, schoolClasses],
    );
    // Kapanış sırasında kartın döneceği düğmeyi aynı satırda tut.
    const tableStudents = useMemo(() => {
      if (!moving || students.some((student) => student.id === moving.student.id)) return students;
      const rows = [...students];
      rows.splice(moving.index, 0, moving.student);
      return rows;
    }, [moving, students]);
    const knownStudentIdsRef = useRef<Set<string> | null>(null);
    const lastResetKeyRef = useRef(resetKey);
    if (lastResetKeyRef.current !== resetKey || knownStudentIdsRef.current === null) {
      lastResetKeyRef.current = resetKey;
      knownStudentIdsRef.current = new Set(students.map((s) => s.id));
    }
    const selectedIndex = useMemo(
      () => (selectedStudentId ? students.findIndex((s) => s.id === selectedStudentId) : -1),
      [students, selectedStudentId],
    );
    const {
      visibleItems,
      visibleCount,
      totalCount,
      hasMore,
      isSliceLoading,
      loadingMode,
      loadMore,
      handleScroll,
    } = useInfiniteTableSlice(
      tableStudents,
      resetKey,
      20,
      activeClass?.id ?? '',
      Math.max(selectedIndex >= 20 ? selectedIndex + 1 : 0, moving ? moving.index + 1 : 0),
    );

    const scrollResetKeyRef = useRef(resetKey);
    useLayoutEffect(() => {
      if (scrollResetKeyRef.current === resetKey) return;
      scrollResetKeyRef.current = resetKey;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        scrollRef.current.scrollLeft = 0;
      }
      if (headWrapRef.current) headWrapRef.current.scrollLeft = 0;
    }, [resetKey]);

    useLayoutEffect(() => {
      knownStudentIdsRef.current = new Set(students.map((s) => s.id));
    }, [students]);

    const photoMap = useMemo(
      () => sharedPhotoMap ?? new Map(photos.map((p) => [p.id, p])),
      [sharedPhotoMap, photos],
    );
    const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
    const { allChecked, someChecked } = useMemo(() => {
      const all = students.length > 0 && students.every((s) => checkedSet.has(s.id));
      return { allChecked: all, someChecked: !all && students.some((s) => checkedSet.has(s.id)) };
    }, [students, checkedSet]);
    const matchedCount = useMemo(() => students.filter((s) => Boolean(s.matchedPhotoId)).length, [students]);
    const isStaff = isTeacherClassName(activeClass?.name);
    const staffBranchMap = useMemo(() => {
      const map = new Map<string, string[]>();
      if (!isStaff) return map;
      for (const cls of schoolClasses) {
        if (isTeacherClassName(cls.name)) continue;
        for (const owner of [cls.teacherName, cls.deputyPrincipalName]) {
          const key = owner?.trim().toLocaleLowerCase('tr-TR');
          if (!key) continue;
          const prev = map.get(key) ?? [];
          if (!prev.includes(cls.name)) map.set(key, [...prev, cls.name]);
        }
      }
      return map;
    }, [isStaff, schoolClasses]);

    return (
      <div className="mod-table-wrap xl-student-table-wrap">
        {activeClass && (
          <div className="xl-table-class-banner">
            <span className="xl-table-class-name">
              <SheetAutoIcon text={isStaff ? 'Öğretmen' : 'Şube'} size={14} />
              <strong>{activeClass.name}</strong>
            </span>
            <span className="xl-table-class-teacher">
              <SheetAutoIcon text="Öğretmen" size={13} />
              {isStaff ? (
                <>Öğretmen ve İdareci Kadrosu · <strong>{activeClass.academicYear}</strong></>
              ) : (
                <>
                  Sınıf Öğretmeni: <strong>{activeClass.teacherName || 'Belirtilmedi'}</strong>
                  {activeClass.deputyPrincipalName ? ` · Md. Yrd.: ${activeClass.deputyPrincipalName}` : ''}
                  {` · ${activeClass.academicYear}`}
                </>
              )}
            </span>
            <span className="xl-table-class-count">
              Mevcut: <strong>{students.length}</strong> · Fotoğraflı: <strong>{matchedCount}</strong>
            </span>
          </div>
        )}
        <StudentTableHeader
          headRef={headWrapRef}
          isStaff={isStaff}
          allChecked={allChecked}
          someChecked={someChecked}
          disabled={students.length === 0}
          checkedCount={checkedIds.length}
          onDeleteChecked={onDeleteChecked}
          onToggleAll={onToggleAll}
        />
        <div
          className="xl-table-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            if (headWrapRef.current) headWrapRef.current.scrollLeft = e.currentTarget.scrollLeft;
            handleScroll(e);
          }}
          tabIndex={0}
          role="region"
          aria-label="Kaydırılabilir öğrenci listesi"
        >
          <table className={isStaff ? 'mod-table is-staff-table' : 'mod-table'}>
            <StudentTableColGroup />
            <tbody className={isSliceLoading && loadingMode === 'reset' ? 'xl-tbody-deferred' : undefined}>
              {visibleItems.map((stu, idx) => {
                const photo = stu.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : undefined;
                const isChecked = checkedSet.has(stu.id);
                const isSelected = selectedStudentId === stu.id;
                const isNewlyAdded = !knownStudentIdsRef.current?.has(stu.id);
                const showInAlbum = stu.showInAlbum !== false;
                const initials = `${stu.firstName[0] ?? ''}${stu.lastName[0] ?? ''}`.toLocaleUpperCase('tr-TR');
                return (
                  <tr
                    key={stu.id}
                    className={`${isChecked ? 'is-checked' : ''} ${isSelected ? 'is-selected-row' : ''} ${isNewlyAdded ? 'is-newly-added' : ''}`.trim()}
                    onClick={() => onSelectStudent?.(stu.id)}
                  >
                    <td className="xl-td-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="xl-row-check"
                        aria-label={`${stu.firstName} ${stu.lastName} seç`}
                        checked={isChecked}
                        onChange={() => onToggleCheck(stu.id)}
                      />
                    </td>
                    <td className="xl-td-sn">{idx + 1}</td>
                    <td className="xl-td-wrap">
                      <div className="xl-no-cell">
                        {isStaff ? (
                          <>
                            <span className="xl-role-tag">
                              {stu.isPrincipal ? 'Okul Müdürü' : (stu.role || 'Öğretmen')}
                            </span>
                            {staffBranchMap
                              .get(`${stu.firstName} ${stu.lastName}`.trim().slice(0, 60).toLocaleLowerCase('tr-TR'))
                              ?.map((branchName) => (
                                <span key={branchName} className="xl-branch-tag">
                                  {branchName}
                                </span>
                              ))}
                          </>
                        ) : (
                          <span className="mod-mono-badge">{stu.studentNumber}</span>
                        )}
                      </div>
                    </td>
                    <td className="xl-td-wrap"><strong>{stu.firstName}</strong></td>
                    <td className="xl-td-wrap"><strong>{stu.lastName}</strong></td>
                    <td className="xl-td-photo">
                      <div className="mod-student-cell">
                        {photo ? (
                          <StudioPhotoImage
                            loading="lazy"
                            decoding="async"
                            photo={photo}
                            alt=""
                            className="mod-mini-thumb"
                          />
                        ) : (
                          <span className="mod-mini-avatar" aria-hidden="true">
                            {initials}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="xl-td-wrap">
                      {photo ? (
                        <span className="xl-file-badge">
                          <SheetAutoIcon text="Fotoğraf" size={11.5} />
                          {photo.fileName}
                        </span>
                      ) : (
                        <span className="xl-file-missing">Fotoğraf Yok</span>
                      )}
                    </td>
                    <td className="xl-td-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="xl-row-check"
                        aria-label={`${stu.firstName} ${stu.lastName} albümde göster`}
                        checked={showInAlbum}
                        onChange={() => onToggleShowInAlbum?.(stu)}
                      />
                    </td>
                    <td className="xl-td-center">
                      {stu.groupCode ? (
                        <span className="xl-group-tag">{stu.groupCode}</span>
                      ) : (
                        <span className="xl-cell-empty">—</span>
                      )}
                    </td>
                    <td>
                      {stu.printReady ? (
                        <span className="mod-tag-ok">✓ Baskıya Onaylı</span>
                      ) : stu.matchedPhotoId ? (
                        <span className="mod-tag-warn">◐ Kadraj Bekliyor</span>
                      ) : (
                        <span className="mod-tag-danger">✕ Fotoğraf Eksik</span>
                      )}
                    </td>
                    <td className="xl-td-actions" onClick={(e) => e.stopPropagation()}>
                      <StudentRowActions
                        student={stu}
                        transferSheet={activeClass && !isStaff ? transferSheet : undefined}
                        onEdit={onEditStudent}
                        onDelete={onRequestDeleteStudent}
                        onTransfer={() => setTransferSource({ student: stu, index: idx })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isSliceLoading && (
            <TableSkeletonBoxes
              variant="students"
              rows={20}
              overlay={loadingMode === 'reset'}
            />
          )}
          {hasMore && <div className="xl-student-scroll-tail" aria-hidden="true" />}
        </div>

        <StudentTableBottomBar
          visibleCount={visibleCount}
          totalCount={totalCount}
          studentCount={students.length}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSort={onSort}
        />
        {moving && activeClass && (
          <StudentTransferSheet
            key={transferSheet.openSeq}
            controller={transferSheet}
            student={moving.student}
            source={activeClass}
            targets={transferTargets}
          />
        )}
      </div>
    );
  },
);
