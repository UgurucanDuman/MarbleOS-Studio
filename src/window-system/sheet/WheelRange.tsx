import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';

type WheelRangeProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'> & {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  onWheelEnd?: () => void;
};

const PIXELS_PER_STEP = 40;
const WHEEL_IDLE_MS = 180;

export function WheelRange({ value, min, max, step, onValueChange, onWheelEnd, disabled, ...props }: WheelRangeProps) {
  const enabled = useWindowWorkEnabled();
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef({ value, onValueChange, onWheelEnd });
  latest.current = { value, onValueChange, onWheelEnd };

  useEffect(() => {
    const input = ref.current;
    if (!input || !enabled || disabled) return;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let pixels = 0;
    let pending = false;

    const finishWheel = () => {
      if (idle !== undefined) clearTimeout(idle);
      pixels = 0;
      if (pending) latest.current.onWheelEnd?.();
      pending = false;
    };
    const update = () => {
      frame = 0;
      const steps = Math.trunc(pixels / PIXELS_PER_STEP);
      if (!steps) return;
      pixels -= steps * PIXELS_PER_STEP;
      const current = latest.current.value;
      const next = Math.min(max, Math.max(min, min + (Math.round((current - min) / step) + steps) * step));
      if (next === current) return;
      pending = true;
      latest.current.value = next;
      latest.current.onValueChange(next);
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.cancelable || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : -event.deltaY;
      if (!delta) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? PIXELS_PER_STEP : event.deltaMode === 2 ? PIXELS_PER_STEP * 3 : 1;
      pixels += delta * unit;
      if (!frame) frame = requestAnimationFrame(update);
      if (idle !== undefined) clearTimeout(idle);
      idle = setTimeout(finishWheel, WHEEL_IDLE_MS);
    };

    input.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      input.removeEventListener('wheel', onWheel);
      if (frame) cancelAnimationFrame(frame);
      finishWheel();
    };
  }, [enabled, disabled, min, max, step]);

  return (
    <input
      {...props}
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
    />
  );
}
