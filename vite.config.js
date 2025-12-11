// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    // En dev: base = '/'
    // En build: base = '/sistema-citas/' para producción
    base: command === 'build' ? '/sistema-citas/' : '/',
  };
});
