import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Todo lo que empiece con /api se redirige al backend, así el frontend
      // puede llamar a fetch('/api/...') sin preocuparse por el puerto del backend.
      '/api': 'http://localhost:4000',
    },
  },
});
