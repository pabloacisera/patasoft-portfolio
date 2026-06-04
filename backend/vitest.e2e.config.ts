import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/integration/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://patasoft:patasoft_dev@localhost:5432/patasoft_test',
    },
  },
});
