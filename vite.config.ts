import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa para o app funcionar em qualquer endereço (GitHub Pages, subpasta, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
})
