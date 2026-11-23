import { useCallback, useMemo, useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import {
  cloneDesignToCustom,
  createNewPvcElement,
  DEFAULT_PVC_TEMPLATE_ID,
} from '../../../system/storage/pvc-cards/catalog';
import { scalePvcSideToSize } from '../../../system/storage/pvc-cards/elementFactory';
import {
  PVC_CUSTOM_DESIGN_LIMITS,
  pvcCardDimensions,
  type PvcCardElement,
  type PvcCardSide,
  type PvcCustomDesign,
} from '../../../system/storage/pvc-cards/types';
import {
  applySideElementAction,
  resolveDesignWithLivePreview,
  type PvcLiveSliderPreview,
} from './pvcDesignOps';
import type { PvcPaletteToolPayload } from './PvcToolboxPanel';
import { usePvcEditorShortcuts } from './usePvcEditorShortcuts';

export type { PvcLiveSliderPreview };

/**
 * İZOLE MODÜL 03 HOOK: PVC Kart Tasarımı Mutasyon, Geri Al / İleri Al
 * ve 60 FPS Sıfır-Kasma Canlı Slider Önizleme Kontrolcüsü.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function usePvcDesignController(options: {
  albumConfig: AlbumTemplateConfig;
  activeSide: PvcCardSide;
  canDragEdit: boolean;
  selectedElementId: string | null;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}) {
  const { albumConfig, activeSide, canDragEdit, selectedElementId, setSelectedElementId, onPatchConfig } = options;
  const [undoStack, setUndoStack] = useState<PvcCustomDesign[]>([]);
  const [redoStack, setRedoStack] = useState<PvcCustomDesign[]>([]);
  const [livePreview, setLivePreview] = useState<PvcLiveSliderPreview | null>(null);

  const customDesigns = useMemo(() => albumConfig.pvcCustomDesigns ?? [], [albumConfig.pvcCustomDesigns]);

  const activeDesign = useMemo(
    () => resolveDesignWithLivePreview(albumConfig, activeSide, livePreview),
    [albumConfig, activeSide, livePreview],
  );

  const activeCustomDesign = useMemo(
    () => (activeDesign.isCustom ? customDesigns.find((d) => d.id === activeDesign.id) ?? null : null),
    [activeDesign.id, activeDesign.isCustom, customDesigns],
  );

  const activeElements = activeSide === 'back' ? activeDesign.back.elements : activeDesign.front.elements;

  const commitAlbumPatch = useCallback(
    (patch: Partial<AlbumTemplateConfig>) => {
      setLivePreview(null);
      onPatchConfig(patch);
    },
    [onPatchConfig],
  );

  const createCustom = useCallback(
    (design: PvcCustomDesign, notify = true) => {
      if (customDesigns.length >= PVC_CUSTOM_DESIGN_LIMITS.maxDesigns) {
        notifyStudio('En fazla 15 özel PVC kart tasarımı saklanabilir.', 'error');
        return false;
      }
      setLivePreview(null);
      onPatchConfig({ pvcCustomDesigns: [...customDesigns, design], pvcTemplateId: design.id });
      setUndoStack([]);
      setRedoStack([]);
      if (notify) notifyStudio(`"${design.name}" özel PVC tasarımı oluşturuldu.`, 'success');
      return true;
    },
    [customDesigns, onPatchConfig],
  );

  const mutateActiveDesign = useCallback(
    (updater: (prev: PvcCustomDesign) => PvcCustomDesign) => {
      setLivePreview(null);
      if (activeCustomDesign) {
        setUndoStack((prev) => [...prev.slice(-39), activeCustomDesign]);
        setRedoStack([]);
        const updated = updater(activeCustomDesign);
        onPatchConfig({
          pvcCustomDesigns: customDesigns.map((d) => (d.id === activeCustomDesign.id ? updated : d)),
        });
        return;
      }
      if (customDesigns.length >= PVC_CUSTOM_DESIGN_LIMITS.maxDesigns) {
        notifyStudio('Özel tasarım sınırına (15) ulaşıldı; önce eski bir tasarımı silin.', 'error');
        return;
      }
      const shortBase = activeDesign.name.split('·')[0]!.trim();
      const forked = updater(cloneDesignToCustom(activeDesign, `Özel · ${shortBase}`));
      onPatchConfig({ pvcCustomDesigns: [...customDesigns, forked], pvcTemplateId: forked.id });
      setUndoStack([]);
      setRedoStack([]);
    },
    [activeCustomDesign, activeDesign, customDesigns, onPatchConfig],
  );

  const handleUndo = useCallback(() => {
    if (!activeCustomDesign || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, activeCustomDesign]);
    onPatchConfig({ pvcCustomDesigns: customDesigns.map((d) => (d.id === activeCustomDesign.id ? prev : d)) });
  }, [activeCustomDesign, customDesigns, onPatchConfig, undoStack]);

  const handleRedo = useCallback(() => {
    if (!activeCustomDesign || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((s) => [...s, activeCustomDesign]);
    onPatchConfig({ pvcCustomDesigns: customDesigns.map((d) => (d.id === activeCustomDesign.id ? next : d)) });
  }, [activeCustomDesign, customDesigns, onPatchConfig, redoStack]);

  const addToolToActiveSide = useCallback(
    (payload: PvcPaletteToolPayload, atXMm?: number, atYMm?: number, imageDataUrl?: string) => {
      if (activeElements.length >= PVC_CUSTOM_DESIGN_LIMITS.maxElementsPerSide) {
        notifyStudio('Bir kart yüzünde en fazla 45 katman bulunabilir.', 'error');
        return;
      }
      const created = createNewPvcElement(payload.kind, activeDesign.orientation, {
        fieldKey: payload.fieldKey,
        shapeVariant: payload.shapeVariant,
        imageDataUrl,
        atXMm,
        atYMm,
      });
      mutateActiveDesign((prev) => {
        const sideSpec = activeSide === 'back' ? prev.back : prev.front;
        return { ...prev, updatedAt: new Date().toISOString(), [activeSide]: { ...sideSpec, elements: [...sideSpec.elements, created] } };
      });
      setSelectedElementId(created.id);
    },
    [activeDesign.orientation, activeElements.length, activeSide, mutateActiveDesign, setSelectedElementId],
  );

  const patchElementById = useCallback(
    (elId: string, patch: Partial<PvcCardElement>) => {
      mutateActiveDesign((prev) => {
        const sideSpec = activeSide === 'back' ? prev.back : prev.front;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          [activeSide]: { ...sideSpec, elements: sideSpec.elements.map((el) => (el.id === elId ? { ...el, ...patch } : el)) },
        };
      });
    },
    [activeSide, mutateActiveDesign],
  );

  const handleQuickAction = useCallback(
    (elId: string, action: 'up' | 'down' | 'duplicate' | 'lock' | 'delete') => {
      if (action === 'lock') {
        const target = activeElements.find((e) => e.id === elId);
        if (target) patchElementById(elId, { locked: !target.locked });
        return;
      }
      let nextSel: string | null | undefined;
      mutateActiveDesign((prev) => {
        const res = applySideElementAction(prev, activeSide, elId, action, activeDesign.widthMm, activeDesign.heightMm);
        nextSel = res.nextSelectedId;
        return res.next;
      });
      if (nextSel !== undefined) {
        setSelectedElementId((curr) => (action === 'delete' ? (curr === elId ? null : curr) : nextSel!));
      }
    },
    [activeDesign.heightMm, activeDesign.widthMm, activeElements, activeSide, mutateActiveDesign, patchElementById, setSelectedElementId],
  );

  const deleteCustomDesign = useCallback(
    (id: string) => {
      setLivePreview(null);
      onPatchConfig({
        pvcCustomDesigns: customDesigns.filter((d) => d.id !== id),
        ...(albumConfig.pvcTemplateId === id ? { pvcTemplateId: DEFAULT_PVC_TEMPLATE_ID } : {}),
      });
      setSelectedElementId(null);
    },
    [albumConfig.pvcTemplateId, customDesigns, onPatchConfig, setSelectedElementId],
  );

  const changeCardSize = useCallback(
    (widthMm: number, heightMm: number) => {
      if (activeDesign.isCustom) {
        mutateActiveDesign((prev) => {
          const base = pvcCardDimensions(prev.orientation);
          const fromW = prev.widthMm ?? base.widthMm;
          const fromH = prev.heightMm ?? base.heightMm;
          return {
            ...prev,
            widthMm,
            heightMm,
            orientation: heightMm > widthMm ? 'portrait' : 'landscape',
            front: scalePvcSideToSize(prev.front, fromW, fromH, widthMm, heightMm),
            back: scalePvcSideToSize(prev.back, fromW, fromH, widthMm, heightMm),
            updatedAt: new Date().toISOString(),
          };
        });
      } else {
        commitAlbumPatch({ pvcCardWidthMm: widthMm, pvcCardHeightMm: heightMm });
      }
    },
    [activeDesign.isCustom, commitAlbumPatch, mutateActiveDesign],
  );

  usePvcEditorShortcuts({
    enabled: canDragEdit,
    elements: activeElements,
    selectedElementId,
    onClearSelection: useCallback(() => setSelectedElementId(null), [setSelectedElementId]),
    onUndo: handleUndo,
    onRedo: handleRedo,
    onQuickAction: handleQuickAction,
    onNudge: patchElementById,
  });

  return {
    customDesigns, activeDesign, activeElements,
    canUndo: undoStack.length > 0, canRedo: redoStack.length > 0,
    setLivePreview, commitAlbumPatch, createCustom, mutateActiveDesign, changeCardSize,
    handleUndo, handleRedo, addToolToActiveSide, patchElementById, handleQuickAction, deleteCustomDesign,
  };
}
