// vite.games.config.ts
// Builds a single game as a self-contained ES module.
// Usage: GAME=bubblepop vite build --config vite.games.config.ts
// The build:games script loops over all 5 games automatically.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const GAME_PATHS: Record<string, string> = {
  bubblepop: 'src/components/corners/games/BubblePop.tsx',
  tropico: 'src/components/corners/games/Tropico.tsx',
  wordle: 'src/components/corners/games/Wordle.tsx',
  typingtest: 'src/components/corners/games/TypingTest.tsx',
  twentyfortyeight: 'src/components/corners/games/TwentyFortyEight.tsx',
};

const gameId = process.env.GAME;
if (!gameId || !GAME_PATHS[gameId]) {
  throw new Error(`Set GAME env var to one of: ${Object.keys(GAME_PATHS).join(', ')}`);
}

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-games',
    emptyOutDir: false, // don't wipe between games
    lib: {
      entry: resolve(__dirname, GAME_PATHS[gameId]),
      formats: ['es'],
      fileName: () => `${gameId}.mjs`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: '__aero_react',
          'react-dom': '__aero_react_dom',
          'react/jsx-runtime': '__aero_jsx_runtime',
        },
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
