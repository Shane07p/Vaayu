import { test, expect, type ConsoleMessage, type Page, type Request } from "@playwright/test";

/**
 * Every page loads, and loads everything it asks for.
 *
 * The failures this project has actually shipped were all invisible to the
 * server: the map style 404ing because the Docker image never copied `public/`,
 * every browser fetch 404ing on a doubled `/api` prefix, a read timeout aborting
 * a request that was working. In all three the page returned 200 and rendered a
 * blank panel. So the assertion is not "the page loaded" -- it is "nothing the
 * page requested failed, and nothing was logged as an error".
 */

type PageFailures = {
  consoleErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

/** Attaches listeners before navigation, so nothing early is missed. */
function watch(page: Page): PageFailures {
  const failures: PageFailures = { consoleErrors: [], failedRequests: [], badResponses: [] };

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") {
      failures.consoleErrors.push(message.text());
    }
  });

  page.on("requestfailed", (request: Request) => {
    // An aborted request is usually our own AbortController firing on unmount,
    // not a failure worth reporting.
    const failure = request.failure()?.errorText ?? "";
    if (failure.includes("ERR_ABORTED") || failure.includes("net::ERR_ABORTED")) return;
    failures.failedRequests.push(`${request.method()} ${request.url()} -- ${failure}`);
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return failures;
}

const CITIZEN_ROUTES = ["/", "/aqi", "/rankings", "/report"];

for (const route of CITIZEN_ROUTES) {
  test(`${route} loads without a failed request or console error`, async ({ page }) => {
    const failures = watch(page);

    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status(), `${route} returned a non-2xx`).toBeLessThan(400);

    await page.screenshot({
      path: `e2e/screenshots/${route === "/" ? "home" : route.slice(1)}.png`,
      fullPage: true,
    });

    expect(failures.badResponses, `${route} requested resources that failed`).toEqual([]);
    expect(failures.failedRequests, `${route} had network failures`).toEqual([]);
    expect(failures.consoleErrors, `${route} logged console errors`).toEqual([]);
  });
}
