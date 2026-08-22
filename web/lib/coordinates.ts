import rawCoordinates from "@/public/coordinates.json";

export interface GeoLocationPoint {
  id: number;
  code: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  pm25: number;
  aqi: number;
  category: string;
}

export const GEO_COORDINATES: GeoLocationPoint[] = rawCoordinates as GeoLocationPoint[];
