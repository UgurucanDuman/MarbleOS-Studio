import { useCallback, useDeferredValue, useState } from 'react';
import type { ClassRecord } from '../../system/sqlite/types';

interface ClassFocus {
  classId: string;
  studentId: string | null;
  dir: number;
}

/**
 * Şube/öğrenci odağı. Şube sekmesindeki cam hap ANINDA (acil güncelleme) kayar; ağır tablo,
 * denetçi ve araç çubuğu ise `useDeferredValue` ile ertelenmiş, kesilebilir render'da gelir.
 * Şube + seçili öğrenci tek nesnede ertelendiği için tablo eski şubede kalırken denetçi
 * yeni öğrenciye "ara kare" geçişi yapmaz; iki animasyon üst üste binmez.
 * Okul değişince eski şube kimliği yeni okulun şubelerinde bulunmaz ve ilk şubeye düşülür.
 */
export function useClassFocus(schoolClasses: ClassRecord[]) {
  const [focus, setFocus] = useState<ClassFocus>({ classId: '', studentId: null, dir: 1 });
  const deferred = useDeferredValue(focus);

  const findClass = (id: string) => schoolClasses.find((c) => c.id === id) ?? schoolClasses[0];
  const requestedClass = findClass(focus.classId);
  const activeClass = findClass(deferred.classId);

  const focusClass = useCallback((id: string, studentId: string | null = null) => {
    setFocus((prev) => {
      const currentId = schoolClasses.some((c) => c.id === prev.classId) ? prev.classId : schoolClasses[0]?.id;
      const prevIdx = schoolClasses.findIndex((c) => c.id === currentId);
      const nextIdx = schoolClasses.findIndex((c) => c.id === id);
      const dir = prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx ? (nextIdx > prevIdx ? 1 : -1) : prev.dir;
      return { classId: id, studentId, dir };
    });
  }, [schoolClasses]);

  const selectStudent = useCallback((studentId: string | null) => {
    setFocus((prev) => (prev.studentId === studentId ? prev : { ...prev, studentId }));
  }, []);

  const resetFocus = useCallback(() => {
    setFocus((prev) => ({ classId: '', studentId: null, dir: prev.dir }));
  }, []);

  return {
    requestedClass,
    activeClass,
    classDir: deferred.dir,
    selectedStudentId: deferred.studentId,
    focusClass,
    selectStudent,
    resetFocus,
  };
}
