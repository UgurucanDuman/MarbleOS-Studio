import { createContext, useContext } from 'react';

/**
 * Pencereye bağlı form kartlarının (sheet) render edildiği katman.
 * WindowFrame içerik alanının üstünde, kaydırmadan bağımsız bir kök sağlar.
 */
export const WindowSheetHostContext = createContext<HTMLElement | null>(null);

export function useWindowSheetHost(): HTMLElement | null {
  return useContext(WindowSheetHostContext);
}

