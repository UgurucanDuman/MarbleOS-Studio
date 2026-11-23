import { cleanup, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, expect, test } from 'vitest';
import { activationCodeInputSchema, productKeyInputSchema } from '../system/desktop/desktopLicense';
import { LicenseGate } from './LicenseGate';

MotionGlobalConfig.skipAnimations = true;
afterEach(() => cleanup());

test('license input schemas bound length and characters before reaching the native verifier', () => {
  expect(productKeyInputSchema.safeParse('MOS-ABCDEF-GHJKM-NPQRS-TVWXY-Z0123').success).toBe(true);
  expect(productKeyInputSchema.safeParse('kısa').success).toBe(false);
  expect(productKeyInputSchema.safeParse('MOS-ABCDEF-GHJKM-NPQRS-TVWXY-Z012;').success).toBe(false);
  expect(productKeyInputSchema.safeParse('A'.repeat(65)).success).toBe(false);
  expect(activationCodeInputSchema.safeParse('A'.repeat(103)).success).toBe(true);
  expect(activationCodeInputSchema.safeParse('A'.repeat(40)).success).toBe(false);
  expect(activationCodeInputSchema.safeParse(`${'A'.repeat(102)}<`).success).toBe(false);
});

test('license gate shows the machine code and the activation entry points, and a checking state before status loads', () => {
  const { rerender } = render(<LicenseGate license={{ checked: false, activated: false, machineCode: '' }} />);
  expect(screen.getByText('Lisans denetleniyor…')).toBeTruthy();

  rerender(<LicenseGate license={{ checked: true, activated: false, machineCode: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01' }} />);
  expect(screen.getByText('MarbleOS Studio Lisansı')).toBeTruthy();
  expect(screen.getByText('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Makine Kodunu Kopyala/i })).toBeTruthy();
  expect((screen.getByRole('button', { name: /Lisansı Etkinleştir/i }) as HTMLButtonElement).disabled).toBe(false);

  rerender(<LicenseGate license={{ checked: true, activated: false, machineCode: '' }} />);
  expect(screen.getByText(/Windows kimliği okunamadı/i)).toBeTruthy();
  expect((screen.getByRole('button', { name: /Lisansı Etkinleştir/i }) as HTMLButtonElement).disabled).toBe(true);
});
