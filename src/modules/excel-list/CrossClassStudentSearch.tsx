import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { isTeacherClassName } from './sheets/formHelpers';
import './cross-class-search.css';

interface CrossClassMatch {
  student: StudentRecord;
  className: string;
  isCurrentClass: boolean;
}

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Okul İçi Tüm Sınıflarda Öğrenci Arama
 * Hızlı Ekle kapsülünün hemen yanında tüm şubelerde anlık arama yapar ve tıklanan
 * öğrencinin bulunduğu şubeye geçiş yaparak satırı ve sağ denetçiyi odaklar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const CrossClassStudentSearch: React.FC<{
  classes: ClassRecord[];
  students: StudentRecord[];
  activeClassId?: string;
  onSelectResult: (classId: string, studentId: string) => void;
}> = React.memo(({ classes, students, activeClassId, onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const cleanQuery = query.trim().toLocaleLowerCase('tr-TR');

  const matches = useMemo<CrossClassMatch[]>(() => {
    if (!cleanQuery) return [];
    const results: CrossClassMatch[] = [];
    for (const stu of students) {
      const clsName = classMap.get(stu.classId) ?? '';
      const fullName = `${stu.firstName} ${stu.lastName}`.toLocaleLowerCase('tr-TR');
      const revName = `${stu.lastName} ${stu.firstName}`.toLocaleLowerCase('tr-TR');
      const hit =
        stu.studentNumber.toLocaleLowerCase('tr-TR').includes(cleanQuery) ||
        fullName.includes(cleanQuery) ||
        revName.includes(cleanQuery) ||
        clsName.toLocaleLowerCase('tr-TR').includes(cleanQuery);
      if (hit) {
        results.push({
          student: stu,
          className: clsName || 'Şube',
          isCurrentClass: stu.classId === activeClassId,
        });
      }
    }
    return results;
  }, [activeClassId, classMap, cleanQuery, students]);

  const visibleMatches = useMemo(() => matches.slice(0, 15), [matches]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [cleanQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [isOpen]);

  const pickItem = (match: CrossClassMatch) => {
    onSelectResult(match.student.classId, match.student.id);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!cleanQuery) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' && visibleMatches.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIdx((curr) => (curr + 1) % visibleMatches.length);
    } else if (e.key === 'ArrowUp' && visibleMatches.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIdx((curr) => (curr - 1 + visibleMatches.length) % visibleMatches.length);
    } else if (e.key === 'Enter' && visibleMatches[highlightIdx]) {
      e.preventDefault();
      pickItem(visibleMatches[highlightIdx]);
    }
  };

  const showDropdown = isOpen && cleanQuery.length > 0;

  return (
    <div ref={containerRef} className="xl-cross-search-wrap">
      <svg className="xl-search-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" stroke="#38bdf8" strokeWidth="1.5" />
        <path d="M10.5 10.5L13.8 13.8" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        className="xl-search xl-cross-search-input"
        aria-label="Tüm sınıflarda öğrenci ara"
        placeholder="Tüm sınıflarda ara…"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {showDropdown && (
        <div
          className="xl-cross-search-popover"
          role="listbox"
          aria-label="Tüm sınıflarda arama sonuçları"
        >
          <div className="xl-cross-search-head">
            <span>Tüm Sınıflar</span>
            <strong>
              {matches.length > 0
                ? `${matches.length} eşleşme`
                : 'Sonuç bulunamadı'}
            </strong>
          </div>
          {visibleMatches.length > 0 ? (
            <div className="xl-cross-search-list">
              {visibleMatches.map((match, idx) => {
                const { student, className, isCurrentClass } = match;
                const staff = isTeacherClassName(className);
                return (
                  <button
                    key={student.id}
                    type="button"
                    role="option"
                    aria-selected={idx === highlightIdx}
                    className={`xl-cross-search-item ${idx === highlightIdx ? 'is-highlighted' : ''}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => pickItem(match)}
                  >
                    <span className={`xl-cross-branch-tag ${isCurrentClass ? 'is-current' : ''}`}>
                      {className}
                    </span>
                    <span className="xl-cross-item-main">
                      <strong>{student.firstName} {student.lastName}</strong>
                      <small>
                        {staff
                          ? (student.isPrincipal ? 'Okul Müdürü' : (student.role || 'Öğretmen'))
                          : `No: ${student.studentNumber}`}
                      </small>
                    </span>
                    <span className={`xl-cross-photo-dot ${student.matchedPhotoId ? 'is-ok' : ''}`} title={student.matchedPhotoId ? 'Fotoğraflı' : 'Fotoğraf Eksik'}>
                      {student.matchedPhotoId ? '✓' : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="xl-cross-search-empty">
              Bu okulun şubelerinde &ldquo;{query.trim()}&rdquo; ile eşleşen kayıt yok.
            </p>
          )}
        </div>
      )}
    </div>
  );
});

