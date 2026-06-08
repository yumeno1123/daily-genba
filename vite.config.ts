import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/daily-genba/', // 重要：リポジトリ名と一致させる
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
