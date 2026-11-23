import { useCallback, useEffect, useState } from 'react';
import { listStudioPrinters, type SystemPrinterInfo } from '../../system/desktop/desktopPrinter';
import { notifyStudio } from '../../system/desktop/studioToast';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';

/**
 * İZOLE MODÜL 04 YAZICI KEŞİF KANCASI:
 * Sistem yazıcılarını tarar, varsayılan yazıcıyı seçili tutar ve yenileme durumunu yönetir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function useStudioPrinters() {
  const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const refreshPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const detected = await listStudioPrinters();
      setPrinters(detected);
      setSelectedPrinter((prev) => {
        if (prev && detected.some((p) => p.name === prev)) return prev;
        return detected.find((p) => p.isDefault)?.name ?? detected[0]?.name ?? '';
      });
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    void refreshPrinters();
  }, [refreshPrinters]);

  return { printers, selectedPrinter, setSelectedPrinter, loadingPrinters, refreshPrinters };
}
