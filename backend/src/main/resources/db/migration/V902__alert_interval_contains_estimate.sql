-- An alert's interval must contain its own point estimate.
--
-- forecast.ci_low/ci_high bound pm25 in ug/m3. alert.ci_low/ci_high bound
-- predicted_aqi on the AQI scale. AlertWriterService copied one into the other
-- without converting, so alerts were issued reading "AQI 428, 90% interval 146
-- to 196" -- an interval that does not contain the number it is an interval for.
--
-- V6 already checks ci_low <= ci_high, which this passed: both bounds were
-- internally consistent, just measuring a different quantity. Checking the
-- interval against the estimate is what actually catches a unit mismatch.
--
-- This is the same reasoning as chk_grid_prediction_quantile_order and
-- forecast.baseline_persistence NOT NULL: an alert recommends statutory
-- restrictions, and the interval is the project's central honesty claim, so it
-- should be structurally impossible to state one that is nonsense.

-- Alerts violating the invariant were produced by the unconverted path and are
-- provably wrong rather than merely stale. They are derived data, regenerated
-- on the next scheduled run, so removing them loses nothing recoverable.
-- Deliberately narrow: only rows that fail the invariant are touched.
DELETE FROM alert
 WHERE ci_low > predicted_aqi
    OR predicted_aqi > ci_high;

ALTER TABLE alert
    ADD CONSTRAINT chk_alert_interval_contains_estimate
    CHECK (ci_low <= predicted_aqi AND predicted_aqi <= ci_high);
