import { defineConfig, type Plugin, type Rollup } from 'vite'
import react from '@vitejs/plugin-react'

const buildVersion = Date.now().toString(36);

function swBuildVersionPlugin(): Plugin {
  return {
    name: 'sw-build-version',
    enforce: 'post',
    generateBundle(_options: Rollup.NormalizedOutputOptions, bundle: Rollup.OutputBundle) {
      const swFile = bundle['sw.js'];
      if (swFile && swFile.type === 'asset') {
        swFile.source = (swFile.source as string).replace('__BUILD_VERSION__', buildVersion);
      }
    },
    transformIndexHtml(html: string) {
      return html.replace('__BUILD_VERSION__', buildVersion);
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildVersionPlugin()],
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3285',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3285',
        ws: true,
      },
      '/health': {
        target: 'http://localhost:3285',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../../dist/web/frontend',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
