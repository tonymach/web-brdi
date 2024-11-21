import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => {
  const isProduction = command === 'build'
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: isProduction ? '/web-brdi/' : './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  }
})