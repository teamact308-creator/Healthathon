import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  base: '/',
  plugins: [react(), federation({
    name: 'care_wholecare_fe', filename: 'remoteEntry.js',
    exposes: {'./manifest': './src/manifest.tsx'},
    shared: {react: {requiredVersion: '^19.1.0'}, 'react-dom': {requiredVersion: '^19.1.0'}},
  })],
  server: {host: '127.0.0.1', port: 4183, strictPort: true},
  preview: {host: '127.0.0.1', port: 4183, strictPort: true, cors: true},
  build: {
    target: 'esnext', cssCodeSplit: false, modulePreload: {polyfill: false}, sourcemap: false,
    rollupOptions: {input: {main: 'index.html', federation: 'federation.html'}},
  },
});
