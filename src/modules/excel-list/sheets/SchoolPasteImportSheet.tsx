import { useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetTextArea } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { useAddSchoolsBatchMutation } from '../../../system/query/useSchoolQueries';
import { parseSchoolExcelOrCsvText } from '../schoolExcelParser';
import { formErrorMessage } from './formHelpers';

/** Excel / MEB kurum listesinden kopyalanan okul satırlarını doğrulayıp toplu ekler. */
export function SchoolPasteImportSheet({ controller, onImported }: {
  controller: OriginSheetController;
  onImported?: () => void;
}) {
  const addMut = useAddSchoolsBatchMutation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (controller.isOpen && !wasOpen) {
    setWasOpen(true);
    setText('');
    setError(null);
  } else if (!controller.isOpen && wasOpen) {
    setWasOpen(false);
  }

  const submit = async () => {
    setError(null);
    try {
      const rows = parseSchoolExcelOrCsvText(text);
      const count = await addMut.mutateAsync({ rows });
      notifyStudio(`${count} okul listeye aktarıldı.`, 'success');
      controller.close();
      onImported?.();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Excel'den Okul Aktar"
      description="Excel veya MEB listesinden kopyaladığınız okullar sıra kodu verilerek toplu kaydedilir."
      width={520}
      submitLabel="Okulları Aktar"
      busy={addMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <SheetTextArea
        label="Okul satırları"
        required
        autoFocus
        rows={8}
        value={text}
        onChange={setText}
        placeholder={
          '000123;Atatürk İlkokulu;Merkez Mah.;Pazartesi çekim\n000456;Cumhuriyet Ortaokulu;Yeni Mah.\nİnönü Anadolu Lisesi'
        }
        hint="Tek sütun (Okul Adı) veya çoklu sütun (Kurum Kodu ; Okul Adı ; Adres ; Notlar) yapıştırabilirsiniz."
      />
    </OriginSheet>
  );
}

