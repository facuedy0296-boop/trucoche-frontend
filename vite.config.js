import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  preview: {
    // Railway sirve la app desde su propio dominio; sin esto, Vite bloquea el pedido
    // por seguridad al no reconocer el host.
    allowedHosts: ['trucoche-frontend-production.up.railway.app'],
  },
});
