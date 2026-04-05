// vite.games.config.ts
// Builds a single game as a self-contained ES module.
// Usage: GAME=bubblepop vite build --config vite.games.config.ts
// The build:games script loops over all 5 games automatically.
import { defineConfig, type Plugin } from 'vite';
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

/**
 * Rollup plugin that rewrites bare React import statements to global variable
 * lookups. ES module format ignores rollupOptions.output.globals — those only
 * work for UMD/IIFE. Since the game bundles are loaded via blob URLs, bare
 * specifiers like "react" can't be resolved by the browser's module loader.
 */
function externalsToGlobals(): Plugin {
  const map: Record<string, string> = {
    'react': 'window.__aero_react',
    'react-dom': 'window.__aero_react_dom',
    'react/jsx-runtime': 'window.__aero_jsx_runtime',
  };
  return {
    name: 'externals-to-globals',
    renderChunk(code) {
      let result = code;
      for (const [mod, global] of Object.entries(map)) {
        const escaped = mod.replace(/[/]/g, '\\/');
        // import Default, { a, b as c } from "mod"
        result = result.replace(
          new RegExp(`import\\s+(\\w+)\\s*,\\s*\\{([^}]+)\\}\\s*from\\s+["']${escaped}["']`, 'g'),
          `const $1 = ${global}; const {$2} = ${global}`,
        );
        // import Foo from "mod"
        result = result.replace(
          new RegExp(`import\\s+(\\w+)\\s+from\\s+["']${escaped}["']`, 'g'),
          `const $1 = ${global}`,
        );
        // import * as Foo from "mod"
        result = result.replace(
          new RegExp(`import\\s*\\*\\s*as\\s+(\\w+)\\s+from\\s+["']${escaped}["']`, 'g'),
          `const $1 = ${global}`,
        );
        // import { a, b as c } from "mod"
        result = result.replace(
          new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s+["']${escaped}["']`, 'g'),
          `const {$1} = ${global}`,
        );
      }
      return result;
    },
  };
}

export default defineConfig({
  plugins: [react(), externalsToGlobals()],
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
      output: { inlineDynamicImports: true },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
