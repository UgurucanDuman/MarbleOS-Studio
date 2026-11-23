import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * GÜVENLİK KONTROLÜ: Yazma yapan veya müşteri verisine dokunan her native komut lisansı Rust
 * tarafında (`license.ensure()`) doğrular. Lisans ekranının arkasındaki masaüstünün görünmesi için
 * yalnızca okuma yapan kişiselleştirme komutları ve lisans komutlarının kendisi muaftır.
 */
const UNGATED = new Set([
  'studio_load_personalization',
  'studio_load_desktop_asset',
  'studio_license_status',
  'studio_license_activate',
]);

test('every native data or write command enforces the license in Rust', () => {
  const mainRs = fs.readFileSync(path.join(process.cwd(), 'src-tauri/src/main.rs'), 'utf8');
  const commandRe = /#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-z0-9_]+)\s*\(([\s\S]*?)\n\}/g;
  const gated: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = commandRe.exec(mainRs)) !== null) {
    const [, name, body] = match;
    if (UNGATED.has(name!)) continue;
    expect(body, `${name} must call license.ensure()`).toContain('license.ensure()?;');
    gated.push(name!);
  }
  expect(gated).toContain('studio_save_personalization');
  expect(gated).toContain('studio_save_desktop_asset');
  expect(gated).toContain('studio_delete_desktop_asset');
  expect(gated.length).toBeGreaterThan(14);
});
