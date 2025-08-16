import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const enableCOI = process.env.VITE_COI === '1'
  const API_TARGET = process.env.VITE_REMOTE_URL || 'https://ms-nfp2p2tq-100039220333-sw.gw.ap-beijing.ti.tencentcs.com/ms-nfp2p2tq'
  const API_TOKEN = process.env.VITE_REMOTE_TOKEN || '3a2838109a4dae7'
  
  return {
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup()
          },
          vite: {
            build: {
              sourcemap: true,
              minify: false,
              outDir: 'dist/electron',
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              sourcemap: 'inline',
              minify: false,
              outDir: 'dist/electron',
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        }
      ]),
      renderer(),
      {
        name: 'capture-api-post-body',
        configureServer(server) {
          server.middlewares.use((req: any, _res, next) => {
            // 仅捕获代理到 /api 的 POST 请求
            if (req.method === 'POST' && typeof req.url === 'string' && req.url.startsWith('/api')) {
              let buf = ''
              req.on('data', (chunk: any) => (buf += chunk))
              req.on('end', () => {
                req.rawBody = buf
                const ct = req.headers['content-type'] || ''
                if (typeof ct === 'string' && ct.includes('application/json')) {
                  try { req.body = buf ? JSON.parse(buf) : {} } catch {}
                }
                next()
              })
            } else {
              next()
            }
          })
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: false
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
    },
    server: {
      host: true,
      headers: enableCOI
        ? {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin'
          }
        : undefined,
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req: any) => {
              // 携带多种鉴权方式，兼容不同后端网关
              try {
                const u = new URL((proxyReq as any).path || proxyReq.path, API_TARGET)
                u.searchParams.set('token', API_TOKEN)
                ;(proxyReq as any).path = u.pathname + u.search
              } catch {}
              proxyReq.setHeader('Authorization', `Bearer ${API_TOKEN}`)
              proxyReq.setHeader('X-Token', API_TOKEN)
              
              // 调试请求体传递
              console.log('Original Request:', {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body,
                rawBody: req.rawBody
              });

              // 确保请求体正确传递（优先使用 rawBody）。此处不强制 JSON，透传为表单也可
              if (req.method === 'POST') {
                const bodyData = (req as any).rawBody ?? (req.body ? JSON.stringify(req.body) : '');
                console.log('Forwarding request body:', bodyData);
                
                if (bodyData) {
                  // 复用来访的 content-type
                  const incomingCT = req.headers['content-type']
                  if (incomingCT) {
                    proxyReq.setHeader('Content-Type', incomingCT as string)
                  }
                  // 移除可能存在的原 Content-Length 以避免冲突
                  try { (proxyReq as any).removeHeader?.('content-length') } catch {}
                  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                  proxyReq.write(bodyData);
                }
              }
            });

            proxy.on('proxyRes', (proxyRes, req) => {
              let upstreamBody = ''
              proxyRes.on('data', (chunk) => { upstreamBody += chunk })
              proxyRes.on('end', () => {
                console.log('Upstream Response:', {
                  status: proxyRes.statusCode,
                  headers: proxyRes.headers,
                  url: (req as any).url,
                  body: upstreamBody
                })
              })
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
            });
          }
        }
      }
  }
}) 