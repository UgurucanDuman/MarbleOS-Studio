import type { PhotoMatchMode } from '../schemas/studioSchemas';
import type { StudentRecord } from './types';

function foldName(value: string) {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function onlyMatch(candidates: Iterable<StudentRecord>) {
  const found = new Set(candidates);
  return found.size === 1 ? found.values().next().value ?? null : null;
}

function indexName(index: Map<string, StudentRecord[]>, name: string, student: StudentRecord) {
  const hits = index.get(name) ?? [];
  hits.push(student);
  index.set(name, hits);
}

function stripClassPrefix(stem: string, className?: string): string | null {
  if (!className) return null;
  const tokens = foldName(className).split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  const pattern = new RegExp(`^\\s*${tokens.join('[-_./\\s]*')}[-_.\\s]+(.+)$`, 'i');
  const match = pattern.exec(stem);
  return match ? match[1].trim() : null;
}

export function createPhotoNameMatcher(students: StudentRecord[], className?: string) {
  const numbers = new Map(students.map((student) => [student.studentNumber, student]));
  const names = new Map<string, StudentRecord[]>();
  const numberedNames = new Map<string, StudentRecord[]>();
  for (const student of students) {
    const { firstName, lastName, studentNumber } = student;
    indexName(names, foldName(`${firstName} ${lastName}`), student);
    indexName(names, foldName(`${lastName} ${firstName}`), student);
    indexName(numberedNames, foldName(`${studentNumber} ${firstName} ${lastName}`), student);
  }

  function byNumber(stem: string) {
    const exact = numbers.get(stem);
    if (exact) return exact;
    if (!/^\d/.test(stem)) return null;
    const hits = Array.from(stem.matchAll(/[_.\-\s]/g)).flatMap((separator) => {
      const student = numbers.get(stem.slice(0, separator.index));
      return student ? [student] : [];
    });
    return onlyMatch(hits);
  }

  function byName(stem: string) {
    const folded = foldName(stem);
    if (!folded) return null;
    const withoutNumber = folded.replace(/^\d+\s+/, '').trim();
    return onlyMatch([
      ...names.get(folded) ?? [],
      ...numberedNames.get(folded) ?? [],
      ...(withoutNumber.length >= 4 ? names.get(withoutNumber) ?? [] : []),
    ]);
  }

  function matchSingle(candidateStem: string, mode: Exclude<PhotoMatchMode, 'sequence'>) {
    if (mode === 'number') return byNumber(candidateStem);
    if (mode === 'name') return byName(candidateStem);
    const number = byNumber(candidateStem);
    const name = byName(candidateStem);
    return number && name && number.id !== name.id ? null : number ?? name;
  }

  return (stem: string, mode: Exclude<PhotoMatchMode, 'sequence'> = 'smart') => {
    const direct = matchSingle(stem, mode);
    if (direct) return direct;
    const stripped = stripClassPrefix(stem, className);
    return stripped ? matchSingle(stripped, mode) : null;
  };
}
