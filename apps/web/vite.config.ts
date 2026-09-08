import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Le o .env da raiz do monorepo: um arquivo so para os tres processos.
  // Apenas variaveis VITE_* chegam ao bundle - segredo nenhum vaza para o browser.
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
});
