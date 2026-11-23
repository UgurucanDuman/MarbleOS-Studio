import React, { useRef, useState } from 'react';
import { loadDesktopPhotoOriginal, usesDesktopStorage } from '../../../system/desktop/desktopStorage';
import { notifyStudio } from '../../../system/desktop/studioToast';
import {
  useRestoreSchoolBackupMutation,
  useRestoreWorkspaceBackupMutation,
} from '../../../system/query/useSchoolQueries';
import {
  BACKUP_PASSWORD_MAX,
  backupPasswordSchema,
  backupUnlockPasswordSchema,
  ENCRYPTED_BACKUP_FILE_MAX,
} from '../../../system/schemas/backupSchemas';
import { prepareSchoolBackupPackage } from '../../../system/sqlite/schoolBackup';
import {
  decryptSchoolBackup,
  decryptWorkspaceBackup,
  detectBackupKind,
  encryptSchoolBackup,
  encryptWorkspaceBackup,
} from '../../../system/sqlite/schoolBackupCrypto';
import type { StudioDatabaseSnapshot } from '../../../system/sqlite/types';
import { prepareWorkspaceBackupPackage } from '../../../system/sqlite/workspaceBackup';
import { loadBrowserPhoto } from '../../../system/storage/browserWorkspace';
import { AppleSelect } from '../../sheet/AppleSelect';
import { SheetAutoIcon } from '../../sheet/SheetFieldIcons';
import { SheetFieldRow, SheetPasswordField } from '../../sheet/SheetFields';
import { BookIconBackupArchive } from '../icons/SettingsBookIcons';
import {
  BOOK_BACKUP_SCHOOL_EXT,
  BOOK_BACKUP_WORKSPACE_EXT,
  downloadBookFile,
  settingsErrorMessage,
} from '../settingsHelpers';

type ExportScope = 'workspace' | 'school';
type PickedBackup = {
  name: string;
  text: string;
  kind: 'encrypted' | 'encrypted-workspace' | 'legacy-plain';
};

function kindDescription(kind: PickedBackup['kind']): string {
  if (kind === 'encrypted-workspace') return 'Şifreli tüm kasa yedeği';
  if (kind === 'encrypted') return 'Şifreli tekil okul yedeği';
  return 'Eski biçim, şifresiz';
}

export function GeneralBackupPage({ db, onCloseBook }: {
  db: StudioDatabaseSnapshot;
  onCloseBook: () => void;
}) {
  const restoreSchoolMut = useRestoreSchoolBackupMutation();
  const restoreWorkspaceMut = useRestoreWorkspaceBackupMutation();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [scope, setScope] = useState<ExportScope>('workspace');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [exportPw, setExportPw] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [picked, setPicked] = useState<PickedBackup | null>(null);
  const [restorePw, setRestorePw] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const activeTargetSchool =
    db.schools.find((s) => s.id === selectedSchoolId) ??
    db.schools.find((s) => s.id === db.activeSchoolId) ??
    db.schools[0] ??
    null;

  const readAsset = (id: string, expectedHash?: string) =>
    usesDesktopStorage ? loadDesktopPhotoOriginal(id, expectedHash) : loadBrowserPhoto(id);

  const handleExport = async () => {
    setExportError(null);
    const check = backupPasswordSchema.safeParse({ password: exportPw, confirm: exportConfirm });
    if (!check.success) {
      setExportError(check.error.issues[0]?.message ?? 'Parola geçersiz.');
      return;
    }
    setExportBusy(true);
    try {
      if (scope === 'school') {
        if (!activeTargetSchool) throw new Error('Yedeklenecek okul bulunamadı.');
        const pkg = await prepareSchoolBackupPackage(db, activeTargetSchool.id, readAsset);
        const sealed = await encryptSchoolBackup(pkg.json, check.data.password);
        downloadBookFile(pkg.fileName.replace(/\.marbleos-school\.json$/, BOOK_BACKUP_SCHOOL_EXT), sealed);
        notifyStudio(`${activeTargetSchool.name} için şifreli okul yedeği indirildi.`, 'success');
      } else {
        const pkg = await prepareWorkspaceBackupPackage(db, readAsset);
        const sealed = await encryptWorkspaceBackup(pkg.json, check.data.password);
        const outName = pkg.fileName.endsWith(BOOK_BACKUP_WORKSPACE_EXT)
          ? pkg.fileName
          : `${pkg.fileName}${BOOK_BACKUP_WORKSPACE_EXT}`;
        downloadBookFile(outName, sealed);
        notifyStudio('Tüm çalışma alanı şifreli kasa yedeği indirildi.', 'success');
      }
      setExportPw('');
      setExportConfirm('');
    } catch (err) {
      setExportError(settingsErrorMessage(err));
    } finally {
      setExportBusy(false);
    }
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreError(null);
    setPicked(null);
    if (file.size === 0 || file.size > ENCRYPTED_BACKUP_FILE_MAX) {
      setRestoreError('Yedek dosyası boş veya boyut sınırını aşıyor.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = reader.onabort = () => setRestoreError('Yedek dosyası okunamadı.');
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const kind = detectBackupKind(text);
      if (kind === 'unknown') {
        setRestoreError('Bu dosya bir MarbleOS okul veya kasa yedeği değil.');
        return;
      }
      setPicked({ name: file.name, text, kind });
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleRestore = async () => {
    setRestoreError(null);
    if (!picked) {
      setRestoreError('Önce bir yedek dosyası seçin.');
      return;
    }
    setRestoreBusy(true);
    try {
      if (picked.kind === 'encrypted-workspace') {
        const unlock = backupUnlockPasswordSchema.safeParse(restorePw);
        if (!unlock.success) throw new Error(unlock.error.issues[0]?.message ?? 'Parola geçersiz.');
        const plain = await decryptWorkspaceBackup(picked.text, unlock.data);
        await restoreWorkspaceMut.mutateAsync(plain);
        notifyStudio('Tüm çalışma alanı yedeği başarıyla geri yüklendi.', 'success');
      } else {
        let plain = picked.text;
        if (picked.kind === 'encrypted') {
          const unlock = backupUnlockPasswordSchema.safeParse(restorePw);
          if (!unlock.success) throw new Error(unlock.error.issues[0]?.message ?? 'Parola geçersiz.');
          plain = await decryptSchoolBackup(picked.text, unlock.data);
        }
        await restoreSchoolMut.mutateAsync(plain);
        notifyStudio('Okul yedeği başarıyla geri yüklendi.', 'success');
      }
      setPicked(null);
      setRestorePw('');
      onCloseBook();
    } catch (err) {
      setRestoreError(settingsErrorMessage(err));
    } finally {
      setRestoreBusy(false);
    }
  };

  const needsRestorePw = picked?.kind === 'encrypted' || picked?.kind === 'encrypted-workspace';

  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconBackupArchive size={38} /></span>
        <div>
          <h3>Şifreli Yedekleme ve Geri Yükleme Merkezi</h3>
          <p>
            Tüm çalışma alanınızı (<code>{BOOK_BACKUP_WORKSPACE_EXT}</code>) veya tek bir okulu (
            <code>{BOOK_BACKUP_SCHOOL_EXT}</code>) <strong>PBKDF2-SHA256 + AES-256-GCM</strong> ile şifreleyip indirin
            veya geri yükleyin.
          </p>
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Şifreli Yedek Oluştur</h4>
          <span>
            {db.schools.length} okul · {db.classes.length} şube · {db.students.length} kişi · {db.photos.length} fotoğraf
          </span>
        </div>

        <div className="os-book-scope-row" role="radiogroup" aria-label="Yedek kapsamı">
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'workspace'}
            className={`os-book-scope-btn ${scope === 'workspace' ? 'is-active' : ''}`}
            onClick={() => { setExportError(null); setScope('workspace'); }}
          >
            Tüm Çalışma Alanı ({BOOK_BACKUP_WORKSPACE_EXT})
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'school'}
            className={`os-book-scope-btn ${scope === 'school' ? 'is-active' : ''}`}
            onClick={() => { setExportError(null); setScope('school'); }}
          >
            Tekil Okul ({BOOK_BACKUP_SCHOOL_EXT})
          </button>
        </div>

        {scope === 'school' && db.schools.length > 0 && (
          <AppleSelect
            ariaLabel="Yedeklenecek okul"
            value={activeTargetSchool?.id ?? ''}
            options={db.schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, iconHint: 'Okul' }))}
            onChange={setSelectedSchoolId}
          />
        )}

        <SheetFieldRow>
          <SheetPasswordField
            label="Yedek Parolası"
            purpose="new"
            value={exportPw}
            onChange={setExportPw}
            maxLength={BACKUP_PASSWORD_MAX}
            hint="En az 10 karakter; harf + rakam/simge."
          />
          <SheetPasswordField
            label="Parola (tekrar)"
            purpose="new"
            value={exportConfirm}
            onChange={setExportConfirm}
            maxLength={BACKUP_PASSWORD_MAX}
          />
        </SheetFieldRow>
        {exportError && <p role="alert" className="os-book-inline-error">{exportError}</p>}
        <div className="os-book-card-actions">
          <button
            type="button"
            className="os-book-action-btn is-primary"
            disabled={exportBusy || db.schools.length === 0}
            onClick={() => void handleExport()}
          >
            <SheetAutoIcon text="Şifreli Yedeği İndir" size={13.5} />
            {exportBusy
              ? 'Şifreleniyor…'
              : scope === 'school'
                ? 'Şifreli Okul Yedeğini İndir'
                : 'Şifreli Kasa Yedeğini İndir'}
          </button>
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Yedekten Geri Yükle ({BOOK_BACKUP_WORKSPACE_EXT} / {BOOK_BACKUP_SCHOOL_EXT})</h4>
          <span>Başka bilgisayardan veya arşivden şifreli paket aktarımı</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={`${BOOK_BACKUP_SCHOOL_EXT},${BOOK_BACKUP_WORKSPACE_EXT},.json`}
          aria-label="Yedek dosyası"
          onChange={handlePickFile}
        />
        <div className="os-book-file-bar">
          <button type="button" className="os-book-action-btn" onClick={() => fileRef.current?.click()}>
            <SheetAutoIcon text="Dosya Seç" size={13} />
            {picked ? 'Başka Dosya Seç' : 'Yedek Dosyası Seç'}
          </button>
          <span className="os-book-file-label">
            {picked ? `${picked.name} · ${kindDescription(picked.kind)}` : 'Dosya seçilmedi'}
          </span>
        </div>
        {needsRestorePw && (
          <SheetPasswordField
            label="Açma Parolası"
            purpose="current"
            value={restorePw}
            onChange={setRestorePw}
            maxLength={BACKUP_PASSWORD_MAX}
          />
        )}
        {restoreError && <p role="alert" className="os-book-inline-error">{restoreError}</p>}
        <div className="os-book-card-actions">
          <button
            type="button"
            className="os-book-action-btn is-primary"
            disabled={!picked || restoreBusy || restoreSchoolMut.isPending || restoreWorkspaceMut.isPending}
            onClick={() => void handleRestore()}
          >
            <SheetAutoIcon text="Yedeği Geri Yükle" size={13.5} />
            {restoreBusy ? 'Çözülüyor…' : 'Yedeği Geri Yükle'}
          </button>
        </div>
      </div>
    </div>
  );
}
