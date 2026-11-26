import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { leaflet: ['leaflet'], supabase: ['@supabase/supabase-js'], react: ['react', 'react-dom'] } },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
} as never);
