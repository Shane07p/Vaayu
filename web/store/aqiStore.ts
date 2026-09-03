// web/store/aqiStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { GridPrediction, Forecast, NearestStation, StationReading } from '@/lib/schemas';
import { fetchGrid, fetchNearest } from '@/lib/api';
import type { Map } from 'maplibre-gl';

export type AQITab = 'aqi' | 'weather';

/*
 * generateGridForArea used to live here.
 *
 * When the API returned no cells for a location it synthesised a 10x10 grid in
 * the browser and displayed it. The values were not merely invented, they were
 * the same everywhere: the concentration was derived from
 * `distFromCenter`, and `lon - centerLon` cancels the centre out, so every cell
 * depended only on its loop index. Africa, Asia, Europe and Oceania all reported
 * 156 ug/m3 and AQI 328, because that is what index 50 evaluates to.
 *
 * The honest answer for a place we do not measure is that we do not measure it.
 * The grid covers Delhi-NCR; everywhere else now says so.
 */


/**
 * The grid cell nearest a point, or null when there are none.
 *
 * Squared degrees, not metres. Over a bbox half a degree wide the ranking by
 * squared degree distance and by great-circle distance agree, and the answer
 * here is which of a handful of candidates is closest, not how far away it is.
 * Latitude is weighted by the cosine of the point's latitude so a degree of
 * longitude is not treated as a degree of latitude; at 28°N they differ by
 * about twelve per cent, which is enough to pick the wrong cell.
 */
function closestCell(cells: GridPrediction[], lat: number, lon: number): GridPrediction | null {
  const lonScale = Math.cos((lat * Math.PI) / 180);
  let best: GridPrediction | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const dLat = cell.lat - lat;
    const dLon = (cell.lon - lon) * lonScale;
    const distance = dLat * dLat + dLon * dLon;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }

  return best;
}

/** Data from the clicked marker (known before API call) */
export interface MarkerInfo {
  aqi: number;
  pm25: number;
  category: string;
  tier: number; // 0-continent 1-country 2-state 3-city
}

interface AQIState {
  selectedCellId: number | null;
  selectedCellData: GridPrediction | null;
  gridData: GridPrediction[];
  forecast: Forecast[];
  currentTab: AQITab;
  loading: boolean;
  locationCoords: { lat: number; lng: number } | null;
  locationName: string;
  lastUpdated: string;
  /** Marker-level AQI info (the value shown on the map label) */
  markerInfo: MarkerInfo | null;
  /** Whether the displayed data came from a live API or fallback */
  /**
   * API: a 1 km grid cell. STATION: nearest real measurement, with its distance.
   * MARKER: supplied by a caller. NONE: nothing measured anywhere near here.
   */
  dataSource: 'API' | 'MARKER' | 'STATION' | 'NONE';
  /** Nearest measurement when the grid has no cell for this location. */
  nearestStation: NearestStation | null;
  /**
   * A station the reader clicked on the map.
   *
   * Held apart from selectedCellData because they answer different questions.
   * Clicking a station marker used to call loadLocationData, which fetches the
   * 1 km grid around the point and selects the middle cell of it -- so the card
   * showed a modelled grid estimate with a quantile range and coverage figure,
   * not the station's measurement, and every station near NCR resolved to
   * roughly the same cell. The card appeared not to change because it largely
   * did not.
   */
  selectedStation: StationReading | null;
  /** Why locating failed, when it did. Shown rather than logged. */
  locationError: string | null;
  /**
   * Whether the user has actually asked about a place.
   *
   * The store opens with a default locationName and dataSource NONE, which is
   * indistinguishable from "asked, and nothing was found" -- so the map showed
   * "No measurement here" on first paint, before any interaction.
   */
  hasQueried: boolean;
  // actions
  loadGrid: (data: GridPrediction[]) => void;
  selectCell: (id: number) => void;
  setSelectedCellData: (data: GridPrediction | null) => void;
  setForecast: (fc: Forecast[]) => void;
  setTab: (tab: AQITab) => void;
  setLoading: (loading: boolean) => void;
  setLocationName: (name: string) => void;
  setLocationCoords: (coords: { lat: number; lng: number } | null) => void;
  loadLocationData: (lat: number, lon: number, name: string, map?: Map | null, marker?: MarkerInfo) => Promise<void>;
  selectStation: (station: StationReading, map?: Map | null) => void;
  selectOpeningStation: (lat: number, lon: number) => Promise<void>;
  locateMe: (map?: Map | null) => Promise<void>;
  clearSelection: () => void;
}

export const useAQIStore = create<AQIState>()(
  devtools((set, get) => ({
    selectedCellId: null,
    selectedCellData: null,
    gridData: [],
    forecast: [],
    currentTab: 'aqi',
    loading: false,
    locationCoords: { lat: 28.6139, lng: 77.209 },
    locationName: 'Delhi-NCR · Central Pilot',
    lastUpdated: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
    markerInfo: null,
    dataSource: 'NONE',
    nearestStation: null,
    selectedStation: null,
    locationError: null,
    hasQueried: false,
    // The grid is loaded, not selected from.
    //
    // This used to pick data[length / 2] -- the middle cell of whatever
    // happened to be fetched -- and present it as the reader's location. On
    // opening the page that produced a card reading "NEW DELHI, 326, 153 ug/m3,
    // CACHED": an arbitrary cell of a seeded surface, labelled with a city, for
    // somewhere nobody had asked about. Real Delhi stations were reading 9 to 84
    // at the same moment.
    //
    // Nothing is selected until the reader picks a place or the opening
    // measurement resolves. See selectOpeningStation.
    loadGrid: (data) => {
      set({ gridData: data });
    },

    /**
     * The measurement to show when the page opens.
     *
     * Uses the nearest reporting station to the map's initial centre, so the
     * first thing on screen is something an instrument recorded rather than a
     * modelled cell. Silent on failure: an empty map is honest, and the reader
     * can search or use their location.
     */
    selectOpeningStation: async (lat, lon) => {
      if (get().hasQueried) return;
      try {
        const nearest = await fetchNearest(lat, lon);
        if (!nearest || get().hasQueried) return;
        set({
          nearestStation: nearest,
          locationName: nearest.city ?? nearest.name,
          dataSource: 'STATION',
          hasQueried: true,
        });
      } catch {
        // Nothing shown, nothing claimed.
      }
    },
    selectCell: (id) => {
      const cell = get().gridData.find((c) => c.gridCellId === id) || null;
      set({ selectedCellId: id, selectedCellData: cell });
    },
    setSelectedCellData: (data) => set({ selectedCellData: data }),
    setForecast: (fc) => set({ forecast: fc }),
    setTab: (tab) => set({ currentTab: tab }),
    setLoading: (loading) => set({ loading }),
    setLocationName: (name) => set({ locationName: name }),
    setLocationCoords: (coords) => set({ locationCoords: coords }),
    clearSelection: () => set({ selectedCellId: null, selectedCellData: null, markerInfo: null, nearestStation: null, selectedStation: null, hasQueried: false }),

    // The marker already carries the reading, so this needs no request. The
    // grid and any nearest-station result are cleared: they describe somewhere
    // else, and leaving them would let the card mix two answers.
    selectStation: (station, map) => {
      set({
        selectedStation: station,
        selectedCellData: null,
        selectedCellId: null,
        nearestStation: null,
        markerInfo: null,
        locationName: station.city ?? station.name,
        locationError: null,
        hasQueried: true,
        dataSource: 'API',
        loading: false,
      });
      map?.flyTo({ center: [station.lon, station.lat], zoom: Math.max(map.getZoom(), 9), essential: true });
    },
    loadLocationData: async (lat, lon, name, map, marker) => {
      set({
        loading: true,
        locationName: name,
        locationCoords: { lat, lng: lon },
        markerInfo: marker || null,
        nearestStation: null,
        selectedStation: null,
        locationError: null,
        hasQueried: true,
        dataSource: marker ? 'MARKER' : 'NONE',
      });
      const now = new Date();
      set({
        lastUpdated: `${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase()} · ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`,
      });

      if (map) {
        map.flyTo({
          center: [lon, lat],
          zoom: 10,
          speed: 1.3,
          curve: 1.4,
          essential: true,
        });
      }

      try {
        const minLon = (lon - 0.25).toFixed(4);
        const minLat = (lat - 0.2).toFixed(4);
        const maxLon = (lon + 0.25).toFixed(4);
        const maxLat = (lat + 0.2).toFixed(4);
        const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

        const gridList = await fetchGrid(bbox);
        if (gridList && gridList.length > 0) {
          // The cell covering the place that was asked about, not the middle of
          // the box that was fetched.
          //
          // This used to take gridList[length / 2]. The bbox above spans half a
          // degree of longitude and four tenths of latitude -- roughly 50 km by
          // 44 km -- and the API returns its cells in no order the caller
          // defines, so the "middle" one could be thirty kilometres from the
          // searched point and belong to a different city. The card then
          // reported that cell's PM2.5, interval and coverage under the name of
          // the place the reader typed. Same class of mistake as loadGrid's old
          // auto-selection: a real number, presented as a measurement of
          // somewhere it does not describe.
          const nearestCell = closestCell(gridList, lat, lon);
          set({
            gridData: gridList,
            selectedCellData: nearestCell,
            selectedCellId: nearestCell?.gridCellId ?? null,
            dataSource: 'API',
          });
        } else {
          // No grid cell here -- the 1 km surface covers Delhi-NCR only. Fall
          // back to the nearest real station rather than to a synthesised one.
          // The distance comes back with it and is shown, so a measurement from
          // 23 km away is never presented as a reading for this spot.
          const nearest = await fetchNearest(lat, lon);
          set({
            gridData: [],
            selectedCellData: null,
            selectedCellId: null,
            nearestStation: nearest,
            dataSource: nearest ? 'STATION' : 'NONE',
          });
        }
      } catch (err) {
        // An unreachable API is not a reading. Previously this substituted a
        // synthetic grid, so a network failure looked identical to data.
        console.error("Error loading grid for location:", err);
        set({
          gridData: [],
          selectedCellData: null,
          selectedCellId: null,
          nearestStation: null,
          dataSource: 'NONE',
        });
      } finally {
        set({ loading: false });
      }
    },
    locateMe: async (map) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        set({ locationError: "This browser cannot report a location." });
        return;
      }
      set({ loading: true, locationError: null });
      return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            // Rounded to three decimals, about 110 m, before the position is
            // used for anything. This query is not stored, but the precise fix
            // has no reason to leave the browser either. Reports are coarsened
            // harder still -- see submitCitizenReport.
            const latitude = Math.round(pos.coords.latitude * 1000) / 1000;
            const longitude = Math.round(pos.coords.longitude * 1000) / 1000;
            // Says where, and claims nothing about what is there. This read
            // "Nearest 1 km Cell", but the 1 km surface covers Delhi-NCR only;
            // everywhere else the answer is a station and its distance.
            const name = `${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E`;
            await get().loadLocationData(latitude, longitude, name, map);
            resolve();
          },
          (err) => {
            // Surfaced rather than logged: a button that silently does nothing
            // reads as broken, and the user is the only one who can grant this.
            const reason =
              err.code === err.PERMISSION_DENIED
                ? "Location permission denied. Search for a place instead."
                : err.code === err.TIMEOUT
                  ? "Locating timed out. Try again, or search for a place."
                  : "Could not determine your location.";
            set({ loading: false, locationError: reason });
            resolve();
          },
          { timeout: 8000 }
        );
      });
    },
  }))
);
