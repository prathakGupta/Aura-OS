// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Safely shim process.env without breaking React
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env': {} 
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': { target: 'http://localhost:8000', changeOrigin: true },
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8000', ws: true, changeOrigin: true },
    },
  },
});

// // vite.config.js
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   define: {
//     'process.env': {} // This prevents the crash from Node-based libraries
//   },
//   server: {
//     port: 5173,
//     proxy: {
//       // Proxy API calls to our Node backend so CORS never bites during dev
//       '/api': {
//         target: 'http://localhost:5001',
//         changeOrigin: true,
//       },
//       // Proxy WebSocket to Deepanshu's Python backend
//       '/ws': {
//         target: 'ws://localhost:8000',
//         ws: true,
//         changeOrigin: true,
//       },
//     },
//   },
// });