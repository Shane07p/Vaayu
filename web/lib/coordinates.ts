import rawCities from "@/public/cities.json";

export interface CityLocation {
  id: number;
  name: string;
  state: string;
  stateCode: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
}

// Re-export with legacy name for backward compatibility
export type GeoLocationPoint = CityLocation;

export const GEO_COORDINATES: CityLocation[] = rawCities as CityLocation[];
