import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/gpu-power-intelligence-system/',
    server: {
        port: 5173,
        proxy: {
            '/stream': 'http://localhost:8001'
        }
    }
})
