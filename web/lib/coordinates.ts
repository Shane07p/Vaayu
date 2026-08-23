/**
 * Geographic reference points for the citizen map.
 *
 * Coordinates and names only. These files previously carried an `aqi`, `pm25`
 * and `category` on every one of 5,699 entries, and the markers rendered them
 * as though they were measurements. They were not: every state in a country
 * carried its country's figure copied down, frozen, from no stated source, on
 * the public page where a reader takes a coloured number for current air
 * quality. 17,097 such fields were removed.
 *
 * Air quality comes from the API, which reports what was measured, by whom,
 * and when. If a place has no measurement, the honest answer is that it has
 * none -- not a plausible-looking number.
 *
 * These are fetched at runtime, not imported.
 *
 * The previous version used `import rawStates from "@/public/processed_states.json"`,
 * which makes webpack inline the file into the client bundle. Together the four
 * files are roughly a megabyte, and `MapControls` is a client component, so that
 * megabyte was compiled into the JavaScript served to every visitor of the public
 * citizen page — the surface aimed at mobile users on Indian networks.
 *
 * Importing from `public/` also pays twice: Next serves everything in that
 * directory statically as well, so the same bytes shipped as both a bundled
 * module and a static asset.
 *
 * Fetching keeps the payload out of the bundle, lets the browser cache it
 * separately from the code, and means a slow load degrades the map's reference
 * markers rather than blocking first paint.
 */

export interface ContinentLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface CountryLocation {
  id: string;
  name: string;
  capital?: string;
  lat: number;
  lon: number;
}

export interface StateLocation {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface CityLocation {
  id: number;
  name: string;
  state: string;
  stateCode: string;
  tier: number;
  lat: number;
  lon: number;
}

/** Re-export with legacy name for backward compatibility. */
export type GeoLocationPoint = CityLocation;

export interface GeoReferenceData {
  cities: CityLocation[];
  countries: CountryLocation[];
  states: StateLocation[];
  continents: ContinentLocation[];
}

const EMPTY: GeoReferenceData = {
  cities: [],
  countries: [],
  states: [],
  continents: [],
};

async function fetchJson<T>(path: string): Promise<T[]> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return (await response.json()) as T[];
}

/**
 * Cached so concurrent callers share one network round trip and the data is
 * parsed once for the lifetime of the page.
 */
let pending: Promise<GeoReferenceData> | null = null;

export function loadGeoReferenceData(): Promise<GeoReferenceData> {
  if (pending) {
    return pending;
  }

  pending = Promise.all([
    fetchJson<CityLocation>("/cities.json"),
    fetchJson<CountryLocation>("/processed_countries.json"),
    fetchJson<StateLocation>("/processed_states.json"),
    fetchJson<ContinentLocation>("/processed_continents.json"),
  ])
    .then(([cities, countries, states, continents]) => ({
      cities,
      countries,
      states,
      continents,
    }))
    .catch((error) => {
      // Reference markers are an enhancement, not the page's purpose: the live
      // grid, stations and forecast all come from the API. Failing soft here
      // keeps the map usable, and the retry is available on the next call.
      console.error("Could not load geographic reference data", error);
      pending = null;
      return EMPTY;
    });

  return pending;
}
