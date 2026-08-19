/**
 * Client-side map state.
 *
 * Zustand holds ephemeral view state — viewport, layer toggles, selection.
 * Server data lives in TanStack Query, not here. Keeping the two separate stops
 * the store becoming a stale cache of the API.
 */

import { create } from "zustand";

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

type MapState = {
  viewState: ViewState;
  showGrid: boolean;
  showFires: boolean;
  showStations: boolean;
  selectedCluster: string | null;
  setViewState: (viewState: ViewState) => void;
  toggleGrid: () => void;
  toggleFires: () => void;
  toggleStations: () => void;
  selectCluster: (code: string | null) => void;
};

/** Centred on Delhi. */
const INITIAL_VIEW: ViewState = {
  longitude: 77.209,
  latitude: 28.6139,
  zoom: 9,
};

export const useMapStore = create<MapState>((set) => ({
  viewState: INITIAL_VIEW,
  showGrid: true,
  showFires: true,
  showStations: true,
  selectedCluster: null,
  setViewState: (viewState) => set({ viewState }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleFires: () => set((state) => ({ showFires: !state.showFires })),
  toggleStations: () => set((state) => ({ showStations: !state.showStations })),
  selectCluster: (selectedCluster) => set({ selectedCluster }),
}));
