import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Top-level path segments actually registered by the backend (see
// yb-vsdc-api/start/routes/**). The frontend calls these paths directly
// (no /api prefix) so it works unchanged whether it's served by Adonis
// itself in production or by this dev server with the proxy below.
const API_ROUTE_PREFIXES = [
  'admin',
  'user',
  'users',
  'config',
  'branches',
  'cash',
  'codes',
  'customers',
  'itemClass',
  'notices',
  'queue',
  'receipt',
  'report',
  'stocks',
  'transactions',
  'purchasecode',
  'ebm',
  'item',
  'items',
  'health',
  'test',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || `http://localhost:${env.VITE_API_PORT || 8000}`
  // The new NestJS backend (backend/) — all its routes live under /infra so
  // they can't collide with the Adonis API_ROUTE_PREFIXES above (e.g. its
  // own /health vs. Adonis's proxied "health" prefix).
  const infraTarget =
    env.VITE_INFRA_API_TARGET || `http://localhost:${env.VITE_INFRA_API_PORT || 3001}`

  const proxy = {
    '/uploads': { target, changeOrigin: true },
    '^/infra(/|$)': { target: infraTarget, changeOrigin: true },
  }
  for (const prefix of API_ROUTE_PREFIXES) {
    // Match the API path exactly or as a sub-path ("/report" or "/report/x"), not as a
    // string prefix — otherwise "/reports/x" (the frontend's own SPA page route) collides
    // with the "/report" API prefix and gets sent to the backend on a hard refresh,
    // returning its stale bundled index.html instead of this dev server's frontend.
    proxy[`^/${prefix}(/|$)`] = { target, changeOrigin: true }
  }

  return {
    plugins: [react()],
    server: { proxy },
  }
})
