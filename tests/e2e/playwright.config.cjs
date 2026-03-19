const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3285',
    headless: true,
  },
  webServer: {
    command: 'npm run start',
    port: 3285,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      E2E_TEST: 'true',
    },
  },
});
