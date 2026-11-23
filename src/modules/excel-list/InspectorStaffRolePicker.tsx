import { useId } from 'react';
import { motion } from 'motion/react';
import { springWindowFluid } from '../../system/motion/macosMotion';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';

const ROLE_OPTIONS = [
  { id: '', label: 'Standart', iconText: 'Standart' },
  { id: 'MDR.', label: 'Müdür', iconText: 'Müdür' },
  { id: 'MD.YRD.', label: 'Md. Yrd.', iconText: 'Md. Yrd.' },
  { id: 'REHBER', label: 'Rehber', iconText: 'Rehber' },
];

export function InspectorStaffRolePicker({ role, onSelect }: { role: string; onSelect: (id: string) => void }) {
  const rolePillId = useId();
  return (
    <div className="xl-role-grid" role="tablist" aria-label="Kadro unvanı">
      {ROLE_OPTIONS.map((option) => {
        const active = role === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`xl-role-pill ${active ? 'is-active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            {active && (
              <motion.span
                layoutId={rolePillId}
                layoutDependency={role}
                className="xl-glass-pill"
                transition={springWindowFluid}
                aria-hidden="true"
              />
            )}
            <span className="xl-segment-label">
              <SheetAutoIcon text={option.iconText} size={13.5} />
              <span>{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
