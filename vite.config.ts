import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` lets the built app run from any folder: GitHub Pages, a file
// server, or inside a desktop shell.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 1200 },
});
