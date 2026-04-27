import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Carga las variables de entorno según el modo (development/production)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: parseInt(env.VITE_PORT || '80'),
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://backend:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    define: {
      'process.env': {},
    },
  };
});