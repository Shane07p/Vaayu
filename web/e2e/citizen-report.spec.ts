import { test, expect } from "@playwright/test";

/**
 * Submitting an observation, with a real position granted to the browser.
 *
 * The form used to fabricate its own result. On every successful submission it
 * displayed "Classified Band: POOR" and "Model Confidence: 62%" beside a
 * paragraph of Gemini-styled reasoning -- the same three values every time, for
 * a photograph that was never uploaded. Only a test that actually submits sees
 * that screen, which is why none of the unit tests caught it.
 */

// Connaught Place. Any real Indian position will do; the server coarsens it.
test.use({
  geolocation: { latitude: 28.6304, longitude: 77.2177 },
  permissions: ["geolocation"],
});

test("a submitted observation returns a receipt, not an invented analysis", async ({ page }) => {
  await page.goto("/report", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /submit|भेजें|ਭੇਜੋ/i }).click();

  // The receipt, from the row the server actually wrote.
  const receipt = page.getByText("Observation recorded");
  await expect(receipt).toBeVisible({ timeout: 30_000 });

  const body = await page.locator("body").innerText();

  // The fabricated analysis, in all its parts.
  expect(body).not.toContain("Classified Band");
  expect(body).not.toContain("Model Confidence");
  expect(body).not.toContain("62%");
  expect(body).not.toContain("Visual particulate haze");
  expect(body).not.toContain("Correlating with Gemini vision classifier");

  // And it must show the identifier the server returned, so the citizen has
  // something they can be quoted back.
  expect(body).toMatch(/#\d+/);
});

test("the intake does not promise classification it cannot do", async ({ page }) => {
  await page.goto("/report", { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();

  // Present tense claims about what the photo does. There is no upload
  // boundary, so the photograph never leaves the device.
  expect(body).not.toContain("Visual analysis derives a coarse AQI band");
  expect(body).toContain("not connected yet");
});
