import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gyeopgyeopi-supply/',  // GitHub Pages repo 이름으로 변경
})
