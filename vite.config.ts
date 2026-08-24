import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    // hls.js is ~574kB minified but gzips to ~179kB; raise limit slightly to avoid noise.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Split vendor code to keep the main chunk stable and cache-friendly.
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor';
          if (id.includes('node_modules/react')) return 'vendor';
          if (id.includes('node_modules/lucide-react')) return 'ui';
          if (id.includes('node_modules/zustand')) return 'state';
          if (id.includes('node_modules/zod')) return 'validation';
          return undefined;
        },
      },
    },
  },
});
