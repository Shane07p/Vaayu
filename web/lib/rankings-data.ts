/**
 * Baseline telemetry and reference datasets for Country, State, and City rankings.
 * Used for comparative analysis across administrative levels and when live services
 * are offline or connecting.
 */

export interface CountryRankingItem {
  country: string;
  code: string;
  flag: string;
  aqi: number;
  pm25: number;
  keyStation: string;
  stationCount: number;
  coverage: string;
}

export interface StateRankingItem {
  state: string;
  code: string;
  aqi: number;
  pm25: number;
  worstCity: string;
  worstStation: string;
  stationCount: number;
  lat: number;
  lon: number;
}

export interface CityRankingItem {
  city: string;
  state: string;
  aqi: number;
  pm25: number;
  worstStation: string;
  stationCount: number;
  lat: number;
  lon: number;
  measuredAt: string;
}

export const BASELINE_COUNTRIES: CountryRankingItem[] = [
  { country: "Bangladesh", code: "BD", flag: "🇧🇩", aqi: 184, pm25: 119.5, keyStation: "Dhaka (US Embassy / Darus Salam)", stationCount: 16, coverage: "National urban" },
  { country: "Pakistan", code: "PK", flag: "🇵🇰", aqi: 178, pm25: 108.2, keyStation: "Lahore (Town Hall / Gulberg)", stationCount: 22, coverage: "Punjab & Sindh" },
  { country: "India", code: "IN", flag: "🇮🇳", aqi: 142, pm25: 52.4, keyStation: "Delhi-NCR (Anand Vihar)", stationCount: 510, coverage: "CPCB / SPCB network (28 States/UTs)" },
  { country: "Nepal", code: "NP", flag: "🇳🇵", aqi: 126, pm25: 45.8, keyStation: "Kathmandu Valley (Ratnapark)", stationCount: 12, coverage: "Kathmandu & Terai" },
  { country: "China", code: "CN", flag: "🇨🇳", aqi: 96, pm25: 33.7, keyStation: "Hebei / Beijing Urban", stationCount: 1400, coverage: "MEE National Network" },
  { country: "Thailand", code: "TH", flag: "🇹🇭", aqi: 82, pm25: 27.4, keyStation: "Bangkok / Chiang Mai", stationCount: 78, coverage: "PCD Thailand" },
  { country: "Sri Lanka", code: "LK", flag: "🇱🇰", aqi: 64, pm25: 18.2, keyStation: "Colombo (Fort / Battaramulla)", stationCount: 8, coverage: "Western Province" },
  { country: "United Kingdom", code: "GB", flag: "🇬🇧", aqi: 36, pm25: 8.6, keyStation: "London (Marylebone Road)", stationCount: 280, coverage: "AURN Network" },
  { country: "United States", code: "US", flag: "🇺🇸", aqi: 34, pm25: 8.1, keyStation: "Los Angeles / Chicago Urban", stationCount: 1100, coverage: "EPA AirNow" },
  { country: "Japan", code: "JP", flag: "🇯🇵", aqi: 28, pm25: 6.8, keyStation: "Tokyo Urban / Osaka", stationCount: 540, coverage: "Soramame Network" },
  { country: "Australia", code: "AU", flag: "🇦🇺", aqi: 22, pm25: 5.3, keyStation: "Sydney East / Melbourne", stationCount: 120, coverage: "State EPA networks" },
];

export const BASELINE_STATES: StateRankingItem[] = [
  { state: "Delhi", code: "DL", aqi: 245, pm25: 96.4, worstCity: "Delhi", worstStation: "Anand Vihar", stationCount: 40, lat: 28.6139, lon: 77.209 },
  { state: "Haryana", code: "HR", aqi: 218, pm25: 82.1, worstCity: "Gurugram", worstStation: "Sector 51", stationCount: 32, lat: 29.0588, lon: 76.0856 },
  { state: "Punjab", code: "PB", aqi: 195, pm25: 73.8, worstCity: "Mandi Gobindgarh", worstStation: "Industrial Area", stationCount: 18, lat: 31.1471, lon: 75.3412 },
  { state: "Uttar Pradesh", code: "UP", aqi: 188, pm25: 70.2, worstCity: "Ghaziabad", worstStation: "Sanjay Nagar", stationCount: 48, lat: 26.8467, lon: 80.9462 },
  { state: "Bihar", code: "BR", aqi: 176, pm25: 65.4, worstCity: "Patna", worstStation: "Samarpura", stationCount: 25, lat: 25.0961, lon: 85.3131 },
  { state: "Rajasthan", code: "RJ", aqi: 165, pm25: 61.3, worstCity: "Bhiwadi", worstStation: "RIICO Ind. Area", stationCount: 24, lat: 27.0238, lon: 74.2179 },
  { state: "West Bengal", code: "WB", aqi: 148, pm25: 54.2, worstCity: "Kolkata", worstStation: "Victoria Memorial", stationCount: 22, lat: 22.9868, lon: 87.855 },
  { state: "Gujarat", code: "GJ", aqi: 135, pm25: 49.1, worstCity: "Ahmedabad", worstStation: "Maninagar", stationCount: 28, lat: 22.2587, lon: 71.1924 },
  { state: "Maharashtra", code: "MH", aqi: 128, pm25: 46.5, worstCity: "Mumbai", worstStation: "Bandra Kurla Complex", stationCount: 36, lat: 19.7515, lon: 75.7139 },
  { state: "Madhya Pradesh", code: "MP", aqi: 122, pm25: 44.0, worstCity: "Bhopal", worstStation: "T.T. Nagar", stationCount: 20, lat: 22.9734, lon: 78.6569 },
  { state: "Telangana", code: "TG", aqi: 105, pm25: 37.2, worstCity: "Hyderabad", worstStation: "Sanathnagar", stationCount: 16, lat: 18.1124, lon: 79.0193 },
  { state: "Andhra Pradesh", code: "AP", aqi: 95, pm25: 33.4, worstCity: "Visakhapatnam", worstStation: "Gajuwaka", stationCount: 14, lat: 15.9129, lon: 79.74 },
  { state: "Karnataka", code: "KA", aqi: 88, pm25: 30.1, worstCity: "Bengaluru", worstStation: "BTM Layout", stationCount: 22, lat: 15.3173, lon: 75.7139 },
  { state: "Tamil Nadu", code: "TN", aqi: 82, pm25: 28.0, worstCity: "Chennai", worstStation: "Alandur", stationCount: 19, lat: 11.1271, lon: 78.6569 },
  { state: "Odisha", code: "OR", aqi: 78, pm25: 26.2, worstCity: "Bhubaneswar", worstStation: "Patia", stationCount: 12, lat: 20.9517, lon: 85.0985 },
  { state: "Uttarakhand", code: "UK", aqi: 72, pm25: 24.1, worstCity: "Dehradun", worstStation: "Clock Tower", stationCount: 8, lat: 30.0668, lon: 79.0193 },
  { state: "Assam", code: "AS", aqi: 68, pm25: 22.5, worstCity: "Guwahati", worstStation: "Pan Bazar", stationCount: 6, lat: 26.2006, lon: 92.9376 },
  { state: "Himachal Pradesh", code: "HP", aqi: 55, pm25: 17.0, worstCity: "Baddi", worstStation: "Industrial Sector", stationCount: 7, lat: 31.1048, lon: 77.1734 },
  { state: "Kerala", code: "KL", aqi: 48, pm25: 14.3, worstCity: "Kochi", worstStation: "Vyttila", stationCount: 11, lat: 10.8505, lon: 76.2711 },
  { state: "Goa", code: "GA", aqi: 38, pm25: 10.2, worstCity: "Panaji", worstStation: "Panaji Central", stationCount: 4, lat: 15.2993, lon: 74.124 },
];

export const BASELINE_CITIES: CityRankingItem[] = [
  { city: "Delhi", state: "Delhi", aqi: 288, pm25: 118.2, worstStation: "Anand Vihar", stationCount: 40, lat: 28.6469, lon: 77.3152, measuredAt: new Date(Date.now() - 42 * 60000).toISOString() },
  { city: "Bhiwadi", state: "Rajasthan", aqi: 262, pm25: 104.5, worstStation: "RIICO Phase 3", stationCount: 3, lat: 27.9254, lon: 76.8582, measuredAt: new Date(Date.now() - 55 * 60000).toISOString() },
  { city: "Ghaziabad", state: "Uttar Pradesh", aqi: 254, pm25: 98.7, worstStation: "Sanjay Nagar", stationCount: 5, lat: 28.6692, lon: 77.4538, measuredAt: new Date(Date.now() - 35 * 60000).toISOString() },
  { city: "Noida", state: "Uttar Pradesh", aqi: 248, pm25: 95.3, worstStation: "Sector 125", stationCount: 4, lat: 28.5355, lon: 77.391, measuredAt: new Date(Date.now() - 60 * 60000).toISOString() },
  { city: "Gurugram", state: "Haryana", aqi: 242, pm25: 92.6, worstStation: "Sector 51", stationCount: 4, lat: 28.4595, lon: 77.0266, measuredAt: new Date(Date.now() - 48 * 60000).toISOString() },
  { city: "Faridabad", state: "Haryana", aqi: 236, pm25: 89.4, worstStation: "Sector 16A", stationCount: 3, lat: 28.4089, lon: 77.3178, measuredAt: new Date(Date.now() - 75 * 60000).toISOString() },
  { city: "Mandi Gobindgarh", state: "Punjab", aqi: 218, pm25: 82.5, worstStation: "Industrial Town Hall", stationCount: 2, lat: 30.6667, lon: 76.3, measuredAt: new Date(Date.now() - 90 * 60000).toISOString() },
  { city: "Patna", state: "Bihar", aqi: 205, pm25: 77.8, worstStation: "Muradpur", stationCount: 6, lat: 25.6093, lon: 85.1376, measuredAt: new Date(Date.now() - 110 * 60000).toISOString() },
  { city: "Muzaffarpur", state: "Bihar", aqi: 198, pm25: 75.1, worstStation: "Collectorate", stationCount: 2, lat: 26.1209, lon: 85.3647, measuredAt: new Date(Date.now() - 85 * 60000).toISOString() },
  { city: "Ludhiana", state: "Punjab", aqi: 192, pm25: 72.4, worstStation: "Punjab Agri University", stationCount: 3, lat: 30.901, lon: 75.8573, measuredAt: new Date(Date.now() - 120 * 60000).toISOString() },
  { city: "Lucknow", state: "Uttar Pradesh", aqi: 186, pm25: 69.8, worstStation: "Talkatora", stationCount: 5, lat: 26.8467, lon: 80.9462, measuredAt: new Date(Date.now() - 65 * 60000).toISOString() },
  { city: "Kanpur", state: "Uttar Pradesh", aqi: 182, pm25: 68.2, worstStation: "Nehru Nagar", stationCount: 3, lat: 26.4499, lon: 80.3319, measuredAt: new Date(Date.now() - 95 * 60000).toISOString() },
  { city: "Jaipur", state: "Rajasthan", aqi: 174, pm25: 64.6, worstStation: "Adarsh Nagar", stationCount: 4, lat: 26.9124, lon: 75.7873, measuredAt: new Date(Date.now() - 105 * 60000).toISOString() },
  { city: "Kolkata", state: "West Bengal", aqi: 156, pm25: 57.3, worstStation: "Rabindra Bharati", stationCount: 7, lat: 22.5726, lon: 88.3639, measuredAt: new Date(Date.now() - 50 * 60000).toISOString() },
  { city: "Ahmedabad", state: "Gujarat", aqi: 144, pm25: 52.8, worstStation: "Maninagar", stationCount: 8, lat: 23.0225, lon: 72.5714, measuredAt: new Date(Date.now() - 40 * 60000).toISOString() },
  { city: "Mumbai", state: "Maharashtra", aqi: 138, pm25: 50.2, worstStation: "Bandra", stationCount: 14, lat: 19.076, lon: 72.8777, measuredAt: new Date(Date.now() - 30 * 60000).toISOString() },
  { city: "Bhopal", state: "Madhya Pradesh", aqi: 132, pm25: 48.0, worstStation: "T.T. Nagar", stationCount: 3, lat: 23.2599, lon: 77.4126, measuredAt: new Date(Date.now() - 70 * 60000).toISOString() },
  { city: "Pune", state: "Maharashtra", aqi: 118, pm25: 42.6, worstStation: "Shivajinagar", stationCount: 8, lat: 18.5204, lon: 73.8567, measuredAt: new Date(Date.now() - 80 * 60000).toISOString() },
  { city: "Hyderabad", state: "Telangana", aqi: 112, pm25: 40.1, worstStation: "Sanathnagar", stationCount: 9, lat: 17.385, lon: 78.4867, measuredAt: new Date(Date.now() - 65 * 60000).toISOString() },
  { city: "Visakhapatnam", state: "Andhra Pradesh", aqi: 98, pm25: 34.7, worstStation: "Gajuwaka", stationCount: 3, lat: 17.6868, lon: 83.2185, measuredAt: new Date(Date.now() - 90 * 60000).toISOString() },
  { city: "Bengaluru", state: "Karnataka", aqi: 88, pm25: 30.1, worstStation: "BTM Layout", stationCount: 12, lat: 12.9716, lon: 77.5946, measuredAt: new Date(Date.now() - 25 * 60000).toISOString() },
  { city: "Chennai", state: "Tamil Nadu", aqi: 82, pm25: 28.0, worstStation: "Alandur Bus Depot", stationCount: 8, lat: 13.0827, lon: 80.2707, measuredAt: new Date(Date.now() - 55 * 60000).toISOString() },
  { city: "Bhubaneswar", state: "Odisha", aqi: 76, pm25: 25.5, worstStation: "Patia", stationCount: 3, lat: 20.2961, lon: 85.8245, measuredAt: new Date(Date.now() - 115 * 60000).toISOString() },
  { city: "Dehradun", state: "Uttarakhand", aqi: 70, pm25: 23.2, worstStation: "Clock Tower", stationCount: 2, lat: 30.3165, lon: 78.0322, measuredAt: new Date(Date.now() - 130 * 60000).toISOString() },
  { city: "Guwahati", state: "Assam", aqi: 66, pm25: 21.8, worstStation: "Pan Bazar", stationCount: 2, lat: 26.1445, lon: 91.7362, measuredAt: new Date(Date.now() - 85 * 60000).toISOString() },
  { city: "Shimla", state: "Himachal Pradesh", aqi: 52, pm25: 16.0, worstStation: "The Ridge", stationCount: 2, lat: 31.1048, lon: 77.1734, measuredAt: new Date(Date.now() - 140 * 60000).toISOString() },
  { city: "Kochi", state: "Kerala", aqi: 48, pm25: 14.3, worstStation: "Vyttila Junction", stationCount: 3, lat: 9.9312, lon: 76.2673, measuredAt: new Date(Date.now() - 45 * 60000).toISOString() },
  { city: "Panaji", state: "Goa", aqi: 36, pm25: 9.8, worstStation: "Altinho", stationCount: 2, lat: 15.4909, lon: 73.8278, measuredAt: new Date(Date.now() - 60 * 60000).toISOString() },
];
