import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against a running stack.
 *
 * These drive a real browser against real HTTP, which is the only way to catch
 * the class of failure this project keeps hitting: a page that renders, reports
 * no error, and shows nothing -- a 404 on a static asset, a doubled path prefix,
 * a fetch aborted by a timeout that was set for a different kind of request.
 * None of those fail a unit test, and all of them reached a screenshot.
 *
 * No webServer here on purpose. The stack is `docker compose up`, and having
 * Playwright start a second copy of the web service would test a different
 * process from the one being debugged.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
