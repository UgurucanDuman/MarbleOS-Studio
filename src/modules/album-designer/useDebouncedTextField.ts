import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * İzole Modül 03 yardımcısı: Metin alanında 60fps anlık yazım sağlarken
 * her tuş vuruşunda SQLite/IndexedDB yazımı yapılmasını önler (`120ms` debounce + `blur` anında kayıt).
 */
export function useDebouncedTextField(
  committedValue: string,
  onCommit: (nextValue: string) => void,
  delayMs = 120,
) {
  const [draft, setDraft] = useState(committedValue);
  const [lastSynced, setLastSynced] = useState(committedValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  if (committedValue !== lastSynced && pendingRef.current === null) {
    setLastSynced(committedValue);
    setDraft(committedValue);
  }

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      const val = pendingRef.current;
      pendingRef.current = null;
      setLastSynced(val);
      onCommitRef.current(val);
    }
  }, []);

  const onChange = useCallback(
    (nextValue: string) => {
      setDraft(nextValue);
      pendingRef.current = nextValue;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => () => flush(), [flush]);

  return { value: draft, onChange, onBlur: flush };
}
