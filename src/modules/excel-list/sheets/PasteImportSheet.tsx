import { useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetTextArea } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { useImportClassRosterMutation } from '../../../system/query/useStudioQueries';
import { studentInputSchema } from '../../../system/schemas/studioSchemas';
import { rosterImportNotice } from '../../../system/sqlite/rosterImportActions';
import type { ClassRecord } from '../../../system/sqlite/types';
import { parseExcelOrCsvText } from '../excelParser';
import { formErrorMessage, isTeacherClassName } from './formHelpers';

/** Excel / e-Okul tablosundan kopyalanan öğrenci veya öğretmen satırlarını doğrulayıp seçili şubeye aktarır. */
export function PasteImportSheet({ controller, activeClass }: {
  controller: OriginSheetController;
  activeClass: ClassRecord | undefined;
}) {
  const addMut = useImportClassRosterMutation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isStaff = isTeacherClassName(activeClass?.name);
  const openKey = controller.isOpen ? (activeClass?.id ?? 'open') : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setText('');
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const submit = async () => {
    if (!activeClass) return;
    setError(null);
    try {
      const rows = parseExcelOrCsvText(text, { isStaff }).map((row, idx) => {
        const parsed = studentInputSchema.safeParse(row);
        if (!parsed.success) {
          throw new Error(`${idx + 1}. satır: ${parsed.error.issues[0]?.message ?? 'Geçersiz kayıt verisi.'}`);
        }
        return parsed.data;
      });
      const res = await addMut.mutateAsync({ classId: activeClass.id, rows });
      notifyStudio(rosterImportNotice(res), 'success');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Excel'den Yapıştır"
      description={activeClass ? `Satırlar ${activeClass.name} listesine aktarılır. Hatalı satır varsa hiçbiri yazılmaz.` : undefined}
      width={520}
      submitLabel="Doğrula ve Aktar"
      busy={addMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <SheetTextArea
        label={isStaff ? 'Öğretmen satırları' : 'Öğrenci satırları'}
        required
        autoFocus
        rows={8}
        value={text}
        onChange={setText}
        placeholder={isStaff ? 'Kemal;Demir;Matematik Öğretmeni\nAyşe;Kaya;Sınıf Öğretmeni' : '145;Zeynep;Korkmaz\n149;Burak;Aydın'}
        hint={
          isStaff
            ? 'Sıra: ad, soyad, görevi (isteğe bağlı). Noktalı virgül, virgül veya sekme ile ayrılabilir.'
            : 'Sıra: okul no, ad, soyad. Noktalı virgül, virgül veya sekme ile ayrılabilir.'
        }
      />
    </OriginSheet>
  );
}
