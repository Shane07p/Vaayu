-- A scheduled runner may be retried after a successful write but before it
-- reports completion. The logical forecast target and issue time identify one
-- result, while NULLS NOT DISTINCT lets station-target and grid-target rows
-- both use the same constraint without treating their null counterpart as
-- unique every time.
ALTER TABLE forecast
    ADD CONSTRAINT uq_forecast_target_run
    UNIQUE NULLS NOT DISTINCT
    (station_id, grid_cell_id, issued_at, horizon_hours, model_version);
