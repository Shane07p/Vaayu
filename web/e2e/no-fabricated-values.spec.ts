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
  // "seed-v0" was here and has been removed. The rule for this list is to add,
  // never remove, so this needs its reason on the record.
  //
  // It did not guard a fabrication. It forbade the honest label. The console
  // footer reads the model from /provenance and prints whatever is actually
  // behind the numbers, which is "seed-v0" marked as not a trained model --
  // and the test below, "the console names the model it is actually running",
  // requires that string to be present. The two assertions contradicted each
  // other, and this one was wrong: naming seed data as seed data is the
  // behaviour we want, not the one we are guarding against.
  //
  // What the entry was actually reaching for -- a seed forecast presented as a
  // real one -- is now prevented at the source. V908 marks those rows
  // demo_only and the read queries filter them out (PR #24).
  // Operational jargon removed by B3 (PLAN §4.3). Each of these was system
  // language that no reader would say aloud. They are easy to reintroduce
  // while making a page look professional, so they are ratcheted here.
  {
    text: "DELHI-NCR PILOT COMMAND",
    was: "the topbar region label, styled as a military command name",
  },
  {
    text: "Statutory Alerts",
    was: "the sidebar and alerts page heading, replaced by Action notices",
  },
  {
    text: "Mode: CACHED",
    was: "the topbar data-mode badge, replaced by a plain last-updated time",
  },
  {
    text: "Authority Console",
    was: "the console entry point label, replaced by For officials",
  },
  {
    text: "Situation Map",
    was: "the map page navigation item, replaced by Map",
  },
  {
    text: "Forecast Intelligence",
    was: "the forecast navigation item, replaced by Forecast",
  },
  {
    text: "Fire Worklist",
    was: "the worklist navigation item, replaced by Farm fires",
  },
  {
    text: "Check My Air",
    was: "the citizen portal CTA, replaced by My air",
  },
  {
    text: "Telemetry: Live Sync",
    was: "the topbar telemetry strip",
  },
  {
    text: "SYSTEM PROVENANCE",
    was: "the provenance panel header, replaced by Where this comes from",
  },
  // Invented readings removed during review of the B3 branch. Each was a
  // number attributed to a real named station or network that nothing had
  // measured, which is the exact failure lib/api.ts refuses a seed fallback
  // for on fetchCityRankings.
  {
    text: "Anand Vihar (Reference)",
    was: "a hardcoded AQI 168 / PM2.5 84.5 shown for any unmatched location, attributed to a real DPCC station",
  },
  {
    text: "Baseline monitoring telemetry",
    was: "the rankings footer, shown while a hand-written table of 28 city AQIs stood in for the API",
  },
  {
    text: "Last updated 40 minutes ago",
    was: "the Topbar default prop, rendered on every console page regardless of when anything last ran",
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

/**
 * The state and country ranking tabs.
 *
 * Both were built from hand-written tables -- eleven countries with invented
 * national AQIs attributed to named networks (EPA AirNow, AURN, Soramame), and
 * twenty Indian states with invented figures attributed to named stations.
 * Neither has a data source: we ingest India only, and no station record
 * carries a state, because openaq_latest sets it to None rather than guessing
 * one from an operator suffix.
 *
 * The tabs are a fair question to ask, so they stayed. They must answer it by
 * explaining what is missing, never by filling it in.
 */
test("the state and country tabs explain the gap rather than invent one", async ({ page }) => {
  await page.goto("/rankings", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /state/i }).click();
  await expect(page.getByText("We cannot rank Indian states yet.")).toBeVisible();

  await page.getByRole("button", { name: /country/i }).click();
  await expect(page.getByText("We only measure India.")).toBeVisible();

  // Nothing from the deleted tables reappears behind either tab.
  const body = await page.locator("body").innerText();
  for (const invented of ["Bangladesh", "Marylebone", "AURN", "Soramame", "AirNow"]) {
    expect(body, `the rankings page names "${invented}", which nothing measured`).not.toContain(
      invented,
    );
  }
});
