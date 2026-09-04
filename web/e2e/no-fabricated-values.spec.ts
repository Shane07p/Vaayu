import { test, expect } from "@playwright/test";

/**
 * Values that were on screen without ever having been measured.
 *
 * Each string here shipped in the UI, presented as data, and each was constant
 * regardless of what the database held. They are asserted absent rather than
 * merely deleted, because this is the project's central claim and a plausible
 * placeholder is very easy to reintroduce while making a page look finished.
 *
 * Add to this list rather than removing from it.
 */
const FABRICATIONS: { text: string; was: string }[] = [
  {
    text: "22 AUG 2026 · 14:51 IST",
    was: "citizen-hero's Updated: line, component state initialised to a literal",
  },
  {
    text: "34°C · Sunny",
    was: "the met strip, attributed by name to IMD and ERA5, constant everywhere",
  },
  { text: "21.2 km/h NW", was: "the same met strip" },
  { text: "8.1 Very High", was: "a UV index nothing in this system measures" },
  {
    text: "VAAYU-XGB-v1",
    was: "the console sidebar's Model Engine, while model_run held seed data",
  },
  {
    text: "Visual particulate haze",
    was: "a Gemini reasoning paragraph the report form wrote for itself",
  },
  // Seed predictions that were rendering as live data on the console.
  // grid_prediction averaged 169 µg/m³ while real stations read ~27.
  // Forecast predicted AQI 428 Severe for a city currently at 98.
  // V908 migration flags these demo_only = true; queries now exclude them.
  // Assert their absence so they cannot silently come back via a query change.
  {
    text: "AQI 428",
    was: "seed forecast predicted AQI 428 for a station reading 98 in real life",
  },
  {
    text: "seed-v0",
    was: "model_version from V900 seed data, shown on map and forecast pages",
  },
];

test("the citizen surface states no unmeasured value", async ({ page }) => {
  await page.goto("/aqi", { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();

  for (const { text, was } of FABRICATIONS) {
    expect(body, `"${text}" is back -- it was ${was}`).not.toContain(text);
  }
});

test("the console states no unmeasured value", async ({ page }) => {
  await page.goto("/map", { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();

  for (const { text, was } of FABRICATIONS) {
    expect(body, `"${text}" is back -- it was ${was}`).not.toContain(text);
  }
});

test("the console names the model it is actually running", async ({ page }) => {
  await page.goto("/map", { waitUntil: "networkidle" });

  // Whatever it says, it must come from /provenance. Seed data has to be
  // labelled as seed: an officer must not read placeholder rows as a forecast.
  const footer = page.getByText("Model Engine:").locator("..");
  const shown = await footer.innerText();

  expect(shown).not.toContain("VAAYU-XGB-v1");
  expect(shown, "the footer should name a model or say none is trained").toMatch(
    /seed|none trained|v\d/i,
  );
});
