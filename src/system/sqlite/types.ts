/**
 * İZOLE SİSTEM KATMANI: Yerel SQLite Veri Modelleri (src/system/sqlite/types.ts)
 * Dosya Sınırı Kuralı: .ts dosyaları <= 250 satır.
 */

export interface SchoolRecord {
  id: string;
  code: string; // Uygulamanın verdiği sıra kodu: "00001"
  institutionCode: string; // Kurum kodu; metin, baştaki sıfır korunur, boş olabilir
  name: string;
  address: string;
  notes: string;
  makeBiometric: boolean;
  makeVesikalik: boolean;
  logoDataUrl: string;
  transparentLogoOpacity: number; // 10 - 100 (%)
  principalSignatureDataUrl: string;
  deputySignatureDataUrl: string;
  schoolPhotoDataUrl: string;
  schoolPhotoZoom: number; // 1.0 - 1.5
  createdAt: string;
  updatedAt: string;
}

export interface ClassRecord {
  id: string;
  schoolId: string;
  academicYear: string;
  name: string; // Örn: "9-A", "10-B", "ÖĞRETMEN"
  teacherName: string;
  deputyPrincipalName?: string;
  createdAt: string;
}

export interface StudentIdCardDetails {
  nationalId?: string;     // Kimlik No (T.C. Kimlik No)
  department?: string;     // Bölümü / Alanı (Lise / Meslek Lisesi için isteğe bağlı)
  bloodType?: string;      // Kan Grubu
  fatherName?: string;     // Baba Adı
  motherName?: string;     // Anne Adı
  birthPlace?: string;     // Doğum Yeri
  birthDate?: string;      // Doğum Tar.
  province?: string;       // İli
  district?: string;       // İlçesi
  neighborhood?: string;   // Mahalle/Köy
  volumeNo?: string;       // Cilt No
  familySerialNo?: string; // Aile Sr No
  serialNo?: string;       // Sıra No
  documentNo?: string;     // İl/Belge No
  registryNo?: string;     // Sicil No
}

export interface StudentRecord {
  id: string;
  classId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  role?: string; // Örn: "MDR.", "MD.YRD.", "REHBER", Branş/Görevi
  isPrincipal?: boolean; // Okul Müdürü onay kutusu
  showInAlbum?: boolean; // Kimlik, Vesikalık ve Albüm Baskısında Çıksın (varsayılan true)
  groupCode?: string; // Grup sütunu (Örn: "A", "1", "SAY")
  idCard?: StudentIdCardDetails; // Kimlik Kartı Detay Bilgileri
  matchedPhotoId: string | null;
  printReady: boolean;
  updatedAt: string;
}

export interface PhotoAdjustments {
  zoom: number;        // 1.0 - 1.6
  brightness: number;  // 70 - 135 (%)
  contrast: number;    // 70 - 135 (%)
  warmth: number;      // -30 - +30
  rotation?: number;   // 0 | 90 | 180 | 270 (derece)
  panX?: number;       // -30 - +30 (%)
  panY?: number;       // -30 - +30 (%)
  tilt?: number;       // -10 - +10 (derece hassas baş eğimi)
  shadows?: number;    // -30 - +50
  highlights?: number; // -50 - +30
  saturation?: number; // 0 - 140 (%)
  sharpen?: number;    // 0 - 40
}

export interface PhotoRecord {
  id: string;
  fileName: string;
  dataUrl: string;
  contentHash?: string;
  classId?: string;
  studentId: string | null;
  adjustments: PhotoAdjustments;
  approvedForPrint: boolean;
  createdAt: string;
}

import type {
  PvcCodeSource,
  PvcCodeType,
  PvcCustomDesign,
  PvcFieldKey,
  PvcPhotoShape,
  PvcPrintSidesMode,
} from '../storage/pvc-cards/types';
import type { TeacherChartInkId, TeacherChartPaletteId } from '../storage/teacher-charts/types';
import type {
  KutukNameBoxStyle,
  KutukPhotoFrame,
  KutukScopeMode,
  KutukTemplateId,
} from '../storage/yearbook-kutuk/types';

export type AlbumLayoutKind = 'class-chart' | 'yearbook-spread' | 'id-card';

export interface AlbumTemplateConfig {
  selectedClassId: string;
  layoutKind: AlbumLayoutKind;
  headerTitle: string;
  accentColor: string;
  columns: number;
  showStudentNumbers: boolean;
  showTeacherBadge: boolean;
  chartTemplateId?: string;
  chartPaletteId?: TeacherChartPaletteId;
  chartInkId?: TeacherChartInkId;
  printFontPt?: import('../storage/printTypography').PrintFontPoint;
  courseName?: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverDataUrl?: string;
  customCoverMode?: 'full-bleed' | 'emblem';
  kutukTemplateId?: KutukTemplateId;
  kutukCols?: number;
  kutukRows?: number;
  kutukScopeMode?: KutukScopeMode;
  kutukDeputyName?: string;
  kutukIncludeCover?: boolean;
  kutukShowHeader?: boolean;
  kutukShowSubtitle?: boolean;
  kutukShowStaffPortraits?: boolean;
  kutukShowTeacherSig?: boolean;
  kutukShowDeputySig?: boolean;
  kutukShowPrincipalSig?: boolean;
  kutukShowPageNumber?: boolean;
  kutukNameBoxStyle?: KutukNameBoxStyle;
  kutukPhotoFrame?: KutukPhotoFrame;
  kutukFrameColor?: string;
  pvcTemplateId?: string;
  pvcPrintSides?: PvcPrintSidesMode;
  pvcCardsPerPage?: number;
  pvcCodeType?: PvcCodeType;
  pvcCodeSource?: PvcCodeSource;
  pvcShowWatermark?: boolean;
  pvcShowSignature?: boolean;
  pvcShowStudioInfo?: boolean;
  pvcCardRadiusMm?: number;
  pvcCardWidthMm?: number;
  pvcCardHeightMm?: number;
  pvcPhotoFit?: 'cover' | 'contain';
  pvcPhotoZoom?: number;
  pvcPhotoPosX?: number;
  pvcPhotoPosY?: number;
  pvcPhotoShape?: PvcPhotoShape;
  pvcHeaderTopText?: string;
  pvcBackNote?: string;
  pvcHiddenFields?: PvcFieldKey[];
  pvcCustomDesigns?: PvcCustomDesign[];
}

export interface SyncQueueRecord {
  id: string;
  entityType: 'school' | 'class' | 'student' | 'photo' | 'album';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  summary: string;
  status: 'PENDING' | 'SYNCED';
  createdAt: string;
}

export interface StudioDatabaseSnapshot {
  schools: SchoolRecord[];
  activeSchoolId: string | null;
  classes: ClassRecord[];
  students: StudentRecord[];
  photos: PhotoRecord[];
  albumConfig: AlbumTemplateConfig;
  syncQueue: SyncQueueRecord[];
  lastSyncedAt: string | null;
}

