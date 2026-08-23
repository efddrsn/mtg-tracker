import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/recommander': {
        target: 'https://recommander.cards',
        changeOrigin: true,
        rewrite: () => '/api/decks/recommend',
      },
    },
  },
})
