import React, { useState } from 'react';
import { pvcDesignNameSchema } from '../../../system/schemas/pvcCardSchemas';
import { createBlankPvcCustomDesign } from '../../../system/storage/pvc-cards/builtInTemplatesB';
import {
  cloneDesignToCustom,
  PVC_BUILT_IN_TEMPLATES,
  resolvePvcCardDesign,
} from '../../../system/storage/pvc-cards/catalog';
import type {
  PvcCardOrientation,
  PvcCustomDesign,
} from '../../../system/storage/pvc-cards/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetTextField } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';

/**
 * İZOLE MODÜL 03 FORM KARTI (OriginSheet):
 * Fotoğrafçının sıfırdan veya 5 hazır şablondan birini kopyalayarak yeni özel PVC tasarımı
 * oluşturması ya da mevcut özel tasarımını yeniden adlandırması için Apple Pro OriginSheet.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const BASE_OPTIONS = [
  { value: 'blank', label: 'Boş Tuval (Sadece Portre + Temel Alanlar)', iconHint: 'Görsel' },
  ...PVC_BUILT_IN_TEMPLATES.map((tpl) => ({
    value: tpl.id,
    label: `${tpl.name} (${tpl.shortBadge}) kopyala`,
    iconHint: 'Kimlik',
  })),
];

export const NewPvcDesignSheet: React.FC<{
  controller: OriginSheetController;
  renameTarget: PvcCustomDesign | null;
  defaultBaseId?: string;
  onCreate: (design: PvcCustomDesign) => void;
  onRename: (id: string, nextName: string) => void;
}> = ({ controller, renameTarget, defaultBaseId = 'blank', onCreate, onRename }) => {
  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState<string>(defaultBaseId);
  const [orientation, setOrientation] = useState<PvcCardOrientation>('landscape');
  const [error, setError] = useState<string | null>(null);
  const openKey = controller.isOpen ? `${renameTarget?.id ?? 'new'}::${defaultBaseId}` : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setError(null);
    if (renameTarget) {
      setName(renameTarget.name);
      setOrientation(renameTarget.orientation);
    } else {
      setName('');
      setBaseId(defaultBaseId);
      const found = PVC_BUILT_IN_TEMPLATES.find((t) => t.id === defaultBaseId);
      setOrientation(found ? found.orientation : 'landscape');
    }
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const handleSubmit = () => {
    const parsedName = pvcDesignNameSchema.safeParse(name);
    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? 'Geçersiz tasarım adı.');
      return;
    }
    const clean = parsedName.data;

    if (renameTarget) {
      onRename(renameTarget.id, clean);
      controller.close();
      return;
    }

    if (baseId === 'blank') {
      onCreate(createBlankPvcCustomDesign(clean, orientation));
    } else {
      const resolved = resolvePvcCardDesign({ pvcTemplateId: baseId });
      onCreate(cloneDesignToCustom(resolved, clean));
    }
    controller.close();
  };

  return (
    <OriginSheet
      controller={controller}
      title={renameTarget ? 'Özel Tasarımı Yeniden Adlandır' : 'Yeni Özel PVC Kart Tasarımı'}
      description={
        renameTarget
          ? 'Kayıtlı özel kart şablonunuzun görünen adını güncelleyin.'
          : 'Sıfırdan kendi arka planınızı yükleyin ya da 5 hazır şablondan birini kopyalayıp sürükle-bırak ile düzenleyin.'
      }
      width={460}
      submitLabel={renameTarget ? 'Adı Kaydet' : 'Tasarımı Oluştur'}
      error={error}
      onSubmit={handleSubmit}
    >
      <SheetTextField
        label="Tasarım Adı"
        value={name}
        onChange={setName}
        placeholder="Örn: Atatürk Lisesi 2026 Lacivert"
        maxLength={60}
        required
        autoFocus
      />

      {!renameTarget && (
        <>
          <div className="os-sheet-field">
            <span className="os-sheet-label">Başlangıç Kalıbı</span>
            <AppleSelect
              ariaLabel="Başlangıç kart kalıbı"
              value={baseId}
              options={BASE_OPTIONS}
              onChange={(val) => {
                setBaseId(val);
                const found = PVC_BUILT_IN_TEMPLATES.find((t) => t.id === val);
                if (found) setOrientation(found.orientation);
              }}
            />
          </div>

          {baseId === 'blank' && (
            <div className="os-sheet-field">
              <span className="os-sheet-label">Kart Yönü (CR80 ISO/IEC 7810)</span>
              <AppleGlassSegment
                ariaLabel="Özel kart yönü"
                fullWidth
                activeId={orientation}
                items={[
                  { id: 'landscape', label: 'Yatay (85.6×54 mm)', iconHint: 'Kimlik' },
                  { id: 'portrait', label: 'Dikey Yaka (54×85.6 mm)', iconHint: 'Portre' },
                ]}
                onChange={(id) => setOrientation(id as PvcCardOrientation)}
              />
            </div>
          )}
        </>
      )}
    </OriginSheet>
  );
};
