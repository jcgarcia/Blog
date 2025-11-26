import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["blogfe.eu.ngrok.io"], // Allow the ngrok frontend URL
  },
});
