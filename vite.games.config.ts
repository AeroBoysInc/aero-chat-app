// vite.games.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const entryPoints: Record<string, string> = {
  bubblepop: resolve(__dirname, 'src/components/corners/games/BubblePop.tsx'),
  tropico: resolve(__dirname, 'src/components/corners/games/Tropico.tsx'),
  wordle: resolve(__dirname, 'src/components/corners/games/Wordle.tsx'),
  typingtest: resolve(__dirname, 'src/components/corners/games/TypingTest.tsx'),
  twentyfortyeight: resolve(__dirname, 'src/components/corners/games/TwentyFortyEight.tsx'),
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-games',
    emptyOutDir: true,
    lib: {
      entry: entryPoints,
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: '__aero_react',
          'react-dom': '__aero_react_dom',
          'react/jsx-runtime': '__aero_jsx_runtime',
        },
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
