import { DESKTOP_PHOTO_COPY_PREFIX, SCHOOL_LIMITS, schoolNameKey } from '../schemas/schoolSchemas';
import { sortClassRecords } from './classOrder';
import { appendSyncLog } from './syncLog';
import { BROWSER_PHOTO_REFERENCE } from '../storage/browserWorkspace';
import { usesDesktopStorage } from '../desktop/desktopStorage';
import type {
  ClassRecord,
  PhotoRecord,
  SchoolRecord,
  StudentRecord,
  StudioDatabaseSnapshot,
} from './types';

/**
 * İZOLE SİSTEM KATMANI: Okul Silme, Birleştirme ve Yeni Döneme Taşıma (src/system/sqlite/schoolMerge.ts)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function deleteSchoolFromSnapshot(
  state: StudioDatabaseSnapshot,
  schoolId: string,
): StudioDatabaseSnapshot {
  const target = state.schools.find((item) => item.id === schoolId);
  if (!target) throw new Error('Silinecek okul bulunamadı.');

  const classIds = new Set(state.classes.filter((c) => c.schoolId === schoolId).map((c) => c.id));
  const studentIds = new Set(state.students.filter((s) => classIds.has(s.classId)).map((s) => s.id));
  const remainingSchools = state.schools.filter((item) => item.id !== schoolId);
  const remainingClasses = state.classes.filter((item) => item.schoolId !== schoolId);
  const remainingStudents = state.students.filter((item) => !classIds.has(item.classId));
  const updatedPhotos = state.photos.map((photo) =>
    (photo.classId && classIds.has(photo.classId)) || (photo.studentId && studentIds.has(photo.studentId))
      ? { ...photo, classId: undefined, studentId: null, approvedForPrint: false }
      : photo,
  );

  return {
    ...state,
    schools: remainingSchools,
    activeSchoolId: state.activeSchoolId === schoolId ? (remainingSchools[0]?.id ?? null) : state.activeSchoolId,
    classes: remainingClasses,
    students: remainingStudents,
    photos: updatedPhotos,
    albumConfig: {
      ...state.albumConfig,
      selectedClassId: classIds.has(state.albumConfig.selectedClassId)
        ? (remainingClasses[0]?.id ?? '')
        : state.albumConfig.selectedClassId,
    },
    syncQueue: appendSyncLog('school', schoolId, 'DELETE', `${target.name} okulu ve bağlı kayıtları silindi`, state.syncQueue),
  };
}

export function mergeSchoolsIntoNewRecord(
  state: StudioDatabaseSnapshot,
  newSchoolName: string,
  schoolIds: string[],
  nextCode: string,
): StudioDatabaseSnapshot {
  if (state.schools.length >= SCHOOL_LIMITS.maxSchools) throw new Error('Okul sayısı sınırına ulaşıldı.');
  const uniqueIds = Array.from(new Set(schoolIds));
  if (uniqueIds.length < 2) throw new Error('Birleştirmek için en az 2 farklı okul seçmelisiniz.');
  const selectedSchools = uniqueIds.map((id) => {
    const found = state.schools.find((s) => s.id === id);
    if (!found) throw new Error('Seçilen okullardan biri bulunamadı.');
    return found;
  });

  const cleanName = newSchoolName.trim().replace(/\s+/g, ' ');
  const key = schoolNameKey(cleanName);
  if (state.schools.some((item) => schoolNameKey(item.name) === key)) {
    throw new Error('Bu adla kayıtlı bir okul zaten var.');
  }

  const now = new Date().toISOString();
  const newSchoolId = crypto.randomUUID();
  const primary = selectedSchools[0];
  const findFirst = (pick: (s: SchoolRecord) => string) => selectedSchools.map(pick).find((v) => v !== '') ?? '';

  const mergedSchool: SchoolRecord = {
    id: newSchoolId,
    code: nextCode,
    institutionCode: '',
    name: cleanName,
    address: findFirst((s) => s.address),
    notes: selectedSchools.map((s) => s.notes).filter(Boolean).join('\n'),
    makeBiometric: selectedSchools.some((s) => s.makeBiometric),
    makeVesikalik: selectedSchools.some((s) => s.makeVesikalik),
    logoDataUrl: findFirst((s) => s.logoDataUrl),
    transparentLogoOpacity: primary.transparentLogoOpacity ?? 35,
    principalSignatureDataUrl: findFirst((s) => s.principalSignatureDataUrl),
    deputySignatureDataUrl: findFirst((s) => s.deputySignatureDataUrl),
    schoolPhotoDataUrl: findFirst((s) => s.schoolPhotoDataUrl),
    schoolPhotoZoom: primary.schoolPhotoZoom ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  const newClasses: ClassRecord[] = [];
  const newStudents: StudentRecord[] = [];
  const newPhotos: PhotoRecord[] = [];
  const targetClassByKey = new Map<string, ClassRecord>();
  const numbersInClass = new Map<string, Set<string>>();

  for (const srcClass of state.classes.filter((cls) => uniqueIds.includes(cls.schoolId))) {
    const classKey = JSON.stringify([srcClass.academicYear, srcClass.name]);
    let targetClass = targetClassByKey.get(classKey);
    if (!targetClass) {
      targetClass = { ...srcClass, id: crypto.randomUUID(), schoolId: newSchoolId, createdAt: now };
      targetClassByKey.set(classKey, targetClass);
      numbersInClass.set(targetClass.id, new Set());
      newClasses.push(targetClass);
    }

    const usedNumbers = numbersInClass.get(targetClass.id)!;
    for (const srcStu of state.students.filter((stu) => stu.classId === srcClass.id)) {
      if (usedNumbers.has(srcStu.studentNumber)) {
        throw new Error(`${srcClass.name} şubesinde ${srcStu.studentNumber} okul numarası birden fazla okulda çakışıyor; birleştirme durduruldu.`);
      }
      usedNumbers.add(srcStu.studentNumber);

      const newStuId = crypto.randomUUID();
      let newPhotoId: string | null = null;
      const srcPhoto = srcStu.matchedPhotoId ? state.photos.find((p) => p.id === srcStu.matchedPhotoId) : null;
      if (srcPhoto) {
        newPhotoId = crypto.randomUUID();
        newPhotos.push({
          ...srcPhoto, id: newPhotoId, classId: targetClass.id, studentId: newStuId, approvedForPrint: false, createdAt: now,
          dataUrl: srcPhoto.dataUrl || ((usesDesktopStorage ? DESKTOP_PHOTO_COPY_PREFIX : BROWSER_PHOTO_REFERENCE) + srcPhoto.id),
        });
      }
      newStudents.push({
        ...srcStu, id: newStuId, classId: targetClass.id, matchedPhotoId: newPhotoId, printReady: false, updatedAt: now,
      });
    }
  }

  return {
    ...state,
    schools: [...state.schools, mergedSchool],
    activeSchoolId: newSchoolId,
    classes: sortClassRecords([...state.classes, ...newClasses]),
    students: [...state.students, ...newStudents],
    photos: [...state.photos, ...newPhotos],
    syncQueue: appendSyncLog('school', newSchoolId, 'INSERT', `${selectedSchools.length} okul "${mergedSchool.name}" altında birleştirildi`, state.syncQueue),
  };
}

/** Şube adını bir üst sınıfa terfi ettirir ("9-A" → "10-A"); mezun sınıflar (4, 8, 12) null döner. */
export function promoteClassName(name: string): string | null {
  const match = name.trim().match(/^(\d{1,2})\s*([-/\s]?.*)?$/);
  if (!match) return null;
  const grade = Number(match[1]);
  const suffix = match[2] ?? '';
  if (grade === 4 || grade === 8 || grade >= 12 || grade < 1) return null;
  return `${grade + 1}${suffix}`.toUpperCase();
}

export function promoteSchoolClassesToNextYear(
  state: StudioDatabaseSnapshot,
  schoolId: string,
  targetAcademicYear: string,
): StudioDatabaseSnapshot {
  const school = state.schools.find((s) => s.id === schoolId);
  if (!school) throw new Error('Okul bulunamadı.');
  const cleanYear = targetAcademicYear.trim();
  const schoolClasses = state.classes.filter((c) => c.schoolId === schoolId);
  if (schoolClasses.length === 0) throw new Error('Bu okulda yeni döneme taşınacak şube bulunmuyor.');

  const existingInTargetYear = new Set(schoolClasses.filter((c) => c.academicYear === cleanYear).map((c) => c.name));
  const latestYear = schoolClasses[schoolClasses.length - 1].academicYear;
  const sourceClasses = schoolClasses.filter((c) => c.academicYear === latestYear);

  const now = new Date().toISOString();
  const addedClasses: ClassRecord[] = [];
  const addedStudents: StudentRecord[] = [];

  for (const cls of sourceClasses) {
    const nextName = promoteClassName(cls.name);
    if (!nextName || existingInTargetYear.has(nextName)) continue;
    existingInTargetYear.add(nextName);

    const newClassId = crypto.randomUUID();
    addedClasses.push({ id: newClassId, schoolId, academicYear: cleanYear, name: nextName, teacherName: cls.teacherName, createdAt: now });
    for (const stu of state.students.filter((s) => s.classId === cls.id)) {
      addedStudents.push({
        id: crypto.randomUUID(), classId: newClassId, studentNumber: stu.studentNumber,
        firstName: stu.firstName, lastName: stu.lastName, matchedPhotoId: null, printReady: false, updatedAt: now,
      });
    }
  }

  if (addedClasses.length === 0) {
    throw new Error('Yeni döneme terfi ettirilecek uygun şube bulunamadı (4, 8 ve 12. sınıflar mezun sayılır).');
  }

  return {
    ...state,
    classes: sortClassRecords([...state.classes, ...addedClasses]),
    students: [...state.students, ...addedStudents],
    albumConfig: { ...state.albumConfig, selectedClassId: addedClasses[0].id },
    syncQueue: appendSyncLog('school', schoolId, 'UPDATE', `${school.name}: ${addedClasses.length} şube ${cleanYear} dönemine taşındı`, state.syncQueue),
  };
}
