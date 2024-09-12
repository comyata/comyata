import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: process.env.PORT ? Number(process.env.PORT) : 3000,
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
})
