import { createContext, useContext } from 'react';

export const WindowWorkContext = createContext(true);

export function useWindowWorkEnabled() {
  return useContext(WindowWorkContext);
}
