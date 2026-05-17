import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import cssInjected from 'vite-plugin-css-injected-by-js';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    cssInjected(),
    dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true }),
  ],
  build: {
    lib: {
      entry:   resolve(__dirname, 'src/index.ts'),
      name:    'SeenticsComponents',
      formats: ['es', 'umd'],
      fileName: (fmt) => `index.${fmt}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
      output: {
        globals: {
          react:                   'React',
          'react-dom':             'ReactDOM',
          'react/jsx-runtime':     'jsxRuntime',
          '@tanstack/react-query': 'ReactQuery',
        },
      },
    },
    sourcemap: true,
  },
});
