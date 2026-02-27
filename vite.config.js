import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/personal-accidents': {
                target: 'https://k4qpn24fy4.execute-api.eu-north-1.amazonaws.com',
                changeOrigin: true,
            }
        }
    }
})
