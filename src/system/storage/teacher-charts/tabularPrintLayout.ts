import type { TeacherDocTemplateSpec } from './types';

export const TABLE_SHEET = {
  widthMm: 210,
  marginMm: 7,
  topMm: 27.5,
  footerMm: 16.5,
  panelGapMm: 3.4,
  headerMm: 11.8,
  sequenceMm: 5.5,
  periodMm: 4.4,
} as const;

export function getIdentityDimensions(template: TeacherDocTemplateSpec) {
  const isSok = template.engine === 'tabular-sok';
  if (isSok) {
    return { sequenceMm: 0, identityMm: 35, nameMm: 13.5, periodMm: 0 };
  }
  const stacked = template.identityMode === 'stacked-horizontal';
  if (stacked) {
    return {
      sequenceMm: template.showRowSequenceNumber ? 5.4 : 0,
      identityMm: 30.5,
      nameMm: 0,
      periodMm: template.subRowScheme === 'single-open' ? 0 : 4.2,
    };
  }
  const totalSubCols = template.columnGroups.reduce((acc, g) => acc + g.subHeaders.length, 0);
  if (totalSubCols >= 13) {
    // 15 sütunlu detaylı lise çizelgesi: portre yanındaki boşluğu isim şeridine aktarır
    return {
      sequenceMm: template.showRowSequenceNumber ? 4.8 : 0,
      identityMm: 22.8,
      nameMm: 10.0,
      periodMm: template.subRowScheme === 'single-open' ? 0 : 3.9,
    };
  }
  if (totalSubCols >= 10) {
    return {
      sequenceMm: template.showRowSequenceNumber ? 5.2 : 0,
      identityMm: 25.4,
      nameMm: 11.2,
      periodMm: template.subRowScheme === 'single-open' ? 0 : 4.2,
    };
  }
  return {
    sequenceMm: template.showRowSequenceNumber ? TABLE_SHEET.sequenceMm : 0,
    identityMm: 27.6,
    nameMm: 11.8,
    periodMm: template.subRowScheme === 'single-open' ? 0 : TABLE_SHEET.periodMm,
  };
}

export function teacherSheetHead(schoolName: string, academicYear: string, courseName: string, isSok: boolean) {
  const year = `${academicYear || '2026-2027'} EĞİTİM-ÖĞRETİM YILI`;
  return {
    school: (schoolName.trim() || 'OKUL ADI').toLocaleUpperCase('tr-TR'),
    context: isSok
      ? year
      : `${year} · ${courseName ? courseName.toLocaleUpperCase('tr-TR') : '............................'} DERSİ`,
  };
}

export function estimateBoldTextEm(text: string): number {
  let total = 0;
  for (const ch of text.toLocaleUpperCase('tr-TR')) {
    if (ch === ' ') total += 0.24;
    else if ('Iİ1.-/·:'.includes(ch)) total += 0.30;
    else if ('MW'.includes(ch)) total += 0.76;
    else if ('JLTFEZPS'.includes(ch)) total += 0.51;
    else if (/[0-9]/.test(ch)) total += 0.50;
    else total += 0.58;
  }
  return total;
}

export function identityFontPoints(textLength: number, targetPoints: number, availableMm: number) {
  const estimatedWidth = (textLength * targetPoints * 0.65 * 25.4) / 72;
  return targetPoints * Math.min(1, availableMm / Math.max(estimatedWidth, 0.1));
}

/**
 * Tablo sütun ve alt sütun başlıklarının (Dönem, Ağırlıklı, Performans, Puan, Ödv vb.)
 * hücre kenarına değmeden ve harf kırpmadan ("Dör", "Ağıı" olmadan) tam oturacağı puntoyu hesaplar.
 */
export function fitHeaderCellPoints(
  text: string,
  maxPoints: number,
  cellWidthMm: number,
  allowTwoLineWrap = false,
): number {
  const trimmed = text.trim();
  if (!trimmed) return maxPoints;
  const rawEm = estimateBoldTextEm(trimmed);
  const effectiveEm = allowTwoLineWrap && trimmed.includes(' ') ? rawEm * 0.56 : rawEm * 0.96;
  const safeMm = Math.max(1.2, cellWidthMm - 1.15);
  const fitPt = (safeMm * 72) / Math.max(0.1, effectiveEm * 25.4);
  return Math.max(4.4, Math.min(maxPoints, fitPt));
}

/**
 * 8 pt / 9 pt / 10 pt seçiminde hem kısa hem uzun isimlerin gözle görülür biçimde kademeli
 * büyümesini sağlar; en üst kademede bile hücre sınırını (maxFitPt) asla taşırıp harf kesmez.
 */
export function fitStudentLabelPoints(
  line1: string,
  line2: string,
  targetPoints: number,
  availableMm: number,
): number {
  const maxEm = Math.max(estimateBoldTextEm(line1), estimateBoldTextEm(line2));
  if (maxEm <= 0) return targetPoints;
  const maxFitPt = (availableMm * 72) / Math.max(0.1, maxEm * 25.4);
  const tierFactor = Math.min(1, Math.max(0.76, 0.82 + (targetPoints - 8) * 0.09));
  return Math.max(4.8, Math.min(targetPoints, maxFitPt * tierFactor));
}

function expandLongNameTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok.includes('-') && tok.length > 10) {
      const parts = tok.split('-').filter(Boolean);
      parts.forEach((p, idx) => out.push(idx < parts.length - 1 ? `${p}-` : p));
    } else if (tok.length >= 13) {
      const chunks = Math.ceil(tok.length / 9);
      const step = Math.ceil(tok.length / chunks);
      for (let i = 0; i < tok.length; i += step) {
        const piece = tok.slice(i, i + step);
        out.push(i + step < tok.length ? `${piece}-` : piece);
      }
    } else {
      out.push(tok);
    }
  }
  return out;
}

function partitionTokensMinWidth(tokens: readonly string[], lineCount: number): string[] {
  const n = tokens.length;
  const k = Math.min(Math.max(1, lineCount), n);
  if (k === 1) return [tokens.join(' ')];

  const spanCache = new Map<number, number>();
  const spanEm = (from: number, to: number): number => {
    const key = from * 64 + to;
    const hit = spanCache.get(key);
    if (hit !== undefined) return hit;
    const val = estimateBoldTextEm(tokens.slice(from, to).join(' '));
    spanCache.set(key, val);
    return val;
  };

  // dp[lines][endIdx] = bu dilime kadar oluşan en uzun satırın em genişliği
  const dp: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Infinity));
  const split: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= n; i += 1) dp[1]![i] = spanEm(0, i);

  for (let l = 2; l <= k; l += 1) {
    for (let i = l; i <= n; i += 1) {
      let best = Infinity;
      let bestPrev = l - 1;
      for (let j = l - 1; j < i; j += 1) {
        const cand = Math.max(dp[l - 1]![j]!, spanEm(j, i));
        if (cand < best) {
          best = cand;
          bestPrev = j;
        }
      }
      dp[l]![i] = best;
      split[l]![i] = bestPrev;
    }
  }

  const lines: string[] = [];
  let end = n;
  for (let l = k; l >= 1; l -= 1) {
    const start = l === 1 ? 0 : split[l]![end]!;
    lines.unshift(tokens.slice(start, end).join(' '));
    end = start;
  }
  return lines;
}

export function layoutStudentNameLines(options: {
  studentNumber: string;
  firstName: string;
  lastName: string;
  showStudentNumbers: boolean;
  targetPoints: number;
  availableLengthMm: number;
  availableThicknessMm: number;
  maxLines?: number;
}): { lines: string[]; fontPt: number } {
  const {
    studentNumber, firstName, lastName, showStudentNumbers,
    targetPoints, availableLengthMm, availableThicknessMm, maxLines = 4,
  } = options;
  const prefix = showStudentNumbers ? studentNumber.trim() : '';
  const rawTokens = [prefix, ...firstName.trim().split(/\s+/), ...lastName.trim().split(/\s+/)].filter(Boolean);
  if (rawTokens.length === 0) return { lines: [], fontPt: targetPoints };

  const tierFactor = Math.min(1, Math.max(0.76, 0.82 + (targetPoints - 8) * 0.09));
  const lineHeightFactor = 1.05;
  const comfortableTwoLinePt = targetPoints * 0.74;
  const totalChars = rawTokens.join(' ').length;
  const effMaxLines = totalChars > 34 ? Math.max(maxLines, 5) : maxLines;

  const evaluate = (tokens: string[]) => {
    const cap = Math.min(effMaxLines, tokens.length);
    const evalK = (k: number) => {
      const candidate = partitionTokensMinWidth(tokens, k);
      const maxEm = Math.max(...candidate.map(estimateBoldTextEm));
      const fitLenPt = (availableLengthMm * 72) / Math.max(0.1, maxEm * 25.4);
      const fitThickPt = (availableThicknessMm * 72) / Math.max(0.1, k * lineHeightFactor * 25.4);
      const rawPt = Math.min(fitLenPt, fitThickPt);
      return { lines: candidate, fontPt: Math.max(4.8, Math.min(targetPoints, rawPt * tierFactor)) };
    };
    let best = evalK(1);
    if (cap >= 2) {
      const two = evalK(2);
      if (two.fontPt > best.fontPt + 0.25) best = two;
    }
    if (best.fontPt >= comfortableTwoLinePt) return best;
    for (let k = 3; k <= cap; k += 1) {
      const next = evalK(k);
      if (next.fontPt > best.fontPt + 0.3) best = next;
    }
    return best;
  };

  const base = evaluate(rawTokens);
  if (base.fontPt >= 6.8 || rawTokens.every((t) => t.length < 13 && !t.includes('-'))) return base;
  const expanded = expandLongNameTokens(rawTokens);
  if (expanded.length === rawTokens.length) return base;
  const withSplit = evaluate(expanded);
  return withSplit.fontPt > base.fontPt + 0.3 ? withSplit : base;
}
