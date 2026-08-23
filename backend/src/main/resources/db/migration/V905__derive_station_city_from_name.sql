-- Give existing stations the city their own name already carries.
--
-- OpenAQ's `locality` is null for every Indian station, so `station.city` was
-- null for everything ingested before the connector learned to read the city out
-- of the station name. The boards name their sites consistently:
--
--     "Mayaganj, Bhagalpur - BSPCB"
--     "Bhelupur, Varanasi - UPPCB"
--     "Plammoodu, Thiruvananthapuram - Kerala PCB"
--
-- That is not a guess. It is the operator's own text, and the same expression
-- the ingestion connector uses (`STATION_CITY` in openaq_latest.py).
--
-- This matters because city rankings group by `station.city` and skip rows where
-- it is null. Thirty-eight stations were therefore invisible to "worst air
-- today", and one of them held the highest PM2.5 reading in the database --
-- Bhagalpur at 181 ug/m3, roughly double the worst city the list was showing.
-- A ranking that omits the worst case is not merely incomplete; it is wrong
-- about the thing it exists to report.
--
-- Rows whose names carry no city keep a null one. There is no fallback: a
-- station filed under a guessed city is worse than a station left out, because
-- the omission is visible in the ranking's excluded count and the error is not.
UPDATE station
   SET city = substring(name from '^.+,\s*([^,]+?)\s+-\s+[^,]+$')
 WHERE city IS NULL
   AND substring(name from '^.+,\s*([^,]+?)\s+-\s+[^,]+$') IS NOT NULL;
