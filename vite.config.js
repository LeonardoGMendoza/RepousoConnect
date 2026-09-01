import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/RepousoConnect/',
  plugins: [react()],
  
  build: {
    target: ['es2020', 'safari13', 'ios13']
  }
})

