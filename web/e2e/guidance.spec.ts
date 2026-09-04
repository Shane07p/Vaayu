import { expect, test } from "@playwright/test";

/**
 * A figure on its own is not information.
 *
 * Half of the people in India who take no action about air pollution say the
 * reason is that they do not know what action to take (docs/EVIDENCE.md §1.1),
 * and severity presented without an achievable instruction produces avoidance
 * rather than protection (§1.2). So an AQI rendered with no advice beside it is
 * a defect, not a cosmetic gap, and it is easy to reintroduce while making a
 * card look tidy.
 */

/**
 * The United States EPA band names.
 *
 * These were rendered against CPCB-computed numbers, so the band contradicted
 * the figure it labelled: CPCB calls 150 Moderate and the interface called it
 * "Unhealthy for Sensitive Groups"; CPCB calls 350 Very Poor and the interface
 * called it "Hazardous". An Indian reader checking our figure against a
 * government bulletin would have found the two disagreeing.
 *
 * Any of these appearing again means a second scale has been reintroduced. Add
 * to this list; do not remove from it.
 */
const EPA_BAND_NAMES = [
  "Unhealthy for Sensitive Groups",
  "Very Unhealthy",
  "Hazardous",
];

/** Every action sentence the English copy can produce, one per CPCB band. */
const ADVICE_SENTENCES = [
  "Clean air today. A good day to be outside.",
  "Fine to be outside today.",
  "Fine for a walk. Keep hard exercise outdoors short.",
  "Avoid hard exercise outdoors. Shut windows facing traffic.",
  "Stay indoors where you can. Wear an N95 if you're out for long.",
  "Avoid going out. Keep windows shut. Wear an N95 outdoors.",
];

test.describe("the citizen surface tells a reader what to do", () => {
  test("a reading is never shown without advice beside it", async ({ page }) => {
    await page.goto("/aqi");
    // The opening card resolves the nearest reporting station, which is a
    // request, so wait for the figure rather than for load.
    await expect(page.getByRole("button", { name: /What does \d+ mean\?/ })).toBeVisible({
      timeout: 20_000,
    });

    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const advised = ADVICE_SENTENCES.some((sentence) =>
      body.includes(sentence.replace(/\s+/g, " ")),
    );
    expect(advised, `no action sentence found on the page. Body was:\n${body}`).toBe(true);
  });

  test("the scale opens in place, and marks where this reading sits", async ({ page }) => {
    await page.goto("/aqi");
    const expander = page.getByRole("button", { name: /What does \d+ mean\?/ });
    await expect(expander).toBeVisible({ timeout: 20_000 });

    // Closed until asked: the scale is an answer to a question, not chrome.
    await expect(page.getByText("India's CPCB scale. Higher is worse.")).toHaveCount(0);

    await expander.click();

    // All six CPCB bands, named, with the reader still on the same page.
    for (const band of ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]) {
      await expect(page.getByText(band, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("India's CPCB scale. Higher is worse.")).toBeVisible();
    expect(page.url()).toContain("/aqi");
  });

  test("no United States band name appears against a CPCB figure", async ({ page }) => {
    for (const path of ["/aqi", "/rankings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const body = await page.locator("body").innerText();
      for (const name of EPA_BAND_NAMES) {
        expect(body, `${path} still renders the EPA band "${name}"`).not.toContain(name);
      }
    }
  });
});
