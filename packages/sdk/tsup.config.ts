import { defineConfig } from 'tsup';

/**
 * ESM build is consumed by Next.js / bundlers.
 * The IIFE build (dist/index.iife.js, global `KernSDK`) is the script-tag
 * distribution for real customer websites — loading the SDK must never
 * depend on the customer's build tooling.
 */
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: true,
    minify: true,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'KernSDK',
    outDir: 'dist',
    outExtension: () => ({ js: '.iife.js' }),
    minify: true,
  },
]);
