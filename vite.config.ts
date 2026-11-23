import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Not: Mevcut yayındaki hazırlık sayfası 'public/' klasöründe ayrı tutulduğu için
// masaüstü uygulamasının statik varlık klasörü 'static' olarak ayarlanmıştır.
export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('motion')) return 'vendor-motion';
          if (id.includes('@tanstack') || id.includes('zod') || id.includes('fflate')) return 'vendor-data';
          if (id.includes('react')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
