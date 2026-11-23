import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

/**
 * GÜVENLİK & BÜTÜNLÜK KONTROLÜ:
 * `src-tauri/src/main.rs` içindeki her `#[tauri::command]` fonksiyonunun hem `src-tauri/build.rs`
 * manifestinde hem de `src-tauri/capabilities/studio.json` ACL listesinde eksiksiz yer aldığını doğrular.
 */
test('every Tauri command in main.rs is declared in build.rs manifest and studio.json ACL', () => {
  const root = process.cwd();
  const mainRs = fs.readFileSync(path.join(root, 'src-tauri/src/main.rs'), 'utf8');
  const buildRs = fs.readFileSync(path.join(root, 'src-tauri/build.rs'), 'utf8');
  const capJson = JSON.parse(
    fs.readFileSync(path.join(root, 'src-tauri/capabilities/studio.json'), 'utf8'),
  ) as { permissions: string[] };

  const commandRe = /#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-z0-9_]+)/g;
  const commands: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = commandRe.exec(mainRs)) !== null) {
    commands.push(match[1]!);
  }

  expect(commands.length).toBeGreaterThan(10);
  expect(commands).toContain('studio_pick_photo_folder');

  for (const cmd of commands) {
    expect(buildRs, `${cmd} is missing from src-tauri/build.rs`).toContain(`"${cmd}"`);
    const perm = `allow-${cmd.replace(/_/g, '-')}`;
    expect(capJson.permissions, `${perm} is missing from src-tauri/capabilities/studio.json`).toContain(perm);
  }

  // Kurulum sihirbazı (installer-app) ACL eşlemesini de doğrula
  const instMain = fs.readFileSync(path.join(root, 'src-tauri/installer-app/src/main.rs'), 'utf8');
  const instBuild = fs.readFileSync(path.join(root, 'src-tauri/installer-app/build.rs'), 'utf8');
  const instCap = JSON.parse(
    fs.readFileSync(path.join(root, 'src-tauri/installer-app/capabilities/installer.json'), 'utf8'),
  ) as { permissions: string[] };
  commandRe.lastIndex = 0;
  const instCommands: string[] = [];
  while ((match = commandRe.exec(instMain)) !== null) instCommands.push(match[1]!);
  expect(instCommands.length).toBeGreaterThanOrEqual(6);
  for (const cmd of instCommands) {
    expect(instBuild, `${cmd} is missing from installer-app/build.rs`).toContain(`"${cmd}"`);
    const perm = `allow-${cmd.replace(/_/g, '-')}`;
    expect(instCap.permissions, `${perm} is missing from installer-app/capabilities/installer.json`).toContain(perm);
  }
});
