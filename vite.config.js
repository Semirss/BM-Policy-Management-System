import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/personal-accidents': {
                target: 'https://p83ik3w242.execute-api.eu-north-1.amazonaws.com/dev',
                changeOrigin: true,
            }
        }
    }
})
