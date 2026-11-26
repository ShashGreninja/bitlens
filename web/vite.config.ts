import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { localHelp } from './localHelp'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BITLENS_OPENAI_')
  const help = localHelp(env.BITLENS_OPENAI_API_KEY, env.BITLENS_OPENAI_MODEL)
  return {
    base: './',
    plugins: [react(), {
      name: 'bitlens-local-help',
      configureServer(server) { server.middlewares.use(help) },
      configurePreviewServer(server) { server.middlewares.use(help) },
    }],
    server: { host: '127.0.0.1' },
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  }
})
