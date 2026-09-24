import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Test-runner env only (key-value assertions, never logged): load by path, not cwd.
dotenv.config({ path: path.resolve(here, '..', '.env') });
const drillWav = path.resolve(here, 'fixtures/audio/drill-full.wav');

// Deployed runs: BASE_URL=<public https url> (+ optional API_URL, defaults to
// BASE_URL for single-origin deploys). Local runs keep the split dev servers.
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const isDeployed = Boolean(process.env.BASE_URL) && !process.env.BASE_URL.includes('localhost');

export default defineConfig({
  testDir: '.',
  testMatch: /voice-loop.*\.spec\.ts/,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    // Cold starts on free tiers can be slow; allow generous navigation.
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${drillWav}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: isDeployed
    ? undefined
    : [
        {
          command: 'npx tsx server/src/index.ts',
          cwd: '..',
          port: 3001,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'npx vite --port 5173',
          cwd: '../web',
          port: 5173,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
});
