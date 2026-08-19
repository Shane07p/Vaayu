-- Nowcast surface and multi-horizon forecasts.
--
-- The NOT NULL constraints in this migration are the point of it. They make the
-- project's honesty requirements structural rather than a matter of discipline:
-- an uncertainty-free point estimate and a baseline-free forecast are both
-- physically impossible to insert.

CREATE TABLE grid_prediction (
    id                BIGSERIAL PRIMARY KEY,
    grid_cell_id      BIGINT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    ts                TIMESTAMPTZ NOT NULL,
    pm25_q10          DOUBLE PRECISION NOT NULL,
    pm25_q50          DOUBLE PRECISION NOT NULL,
    pm25_q90          DOUBLE PRECISION NOT NULL,
    coverage_fraction DOUBLE PRECISION NOT NULL,
    model_version     TEXT NOT NULL,
    source            TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (grid_cell_id, ts, model_version),
    CONSTRAINT chk_grid_prediction_quantile_order
        CHECK (pm25_q10 <= pm25_q50 AND pm25_q50 <= pm25_q90),
    CONSTRAINT chk_grid_prediction_coverage
        CHECK (coverage_fraction >= 0 AND coverage_fraction <= 1)
);

CREATE INDEX idx_grid_prediction_ts ON grid_prediction (ts DESC);
CREATE INDEX idx_grid_prediction_cell_ts ON grid_prediction (grid_cell_id, ts DESC);

-- baseline_cams is nullable because Open-Meteo may be unreachable.
-- baseline_persistence is not, because it is computed from data already held
-- and there is never an excuse for its absence.
CREATE TABLE forecast (
    id                    BIGSERIAL PRIMARY KEY,
    grid_cell_id          BIGINT REFERENCES grid_cell(id) ON DELETE CASCADE,
    station_id            BIGINT REFERENCES station(id) ON DELETE CASCADE,
    issued_at             TIMESTAMPTZ NOT NULL,
    horizon_hours         INTEGER NOT NULL,
    valid_at              TIMESTAMPTZ NOT NULL,
    pm25                  DOUBLE PRECISION NOT NULL,
    aqi                   INTEGER NOT NULL,
    ci_low                DOUBLE PRECISION NOT NULL,
    ci_high               DOUBLE PRECISION NOT NULL,
    baseline_persistence  DOUBLE PRECISION NOT NULL,
    baseline_cams         DOUBLE PRECISION,
    model_version         TEXT NOT NULL,
    source                TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_forecast_target
        CHECK (num_nonnulls(grid_cell_id, station_id) = 1),
    CONSTRAINT chk_forecast_horizon
        CHECK (horizon_hours IN (6, 24, 72)),
    CONSTRAINT chk_forecast_interval_order
        CHECK (ci_low <= ci_high)
);

CREATE INDEX idx_forecast_valid_at ON forecast (valid_at DESC);
CREATE INDEX idx_forecast_issued_horizon ON forecast (issued_at DESC, horizon_hours);
CREATE INDEX idx_forecast_station ON forecast (station_id, horizon_hours);
