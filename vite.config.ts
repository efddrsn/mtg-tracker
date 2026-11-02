import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/event': 'http://localhost:3000',
      '/binder': 'http://localhost:3000',
      '/api/stores': 'http://localhost:3000',
      '/api/prices': 'http://localhost:3000',
      '/api/recommander': {
        target: 'https://recommander.cards',
        changeOrigin: true,
        rewrite: () => '/api/decks/recommend',
      },
    },
  },
})
