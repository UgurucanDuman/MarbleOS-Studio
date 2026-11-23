import { DEFAULT_PRINT_FONT_PT, isPrintFontPoint, PRINT_FONT_POINTS, type PrintFontPoint } from '../../system/storage/printTypography';
import { AppleSelect } from './AppleSelect';

export function PrintFontSelect({ value = DEFAULT_PRINT_FONT_PT, onChange, pointOffset = 0 }: {
  value?: PrintFontPoint;
  onChange: (value: PrintFontPoint) => void;
  pointOffset?: number;
}) {
  return (
    <AppleSelect
      ariaLabel="Baskı yazı puntosu"
      value={String(value)}
      options={PRINT_FONT_POINTS.map((point) => ({
        value: String(point),
        label: `${point + pointOffset} pt`,
        iconHint: 'Punto',
      }))}
      onChange={(value) => {
        const point = Number(value);
        if (isPrintFontPoint(point)) onChange(point);
      }}
    />
  );
}
