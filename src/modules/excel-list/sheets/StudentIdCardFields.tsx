import React from 'react';
import type { StudentIdCardDetails } from '../../../system/sqlite/types';
import { SheetSection, SheetTextField } from '../../../window-system/sheet/SheetFields';

export const EMPTY_ID_CARD: Required<StudentIdCardDetails> = {
  nationalId: '',
  department: '',
  bloodType: '',
  fatherName: '',
  motherName: '',
  birthPlace: '',
  birthDate: '',
  province: '',
  district: '',
  neighborhood: '',
  volumeNo: '',
  familySerialNo: '',
  serialNo: '',
  documentNo: '',
  registryNo: '',
};

export function toIdCardForm(card?: StudentIdCardDetails): Required<StudentIdCardDetails> {
  return {
    nationalId: card?.nationalId ?? '',
    department: card?.department ?? '',
    bloodType: card?.bloodType ?? '',
    fatherName: card?.fatherName ?? '',
    motherName: card?.motherName ?? '',
    birthPlace: card?.birthPlace ?? '',
    birthDate: card?.birthDate ?? '',
    province: card?.province ?? '',
    district: card?.district ?? '',
    neighborhood: card?.neighborhood ?? '',
    volumeNo: card?.volumeNo ?? '',
    familySerialNo: card?.familySerialNo ?? '',
    serialNo: card?.serialNo ?? '',
    documentNo: card?.documentNo ?? '',
    registryNo: card?.registryNo ?? '',
  };
}

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Kimlik Kartı ve Nüfus Kütük Alanları
 * - İlkokul/ortaokulda boş bırakılabilen isteğe bağlı Bölümü / Alanı (lise/meslek kimlikleri için),
 *   T.C. Kimlik No, Kan Grubu, Baba/Anne Adı, Doğum Yeri/Tarihi ve kütük alanlarını 5×3 simetrik düzende sunar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const StudentIdCardFields: React.FC<{
  value: Required<StudentIdCardDetails>;
  onChange: <K extends keyof StudentIdCardDetails>(key: K, val: string) => void;
}> = React.memo(({ value, onChange }) => {
  const set = <K extends keyof StudentIdCardDetails>(key: K) => (val: string) => onChange(key, val);

  return (
    <SheetSection title="Kimlik Kartı ve Kütük Bilgileri">
      <div className="xl-idcard-fields-grid">
        <div className="xl-sheet-triple-row">
          <SheetTextField
            label="Kimlik No"
            numeric
            value={value.nationalId}
            onChange={set('nationalId')}
            maxLength={11}
            placeholder="11 haneli T.C. No"
          />
          <SheetTextField
            label="Bölümü / Alanı"
            value={value.department}
            onChange={set('department')}
            maxLength={60}
            placeholder="İsteğe bağlı (Lise / Alan)"
          />
          <SheetTextField
            label="Kan Grubu"
            value={value.bloodType}
            onChange={set('bloodType')}
            maxLength={16}
            placeholder="Örn. A Rh+, 0 Rh+"
          />
        </div>

        <div className="xl-sheet-triple-row">
          <SheetTextField
            label="Doğum Tar."
            value={value.birthDate}
            onChange={set('birthDate')}
            maxLength={24}
            placeholder="GG.AA.YYYY"
          />
          <SheetTextField
            label="Doğum Yeri"
            value={value.birthPlace}
            onChange={set('birthPlace')}
            maxLength={50}
          />
          <SheetTextField
            label="Baba Adı"
            value={value.fatherName}
            onChange={set('fatherName')}
            maxLength={50}
          />
        </div>

        <div className="xl-sheet-triple-row">
          <SheetTextField
            label="Anne Adı"
            value={value.motherName}
            onChange={set('motherName')}
            maxLength={50}
          />
          <SheetTextField
            label="İli"
            value={value.province}
            onChange={set('province')}
            maxLength={40}
          />
          <SheetTextField
            label="İlçesi"
            value={value.district}
            onChange={set('district')}
            maxLength={40}
          />
        </div>

        <div className="xl-sheet-triple-row">
          <SheetTextField
            label="Mahalle/Köy"
            value={value.neighborhood}
            onChange={set('neighborhood')}
            maxLength={60}
          />
          <SheetTextField
            label="Cilt No"
            value={value.volumeNo}
            onChange={set('volumeNo')}
            maxLength={20}
          />
          <SheetTextField
            label="Aile Sr No"
            value={value.familySerialNo}
            onChange={set('familySerialNo')}
            maxLength={20}
          />
        </div>

        <div className="xl-sheet-triple-row">
          <SheetTextField
            label="Sıra No"
            value={value.serialNo}
            onChange={set('serialNo')}
            maxLength={20}
          />
          <SheetTextField
            label="İl/Belge No"
            value={value.documentNo}
            onChange={set('documentNo')}
            maxLength={30}
          />
          <SheetTextField
            label="Sicil No"
            value={value.registryNo}
            onChange={set('registryNo')}
            maxLength={30}
          />
        </div>
      </div>
    </SheetSection>
  );
});
