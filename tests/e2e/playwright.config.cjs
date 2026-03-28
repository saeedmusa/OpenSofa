const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3285',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },
  webServer: {
    command: 'npm run start',
    cwd: path.resolve(__dirname, '..', '..'),
    port: 3285,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      E2E_TEST: 'true',
      NODE_ENV: 'test',
    },
  },
});
