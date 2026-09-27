import { defineConfig } from 'vite-plus';

export default defineConfig({
  root: 'src/ui',
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api/debug': 'http://127.0.0.1:5173',
    },
  },
  build: {
    outDir: '../../dist/debug-ui',
    emptyOutDir: true,
  },
});
