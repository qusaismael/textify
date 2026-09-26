const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '**/*.spec.cjs', workers: 1, retries: 0, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4181', browserName: 'chromium',
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'python3 -m http.server 4181 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4181/', reuseExistingServer: false, timeout: 15000
  }
});
