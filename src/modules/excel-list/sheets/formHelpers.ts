import type { SchoolParsedInput } from '../../../system/schemas/schoolSchemas';
import type { UpdateStudentInput } from '../../../system/schemas/studioSchemas';
import type {
  ClassRecord,
  SchoolRecord,
  StudentIdCardDetails,
  StudentRecord,
} from '../../../system/sqlite/types';

export { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';

/** Eylülde başlayan eğitim yılı: 2026 Kasım → "2026-2027", 2027 Mart → "2026-2027". */
export function currentAcademicYear(now = new Date()): string {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export { isStaffBranch as isTeacherClassName } from '../../../system/sqlite/rosterImportActions';

export function hasSchoolRecordChanged(school: SchoolRecord, next: SchoolParsedInput): boolean {
  return (
    school.name !== next.name ||
    school.institutionCode !== next.institutionCode ||
    school.address !== next.address ||
    school.notes !== next.notes ||
    school.makeBiometric !== next.makeBiometric ||
    school.makeVesikalik !== next.makeVesikalik ||
    (school.logoDataUrl ?? '') !== (next.logoDataUrl ?? '') ||
    (school.transparentLogoOpacity ?? 35) !== (next.transparentLogoOpacity ?? 35) ||
    (school.principalSignatureDataUrl ?? '') !== (next.principalSignatureDataUrl ?? '') ||
    (school.deputySignatureDataUrl ?? '') !== (next.deputySignatureDataUrl ?? '') ||
    (school.schoolPhotoDataUrl ?? '') !== (next.schoolPhotoDataUrl ?? '') ||
    (school.schoolPhotoZoom ?? 1) !== (next.schoolPhotoZoom ?? 1)
  );
}

export function hasClassRecordChanged(
  cls: ClassRecord,
  next: { name: string; teacherName?: string; deputyPrincipalName?: string },
): boolean {
  return (
    cls.name !== next.name ||
    cls.teacherName !== (next.teacherName ?? '') ||
    (cls.deputyPrincipalName ?? '') !== (next.deputyPrincipalName ?? '')
  );
}

const ID_CARD_KEYS: ReadonlyArray<keyof StudentIdCardDetails> = [
  'nationalId', 'department', 'bloodType', 'fatherName', 'motherName', 'birthPlace', 'birthDate',
  'province', 'district', 'neighborhood', 'volumeNo', 'familySerialNo', 'serialNo',
  'documentNo', 'registryNo',
];

export function hasStudentRecordChanged(student: StudentRecord, next: UpdateStudentInput): boolean {
  if (
    student.studentNumber !== next.studentNumber ||
    student.firstName !== next.firstName ||
    student.lastName !== next.lastName ||
    (student.role ?? '') !== (next.role ?? '') ||
    Boolean(student.isPrincipal || student.role === 'MDR.') !==
      Boolean(next.isPrincipal || next.role === 'MDR.') ||
    (student.groupCode ?? '') !== (next.groupCode ?? '') ||
    (student.showInAlbum !== false) !== (next.showInAlbum !== false)
  ) {
    return true;
  }
  const a = student.idCard ?? {};
  const b = next.idCard ?? {};
  return ID_CARD_KEYS.some((key) => (a[key] ?? '').trim() !== (b[key] ?? '').trim());
}
