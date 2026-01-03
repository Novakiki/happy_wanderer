import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const loadEnvFile = (filename: string) => {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (!key || key in process.env) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFile('.env.e2e');
loadEnvFile('.env.local');

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const shouldStartServer = process.env.E2E_START_SERVER !== 'false';
const shouldReuseServer = !fixtureEnabled && process.env.E2E_REUSE_SERVER !== 'false';
// Reuse the server only when fixtures are disabled.
// Fixture runs need a clean server instance with the E2E env loaded.

const defaultPort = fixtureEnabled ? 3001 : 3000;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${defaultPort}`;
const parsedBaseUrl = new URL(baseURL);
const webServerPort = parsedBaseUrl.port
  ? Number(parsedBaseUrl.port)
  : defaultPort;
const webServerCommand = fixtureEnabled
  // Fixture runs prefer a stable server (no hot-reload restarts mid-test).
  ? `npm run build && next start -p ${webServerPort}`
  : `next dev -p ${webServerPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/fixtures/global-setup.ts',
  globalTeardown: './tests/e2e/fixtures/global-teardown.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  reporter: 'list',
  webServer: shouldStartServer
    ? {
        command: webServerCommand,
        port: webServerPort,
        reuseExistingServer: shouldReuseServer,
        // Builds can take longer than dev startup.
        timeout: fixtureEnabled ? 180_000 : 60_000,
        env: {
          ...process.env,
          PORT: String(webServerPort),
        },
      }
    : undefined,
});
