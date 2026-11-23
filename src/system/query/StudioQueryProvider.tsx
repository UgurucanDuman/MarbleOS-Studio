import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * İZOLE SİSTEM KATMANI: React Query Sağlayıcısı (src/system/query/StudioQueryProvider.tsx)
 * MarbleOS standartlarına uygun olarak staleTime: 60s ve refetchOnWindowFocus: false ile çalışır.
 */
export const StudioQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

