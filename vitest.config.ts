import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Unit tests use node env; component tests use // @vitest-environment jsdom
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules',
        '.next',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
