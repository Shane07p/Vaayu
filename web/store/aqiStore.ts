// web/store/aqiStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { GridPrediction, Forecast } from '@/lib/schemas';
import { fetchGrid, fetchStations, fetchForecast } from '@/lib/api';
import type { Map } from 'maplibre-gl';

export type AQITab = 'aqi' | 'weather';

function getAqiFromPm25(pm25: number): number {
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

function generateGridForArea(centerLon: number, centerLat: number, basePrefix = "CELL"): GridPrediction[] {
  const cells: GridPrediction[] = [];
  let id = 1;
  const now = new Date().toISOString();
  for (let gx = 0; gx < 10; gx++) {
    for (let gy = 0; gy < 10; gy++) {
      const lon = centerLon - 0.2 + gx * 0.04 + 0.02;
      const lat = centerLat - 0.16 + gy * 0.032 + 0.016;
      const distFromCenter = Math.sqrt(Math.pow(lon - centerLon, 2) + Math.pow(lat - centerLat, 2));
      const basePm = Math.max(55, Math.min(320, 210 - distFromCenter * 420 + ((id * 7) % 35)));
      const cov = 0.55 + (id % 5) * 0.09;
      cells.push({
        gridCellId: id,
        code: `${basePrefix}-${String(id).padStart(4, "0")}`,
        lon: Number(lon.toFixed(4)),
        lat: Number(lat.toFixed(4)),
        ts: now,
        pm25Q10: Number((basePm * 0.8).toFixed(1)),
        pm25Q50: Number(basePm.toFixed(1)),
        pm25Q90: Number((basePm * 1.22).toFixed(1)),
        coverageFraction: Number(cov.toFixed(2)),
        modelVersion: "VAAYU-XGB-v1",
        source: "CACHED",
      });
      id++;
    }
  }
  return cells;
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
  dataSource: 'API' | 'MARKER' | 'GENERATED';
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
    dataSource: 'GENERATED',
    loadGrid: (data) => {
      set({
        gridData: data,
        selectedCellData: data.length > 0 ? (get().selectedCellData ?? data[Math.floor(data.length / 2)]) : null,
        selectedCellId: data.length > 0 ? (get().selectedCellId ?? data[Math.floor(data.length / 2)].gridCellId) : null,
      });
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
    clearSelection: () => set({ selectedCellId: null, selectedCellData: null, markerInfo: null }),
    loadLocationData: async (lat, lon, name, map, marker) => {
      set({
        loading: true,
        locationName: name,
        locationCoords: { lat, lng: lon },
        markerInfo: marker || null,
        dataSource: marker ? 'MARKER' : 'GENERATED',
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

        let gridList = await fetchGrid(bbox);
        if (gridList && gridList.length > 0) {
          // We got real API data!
          const midCell = gridList[Math.floor(gridList.length / 2)] ?? gridList[0];
          set({
            gridData: gridList,
            selectedCellData: midCell,
            selectedCellId: midCell?.gridCellId ?? null,
            dataSource: 'API',
          });
        } else {
          // No API data — use the marker's known AQI as-is
          // Still generate a grid for background rendering
          const prefix = name.split(",")[0].trim().toUpperCase().slice(0, 3);
          const fallbackGrid = generateGridForArea(lon, lat, prefix);
          const midCell = fallbackGrid[Math.floor(fallbackGrid.length / 2)];
          set({
            gridData: fallbackGrid,
            selectedCellData: midCell,
            selectedCellId: midCell.gridCellId,
            dataSource: marker ? 'MARKER' : 'GENERATED',
          });
        }
      } catch (err) {
        console.error("Error loading grid for location:", err);
        const prefix = name.split(",")[0].trim().toUpperCase().slice(0, 3);
        const fallbackGrid = generateGridForArea(lon, lat, prefix);
        const midCell = fallbackGrid[Math.floor(fallbackGrid.length / 2)];
        set({
          gridData: fallbackGrid,
          selectedCellData: midCell,
          selectedCellId: midCell.gridCellId,
          dataSource: marker ? 'MARKER' : 'GENERATED',
        });
      } finally {
        set({ loading: false });
      }
    },
    locateMe: async (map) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return;
      set({ loading: true });
      return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const name = `${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E · Nearest 1 km Cell`;
            await get().loadLocationData(latitude, longitude, name, map);
            resolve();
          },
          (err) => {
            console.warn("Geolocation denied or failed:", err);
            set({ loading: false });
            resolve();
          },
          { timeout: 8000 }
        );
      });
    },
  }))
);
