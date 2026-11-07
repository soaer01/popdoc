import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The Express API will live on :4000 later; requests to /api are proxied there.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
