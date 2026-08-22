import rawCities from "@/public/cities.json";
import rawCountries from "@/public/processed_countries.json";
import rawStates from "@/public/processed_states.json";

export interface CountryLocation {
  id: string;
  name: string;
  capital: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
}

export interface StateLocation {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
}

export interface CityLocation {
  id: number;
  name: string;
  state: string;
  stateCode: string;
  tier: number;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
}

// Re-export with legacy name for backward compatibility
export type GeoLocationPoint = CityLocation;

export const GEO_COORDINATES: CityLocation[] = rawCities as CityLocation[];
export const COUNTRIES: CountryLocation[] = rawCountries as CountryLocation[];
export const STATES: StateLocation[] = rawStates as StateLocation[];
