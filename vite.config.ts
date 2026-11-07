import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// base relativa para o app funcionar em qualquer endereço (GitHub Pages, subpasta, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Páginas de captação (HTML puro, carregam rápido e o Google lê o texto).
      input: {
        main: resolve(__dirname, 'index.html'),
        personalOnline: resolve(__dirname, 'personal-trainer-online/index.html'),
      },
    },
  },
})
