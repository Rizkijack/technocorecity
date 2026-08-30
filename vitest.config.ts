/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/hooks/**', 'jsdom'],
      ['**/throttle*', 'jsdom'],
      ['src/components/three/__tests__/**', 'jsdom'],
    ],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/stores/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
