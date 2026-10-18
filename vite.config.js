import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules/blockly')) return 'blockly'; if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion'; } } } },
  server: { port: 5173, strictPort: true },
});
