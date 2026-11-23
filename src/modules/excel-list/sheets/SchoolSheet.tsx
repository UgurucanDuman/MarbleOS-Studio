import React, { useCallback, useState } from 'react';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import {
  SheetFieldRow, SheetSection, SheetSwitch, SheetTextArea, SheetTextField,
} from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { useCreateSchoolMutation, useUpdateSchoolMutation } from '../../../system/query/useSchoolQueries';
import {
  SCHOOL_LIMITS,
  schoolInputSchema,
  type SchoolParsedInput,
} from '../../../system/schemas/schoolSchemas';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { SchoolRecord } from '../../../system/sqlite/types';
import { formErrorMessage, hasSchoolRecordChanged } from './formHelpers';
import { SchoolVisualsPanel } from './SchoolVisualsSection';
import '../excel-school-sheet.css';

const EMPTY_SCHOOL: SchoolParsedInput = {
  name: '',
  institutionCode: '',
  address: '',
  notes: '',
  makeBiometric: false,
  makeVesikalik: true,
  logoDataUrl: '',
  transparentLogoOpacity: 35,
  principalSignatureDataUrl: '',
  deputySignatureDataUrl: '',
  schoolPhotoDataUrl: '',
  schoolPhotoZoom: 1,
};

function toForm(school: SchoolRecord): SchoolParsedInput {
  return {
    name: school.name,
    institutionCode: school.institutionCode,
    address: school.address,
    notes: school.notes,
    makeBiometric: school.makeBiometric,
    makeVesikalik: school.makeVesikalik,
    logoDataUrl: school.logoDataUrl ?? '',
    transparentLogoOpacity: school.transparentLogoOpacity ?? 35,
    principalSignatureDataUrl: school.principalSignatureDataUrl ?? '',
    deputySignatureDataUrl: school.deputySignatureDataUrl ?? '',
    schoolPhotoDataUrl: school.schoolPhotoDataUrl ?? '',
    schoolPhotoZoom: school.schoolPhotoZoom ?? 1,
  };
}

/** Yeni okul ve okul düzenleme kartı: bilgiler, baskı şablonları ve tüm görseller tek Apple formunda. */
export const SchoolSheet = React.memo(function SchoolSheet({
  controller,
  school,
}: {
  controller: OriginSheetController;
  school: SchoolRecord | null;
}) {
  const createMut = useCreateSchoolMutation();
  const updateMut = useUpdateSchoolMutation();
  const [form, setForm] = useState<SchoolParsedInput>(() => (school ? toForm(school) : EMPTY_SCHOOL));
  const [error, setError] = useState<string | null>(null);
  const openKey = controller.isOpen ? (school?.id ?? 'new') : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setForm(school ? toForm(school) : EMPTY_SCHOOL);
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const setField = useCallback(<K extends keyof SchoolParsedInput>(key: K, value: SchoolParsedInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const set = <K extends keyof SchoolParsedInput>(key: K) => (value: SchoolParsedInput[K]) =>
    setField(key, value);

  const submit = async () => {
    setError(null);
    const check = schoolInputSchema.safeParse(form);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? 'Okul bilgileri geçersiz.');
      return;
    }
    try {
      if (school) {
        if (!hasSchoolRecordChanged(school, check.data)) {
          controller.close();
          return;
        }
        await updateMut.mutateAsync({ ...check.data, id: school.id });
        notifyStudio(`${check.data.name} okul bilgileri güncellendi.`, 'success');
      } else {
        await createMut.mutateAsync(check.data);
        notifyStudio(`${check.data.name} okulu eklendi.`, 'success');
      }
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title={school ? 'Okul Bilgisi Düzenle' : 'Yeni Okul'}
      description={school ? `Okul kodu ${school.code} · ${school.name}` : 'Okul kaydedilince otomatik olarak seçili okul olur.'}
      width={940}
      submitLabel={school ? 'Değişiklikleri Kaydet' : 'Okulu Ekle'}
      busy={createMut.isPending || updateMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <div className="xl-school-form-split">
        <div className="xl-school-form-col">
          <SheetSection title="Okul Bilgileri">
            <SheetFieldRow>
              <SheetTextField
                label="Okul adı" required autoFocus value={form.name} onChange={set('name')}
                maxLength={SCHOOL_LIMITS.nameMax} placeholder="Örn. Atatürk İlkokulu"
              />
              <SheetTextField
                label="Kurum kodu" numeric value={form.institutionCode} onChange={set('institutionCode')}
                maxLength={SCHOOL_LIMITS.institutionCodeMax} placeholder="İsteğe bağlı (Örn. 001245)"
              />
            </SheetFieldRow>
            <SheetTextArea
              label="Adres" rows={2} value={form.address} onChange={set('address')}
              maxLength={SCHOOL_LIMITS.addressMax} placeholder="Mahalle, cadde ve ilçe bilgisi"
            />
            <SheetTextArea
              label="Notlar" rows={2} value={form.notes} onChange={set('notes')}
              maxLength={SCHOOL_LIMITS.notesMax}
              placeholder="İletişim kişisi, çekim günü veya özel stüdyo notu"
            />
          </SheetSection>
          <SheetSection title="Baskı ve Fotoğraf Şablonları">
            <SheetSwitch
              label="Biyometrik Baskı Şablonu (50×60 mm)"
              description="Onaylanan öğrenci portrelerinden otomatik 50×60 mm biyometrik kesim ve baskı dizgisi üretir."
              checked={form.makeBiometric}
              onChange={set('makeBiometric')}
            />
            <SheetSwitch
              label="Vesikalık Baskı Şablonu (45×60 mm)"
              description="Okul albümü, öğrenci kimliği ve karne için standart 45×60 mm vesikalık baskı dizgisi üretir."
              checked={form.makeVesikalik}
              onChange={set('makeVesikalik')}
            />
          </SheetSection>
        </div>

        <SchoolVisualsPanel form={form} onChange={setField} onError={setError} />
      </div>
    </OriginSheet>
  );
});

