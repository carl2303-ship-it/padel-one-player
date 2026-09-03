import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // Separa dependências de terceiros (raramente mudam) do código da app
        // (muda a cada deploy). Assim, depois de um deploy, o browser do
        // utilizador só tem de descarregar o chunk da app — o vendor.js
        // fica em cache do deploy anterior. Reduz dados/tempo em updates.
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
