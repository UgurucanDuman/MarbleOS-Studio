import { isKutukStaffBranchName } from './staffDirectory';

/**
 * İZOLE SİSTEM YARDIMCISI: Türkçe Sınıf ve Şube Ayrıştırıcı ("9-A" -> "9. Sınıf" + "A Şubesi")
 * Hem kapak özetinde hem her sınıfın kütük sayfası başlığında sınıf ve şubeyi açıkça gösterir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface ParsedTurkishClassBranch {
  raw: string;
  gradeLabel: string;
  branchLabel: string;
  branchShortCode: string;
  fullLabel: string;
  upperLabel: string;
  chipLabel: string;
}

function titleCaseTr(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  const first = clean[0]!.toLocaleUpperCase('tr-TR');
  const rest = clean.slice(1).toLocaleLowerCase('tr-TR');
  return `${first}${rest}`;
}

function formatBranchToken(rawBranch: string): { branchLabel: string; branchShortCode: string } {
  const stripped = rawBranch
    .trim()
    .replace(/\b(?:şubesi|subesi|şb\.?|sb\.?)$/iu, '')
    .trim();
  if (!stripped) return { branchLabel: '', branchShortCode: '' };
  const code =
    stripped.length <= 4
      ? stripped.toLocaleUpperCase('tr-TR')
      : stripped
          .split(/\s+/)
          .map(titleCaseTr)
          .join(' ');
  return {
    branchLabel: `${code} Şubesi`,
    branchShortCode: code,
  };
}

export function parseTurkishClassBranch(rawName: string): ParsedTurkishClassBranch {
  const raw = rawName.trim();
  if (!raw) {
    return {
      raw: '',
      gradeLabel: 'Sınıf',
      branchLabel: '',
      branchShortCode: '',
      fullLabel: 'Sınıf Belirtilmedi',
      upperLabel: 'SINIF BELİRTİLMEDİ',
      chipLabel: 'Sınıf',
    };
  }

  if (isKutukStaffBranchName(raw)) {
    return {
      raw,
      gradeLabel: 'Öğretmen ve İdare Kadrosu',
      branchLabel: '',
      branchShortCode: '',
      fullLabel: 'Öğretmen ve İdare Kadrosu',
      upperLabel: 'ÖĞRETMEN VE İDARE KADROSU',
      chipLabel: 'Kadro',
    };
  }

  const numericMatch = /^(\d{1,2})\s*(?:\.\s*s[ıi]n[ıi]f)?(?:[-/\s.]+(.+))?$/iu.exec(raw);
  if (numericMatch) {
    const gradeNum = numericMatch[1]!;
    const gradeLabel = `${gradeNum}. Sınıf`;
    const { branchLabel, branchShortCode } = formatBranchToken(numericMatch[2] ?? '');
    const fullLabel = branchLabel ? `${gradeLabel} · ${branchLabel}` : gradeLabel;
    return {
      raw,
      gradeLabel,
      branchLabel,
      branchShortCode,
      fullLabel,
      upperLabel: fullLabel.toLocaleUpperCase('tr-TR'),
      chipLabel: branchShortCode ? `${gradeLabel} / ${branchShortCode}` : gradeLabel,
    };
  }

  const specialMatch = /^(anaokulu|anas[ıi]n[ıi]f[ıi]|haz[ıi]rl[ıi]k(?:\s*s[ıi]n[ıi]f[ıi])?)(?:[-/\s.]+(.+))?$/iu.exec(
    raw,
  );
  if (specialMatch) {
    const prefixLower = specialMatch[1]!.toLocaleLowerCase('tr-TR');
    const gradeLabel = prefixLower.startsWith('haz')
      ? 'Hazırlık Sınıfı'
      : prefixLower.startsWith('anas')
        ? 'Anasınıfı'
        : 'Anaokulu';
    const { branchLabel, branchShortCode } = formatBranchToken(specialMatch[2] ?? '');
    const fullLabel = branchLabel ? `${gradeLabel} · ${branchLabel}` : gradeLabel;
    return {
      raw,
      gradeLabel,
      branchLabel,
      branchShortCode,
      fullLabel,
      upperLabel: fullLabel.toLocaleUpperCase('tr-TR'),
      chipLabel: branchShortCode ? `${gradeLabel} / ${branchShortCode}` : gradeLabel,
    };
  }

  const pretty = raw
    .split(/\s+/)
    .map(titleCaseTr)
    .join(' ');
  const hasSinifWord = /s[ıi]n[ıi]f/iu.test(pretty);
  const fullLabel = hasSinifWord ? pretty : `${pretty} Sınıfı`;
  return {
    raw,
    gradeLabel: fullLabel,
    branchLabel: '',
    branchShortCode: '',
    fullLabel,
    upperLabel: fullLabel.toLocaleUpperCase('tr-TR'),
    chipLabel: pretty,
  };
}

export function summarizeTurkishClassBranches(classNames: readonly string[]): {
  scopeLine: string;
  statValue: string;
} {
  if (classNames.length === 0) {
    return {
      scopeLine: 'Sınıf ve Şube Seçilmedi',
      statValue: '0 Sınıf',
    };
  }

  const parsed = classNames.map(parseTurkishClassBranch);
  if (parsed.length === 1) {
    const single = parsed[0]!;
    return {
      scopeLine: single.fullLabel,
      statValue: single.fullLabel,
    };
  }

  const byGrade = new Map<string, string[]>();
  for (const item of parsed) {
    const list = byGrade.get(item.gradeLabel) ?? [];
    if (item.branchShortCode) list.push(item.branchShortCode);
    byGrade.set(item.gradeLabel, list);
  }

  if (byGrade.size === 1) {
    const [gradeLabel, branches] = [...byGrade.entries()][0]!;
    if (branches.length > 0) {
      const joined = branches.join(', ');
      const suffix = branches.length > 1 ? 'Şubeleri' : 'Şubesi';
      return {
        scopeLine: `${gradeLabel} · ${joined} ${suffix}`,
        statValue: `${gradeLabel} (${joined} ${ branches.length > 1 ? 'Şb.' : 'Şubesi' })`,
      };
    }
  }

  if (byGrade.size <= 4) {
    const segments = [...byGrade.entries()].map(([grade, branches]) => {
      if (branches.length === 0) return grade;
      return `${grade} (${branches.join(', ')} ${branches.length > 1 ? 'Şubeleri' : 'Şubesi'})`;
    });
    return {
      scopeLine: segments.join(' · '),
      statValue: `${parsed.length} Sınıf (${[...byGrade.keys()].join(', ')})`,
    };
  }

  const grades = [...byGrade.keys()];
  return {
    scopeLine: `${grades[0]} – ${grades[grades.length - 1]} · Toplam ${parsed.length} Sınıf ve Şube`,
    statValue: `${parsed.length} Sınıf ve Şube`,
  };
}
