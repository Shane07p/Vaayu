-- Earth Engine satellite and meteorological snapshots.
--
-- These three tables are the dynamic feature layer joined to grid_cell's static
-- covariates at prediction time. Ingestion writes them; the ML package reads
-- them to build the training table.
--
-- Every table carries coverage or quality information alongside its values.
-- That is deliberate: satellite retrievals fail non-randomly, and a pipeline
-- that cannot distinguish "clean air" from "could not see" will silently
-- mislead. Published Indian work found gap-blind analysis overestimated
-- attributable mortality by roughly 94,000 deaths over 2017-2022.

-- MODIS MAIAC aerosol optical depth, MODIS/061/MCD19A2_GRANULES at 1 km daily.
--
-- AOD is a column-integrated optical measure, not a surface concentration.
-- There is deliberately no pm25_estimate column here: converting AOD with a
-- linear constant is the most common technical error in this problem space,
-- and the schema should not offer somewhere to put the result.
CREATE TABLE gee_aod_snapshot (
    id                BIGSERIAL PRIMARY KEY,
    grid_cell_id      BIGINT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    ts                TIMESTAMPTZ NOT NULL,
    aod_047           DOUBLE PRECISION,
    aod_055           DOUBLE PRECISION,
    aod_uncertainty   DOUBLE PRECISION,
    column_wv         DOUBLE PRECISION,
    -- Fraction of the cell with a QA-passing retrieval. 0 means the satellite
    -- could not see this cell at all, which is information, not absence.
    coverage_fraction DOUBLE PRECISION NOT NULL,
    qa_passed         BOOLEAN NOT NULL DEFAULT TRUE,
    source            TEXT NOT NULL,
    ingested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (grid_cell_id, ts),
    CONSTRAINT chk_aod_coverage
        CHECK (coverage_fraction >= 0 AND coverage_fraction <= 1),
    -- A cell with zero coverage must not also claim a value.
    CONSTRAINT chk_aod_no_value_without_coverage
        CHECK (coverage_fraction > 0 OR (aod_047 IS NULL AND aod_055 IS NULL))
);

CREATE INDEX idx_gee_aod_snapshot_ts ON gee_aod_snapshot (ts DESC);
CREATE INDEX idx_gee_aod_snapshot_cell_ts ON gee_aod_snapshot (grid_cell_id, ts DESC);

-- Sentinel-5P TROPOMI, COPERNICUS/S5P/NRTI/L3_NO2 and L3_AER_AI.
--
-- no2_column has no non-negative constraint on purpose. S5P returns small
-- negative column values over clean regions; these are physically meaningful
-- retrieval noise and clipping them to zero biases the feature.
CREATE TABLE gee_s5p_snapshot (
    id                BIGSERIAL PRIMARY KEY,
    grid_cell_id      BIGINT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    ts                TIMESTAMPTZ NOT NULL,
    no2_column        DOUBLE PRECISION,
    aer_ai            DOUBLE PRECISION,
    coverage_fraction DOUBLE PRECISION NOT NULL,
    source            TEXT NOT NULL,
    ingested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (grid_cell_id, ts),
    CONSTRAINT chk_s5p_coverage
        CHECK (coverage_fraction >= 0 AND coverage_fraction <= 1)
);

CREATE INDEX idx_gee_s5p_snapshot_ts ON gee_s5p_snapshot (ts DESC);
CREATE INDEX idx_gee_s5p_snapshot_cell_ts ON gee_s5p_snapshot (grid_cell_id, ts DESC);

-- Meteorology from ECMWF/ERA5/HOURLY (reanalysis) and NOAA/GFS0P25 (forecast).
--
-- boundary_layer_height is the feature that makes column AOD translate to
-- surface PM2.5 or not, so it is not optional. wind_u and wind_v feed the
-- back-trajectory in ml.trajectory.
CREATE TABLE met_snapshot (
    id                    BIGSERIAL PRIMARY KEY,
    grid_cell_id          BIGINT NOT NULL REFERENCES grid_cell(id) ON DELETE CASCADE,
    ts                    TIMESTAMPTZ NOT NULL,
    -- FORECAST rows are valid in the future; REANALYSIS rows describe the past.
    kind                  TEXT NOT NULL DEFAULT 'REANALYSIS',
    boundary_layer_height DOUBLE PRECISION,
    wind_u                DOUBLE PRECISION,
    wind_v                DOUBLE PRECISION,
    temp_2m               DOUBLE PRECISION,
    relative_humidity     DOUBLE PRECISION,
    surface_pressure      DOUBLE PRECISION,
    precipitation         DOUBLE PRECISION,
    source                TEXT NOT NULL,
    ingested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (grid_cell_id, ts, kind),
    CONSTRAINT chk_met_kind
        CHECK (kind IN ('REANALYSIS', 'FORECAST')),
    CONSTRAINT chk_met_humidity
        CHECK (relative_humidity IS NULL
               OR (relative_humidity >= 0 AND relative_humidity <= 100)),
    CONSTRAINT chk_met_blh
        CHECK (boundary_layer_height IS NULL OR boundary_layer_height >= 0)
);

CREATE INDEX idx_met_snapshot_ts ON met_snapshot (ts DESC);
CREATE INDEX idx_met_snapshot_cell_ts ON met_snapshot (grid_cell_id, ts DESC);
CREATE INDEX idx_met_snapshot_kind ON met_snapshot (kind, ts DESC);
