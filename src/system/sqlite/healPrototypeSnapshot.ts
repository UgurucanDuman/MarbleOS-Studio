/** İZOLE SİSTEM YARDIMCISI: Tarayıcı Prototipi Şema İyileştirici (.ts <= 240 satır) */

import { healPhotoAdjustments } from '../storage/photoColorMath';
import {
  asBool,
  asCleanMulti,
  asCleanSingle,
  asDataUrl,
  asIdCard,
  asNum,
  healAlbumConfigObject,
  type AnyRec,
} from './healSnapshotPrimitives';

export function healPrototypeSnapshotObject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = raw as AnyRec;
  if (!Array.isArray(obj.schools) && !Array.isArray(obj.classes) && !Array.isArray(obj.students)) {
    return raw;
  }

  const now = new Date().toISOString();
  const seenSchoolIds = new Set<string>();
  const seenInstCodes = new Set<string>();
  const schools: AnyRec[] = [];

  for (const item of Array.isArray(obj.schools) ? obj.schools : []) {
    if (!item || typeof item !== 'object') continue;
    const s = item as AnyRec;
    const id = asCleanSingle(s.id) || crypto.randomUUID();
    if (seenSchoolIds.has(id)) continue;
    seenSchoolIds.add(id);

    const rawName = asCleanSingle(s.name);
    const name = rawName.length >= 2 ? rawName.slice(0, 100) : `Okul ${schools.length + 1}`;
    let inst = asCleanSingle(s.institutionCode).replace(/\D+/g, '').slice(0, 12);
    if (inst && seenInstCodes.has(inst)) inst = '';
    if (inst) seenInstCodes.add(inst);

    schools.push({
      id, code: String(schools.length + 1).padStart(5, '0'), institutionCode: inst, name,
      address: asCleanMulti(s.address).slice(0, 300),
      notes: asCleanMulti(s.notes).slice(0, 2000),
      makeBiometric: asBool(s.makeBiometric, false),
      makeVesikalik: asBool(s.makeVesikalik, true),
      logoDataUrl: asDataUrl(s.logoDataUrl, 4_500_000),
      transparentLogoOpacity: Math.round(asNum(s.transparentLogoOpacity, 35, 10, 100)),
      principalSignatureDataUrl: asDataUrl(s.principalSignatureDataUrl, 4_500_000),
      deputySignatureDataUrl: asDataUrl(s.deputySignatureDataUrl, 4_500_000),
      schoolPhotoDataUrl: asDataUrl(s.schoolPhotoDataUrl, 11_500_000),
      schoolPhotoZoom: asNum(s.schoolPhotoZoom, 1, 1, 2),
      createdAt: asCleanSingle(s.createdAt, now) || now,
      updatedAt: asCleanSingle(s.updatedAt, now) || now,
    });
  }

  const activeSchoolIdRaw = asCleanSingle(obj.activeSchoolId);
  const activeSchoolId = seenSchoolIds.has(activeSchoolIdRaw) ? activeSchoolIdRaw : (asCleanSingle(schools[0]?.id) || null);
  const seenClassIds = new Set<string>();
  const seenClassKeys = new Set<string>();
  const classes: AnyRec[] = [];

  for (const item of Array.isArray(obj.classes) ? obj.classes : []) {
    if (!item || typeof item !== 'object') continue;
    const c = item as AnyRec;
    const id = asCleanSingle(c.id) || crypto.randomUUID();
    const schoolId = asCleanSingle(c.schoolId) || (activeSchoolId ?? '');
    if (seenClassIds.has(id) || !seenSchoolIds.has(schoolId)) continue;
    seenClassIds.add(id);

    const academicYear = asCleanSingle(c.academicYear) || '2026-2027';
    let name = (asCleanSingle(c.name) || '1-A').toUpperCase().replace(/(?:-\d+){2,}-*$/, '').replace(/-+$/, '').slice(0, 20);
    if (name.length < 2) name = `${name}-A`;
    const baseName = name.replace(/(?:-\d+)+$/, '') || name;
    let suffix = 2;
    while (seenClassKeys.has(JSON.stringify([schoolId, academicYear, name]))) {
      const tag = `-${suffix++}`;
      name = `${baseName.slice(0, Math.max(1, 20 - tag.length))}${tag}`;
    }
    seenClassKeys.add(JSON.stringify([schoolId, academicYear, name]));

    classes.push({
      id, schoolId, academicYear, name,
      teacherName: asCleanSingle(c.teacherName).slice(0, 60),
      deputyPrincipalName: asCleanSingle(c.deputyPrincipalName).slice(0, 60),
      createdAt: asCleanSingle(c.createdAt, now) || now,
    });
  }

  const seenStudentIds = new Set<string>();
  const seenStudentNumbers = new Set<string>();
  const students: AnyRec[] = [];

  for (const item of Array.isArray(obj.students) ? obj.students : []) {
    if (!item || typeof item !== 'object') continue;
    const st = item as AnyRec;
    const id = asCleanSingle(st.id) || crypto.randomUUID();
    const classId = asCleanSingle(st.classId);
    if (seenStudentIds.has(id) || !seenClassIds.has(classId)) continue;
    seenStudentIds.add(id);

    let studentNumber = asCleanSingle(st.studentNumber).replace(/[^A-Za-z0-9-]+/g, '') || '1';
    studentNumber = studentNumber.slice(0, 15);
    let seq = 2;
    while (seenStudentNumbers.has(JSON.stringify([classId, studentNumber]))) {
      studentNumber = `${studentNumber.slice(0, 11)}-${seq++}`;
    }
    seenStudentNumbers.add(JSON.stringify([classId, studentNumber]));

    const idCard = asIdCard(st.idCard);
    students.push({
      id, classId, studentNumber,
      firstName: (asCleanSingle(st.firstName) || 'Öğrenci').slice(0, 60),
      lastName: (asCleanSingle(st.lastName) || '-').slice(0, 60),
      role: asCleanSingle(st.role).slice(0, 60),
      ...(typeof st.isPrincipal === 'boolean' ? { isPrincipal: st.isPrincipal } : {}),
      showInAlbum: asBool(st.showInAlbum, true),
      groupCode: asCleanSingle(st.groupCode).slice(0, 24),
      ...(idCard ? { idCard } : {}),
      matchedPhotoId: typeof st.matchedPhotoId === 'string' && st.matchedPhotoId ? st.matchedPhotoId : null,
      printReady: asBool(st.printReady, false),
      updatedAt: asCleanSingle(st.updatedAt, now) || now,
    });
  }

  const seenPhotoIds = new Set<string>();
  const photos: AnyRec[] = [];

  for (const item of Array.isArray(obj.photos) ? obj.photos : []) {
    if (!item || typeof item !== 'object') continue;
    const p = item as AnyRec;
    const id = asCleanSingle(p.id);
    if (!id || seenPhotoIds.has(id)) continue;
    seenPhotoIds.add(id);
    const stuId = typeof p.studentId === 'string' && seenStudentIds.has(p.studentId) ? p.studentId : null;
    const rawClsId = asCleanSingle(p.classId);
    photos.push({
      id,
      fileName: asCleanSingle(p.fileName, 'photo.jpg') || 'photo.jpg',
      dataUrl: typeof p.dataUrl === 'string' ? p.dataUrl : '',
      ...(typeof p.contentHash === 'string' && /^[a-f0-9]{64}$/.test(p.contentHash) ? { contentHash: p.contentHash } : {}),
      studentId: stuId,
      ...(rawClsId && seenClassIds.has(rawClsId) ? { classId: rawClsId } : {}),
      adjustments: healPhotoAdjustments(p.adjustments),
      approvedForPrint: asBool(p.approvedForPrint, false),
      createdAt: asCleanSingle(p.createdAt, now) || now,
    });
  }

  const photoById = new Map(photos.map((p) => [p.id as string, p]));
  const studentById = new Map(students.map((s) => [s.id as string, s]));
  for (const s of students) {
    const p = s.matchedPhotoId ? photoById.get(s.matchedPhotoId as string) : undefined;
    if (!p || p.studentId !== s.id) { s.matchedPhotoId = null; s.printReady = false; }
    else if (!p.approvedForPrint) s.printReady = false;
  }
  for (const p of photos) {
    const s = p.studentId ? studentById.get(p.studentId as string) : undefined;
    if (!s || s.matchedPhotoId !== p.id) { p.studentId = null; p.approvedForPrint = false; }
    else if (p.classId && p.classId !== s.classId) p.classId = s.classId;
  }

  const seenQueueIds = new Set<string>();
  const syncQueue: AnyRec[] = [];
  for (const item of Array.isArray(obj.syncQueue) ? obj.syncQueue : []) {
    if (!item || typeof item !== 'object') continue;
    const q = item as AnyRec;
    const id = asCleanSingle(q.id);
    if (!id || seenQueueIds.has(id)) continue;
    seenQueueIds.add(id);
    const entityType = ['school', 'class', 'student', 'photo', 'album'].includes(asCleanSingle(q.entityType)) ? q.entityType : 'school';
    const operation = ['INSERT', 'UPDATE', 'DELETE'].includes(asCleanSingle(q.operation)) ? q.operation : 'UPDATE';
    syncQueue.push({
      id, entityType, entityId: asCleanSingle(q.entityId), operation,
      summary: asCleanSingle(q.summary), status: 'PENDING', createdAt: asCleanSingle(q.createdAt, now) || now,
    });
  }

  return {
    schools, activeSchoolId, classes, students, photos,
    albumConfig: healAlbumConfigObject(obj.albumConfig),
    syncQueue, lastSyncedAt: null,
  };
}
