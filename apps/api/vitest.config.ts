import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './src/test/database-url.js'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      // app.ts のDB初期化ミドルウェアもテスト用DBを参照するようにする
      DATABASE_URL: TEST_DATABASE_URL,
      LOG_LEVEL: 'silent',
    },
  },
})
