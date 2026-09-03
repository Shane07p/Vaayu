-- A country is not a city, so stop three stations claiming to be one.
--
-- OpenAQ returns `locality` as null for almost every Indian station, and the
-- connector originally trusted it whenever it was set. It is not always a city:
-- three stations -- named "New Delhi", "Mumbai" and "Chennai" -- come back with
-- locality "India", and that string was stored in station.city.
--
-- The citizen ranking groups by station.city and orders cities by their worst
-- reporting station, so "India" appeared in "worst air right now" as a city in
-- its own right. Worse than merely wrong: because it pooled stations from three
-- different metros, it aggregated across half the country and could outrank
-- every real entry on the list.
--
-- These three names carry no comma and so yield no city from the name either
-- (see STATION_CITY in openaq_latest.py). They are therefore left null rather
-- than guessed at, which moves them into the ranking's `unattributedStations`
-- count, where a reader can see that some reporting stations could not be
-- placed. An omission that is counted beats an attribution that is wrong.
--
-- The connector no longer writes this value: `_city_of` refuses a locality
-- equal to the station's own country name or code. This repairs the rows that
-- were written before it did.
UPDATE station s
   SET city = NULL
 WHERE s.city IS NOT NULL
   AND lower(btrim(s.city)) IN ('india', 'in');
