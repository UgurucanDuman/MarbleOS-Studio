import type { StudentRecord } from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { RowDeleteIconButton, RowEditIconButton } from './TableActionIcons';

export function StudentRowActions({
  student,
  transferSheet,
  onEdit,
  onDelete,
  onTransfer,
}: {
  student: StudentRecord;
  transferSheet?: OriginSheetController;
  onEdit: (student: StudentRecord, triggerEl: HTMLElement) => void;
  onDelete: (student: StudentRecord, triggerEl: HTMLElement) => void;
  onTransfer: () => void;
}) {
  const fullName = `${student.firstName} ${student.lastName}`;
  const transfer = transferSheet?.trigger(`stu-transfer-${student.id}`);

  return (
    <span className="xl-row-actions">
      <RowEditIconButton
        label={`${fullName} düzenle`}
        aria-haspopup="dialog"
        data-sheet-trigger="visible"
        onClick={(event) => onEdit(student, event.currentTarget)}
      />
      {transfer && (
        <button
          type="button"
          className="xl-icon-btn xl-icon-btn-transfer"
          title="Sınıf Değiştir"
          aria-label={`${fullName} sınıf değiştir`}
          {...transfer}
          onClick={(event) => {
            onTransfer();
            transfer.onClick(event);
          }}
        >
          <SheetAutoIcon text="Şubeye taşı" size={14} />
        </button>
      )}
      <RowDeleteIconButton
        label={`${fullName} sil`}
        aria-haspopup="dialog"
        data-sheet-trigger="visible"
        onClick={(event) => onDelete(student, event.currentTarget)}
      />
    </span>
  );
}
