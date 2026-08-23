-- A forecast's AQI must be the CPCB conversion of its own PM2.5.
--
-- V900 seeded the two as unrelated arithmetic on the horizon:
--
--     pm25 = 160 + hz
--     aqi  = 300 + hz
--
-- so a 6 hour forecast stored pm25 166 alongside AQI 306, where the CPCB scale
-- gives 336. The two columns describe the same prediction and disagreed by
-- thirty points.
--
-- This surfaced when the API began converting ci_low/ci_high to the AQI scale
-- for the citizen chart, which had been scaling them by a made-up 1.5. The
-- converted interval, 320 to 358, did not contain the stored estimate of 306.
-- chk_alert_interval_contains_estimate rejects exactly this shape on alert;
-- forecast has no equivalent, so the inconsistency sat in the demo data
-- unnoticed.
--
-- V900 is already applied, so it is corrected here rather than edited: changing
-- an applied migration fails Flyway's checksum on every existing database.
--
-- Only seeded rows are touched. A row written by a real model run is that
-- model's output and is not ours to rewrite; if one is inconsistent, that is a
-- defect in the model pipeline and should be visible rather than patched over.
UPDATE forecast
   SET aqi = CASE
        -- CPCB PM2.5 breakpoints, mirroring org.vaayu.grap.AqiScale and
        -- pm25_to_aqi in ml/src/vaayu_ml/models/forecast_lgbm.py. Contiguous on
        -- the concentration axis: the published integer bands leave gaps, and a
        -- value landing in one converted to AQI 500, which is GRAP Stage IV.
        WHEN pm25 <   0 THEN 0
        WHEN pm25 <=  30 THEN floor((50.0  /  30.0) *  pm25)
        WHEN pm25 <=  60 THEN floor( 51.0 + (49.0  /  30.0) * (pm25 -  30))
        WHEN pm25 <=  90 THEN floor(101.0 + (99.0  /  30.0) * (pm25 -  60))
        WHEN pm25 <= 120 THEN floor(201.0 + (99.0  /  30.0) * (pm25 -  90))
        WHEN pm25 <= 250 THEN floor(301.0 + (99.0  / 130.0) * (pm25 - 120))
        ELSE 500
   END
 WHERE source = 'SEED'
   AND pm25 IS NOT NULL;
