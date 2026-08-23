-- Open-Meteo CAMS values are a forecast baseline, not station observations.
-- Retaining both issue and target time makes comparisons reproducible when
-- successive forecast cycles revise the same target hour.
CREATE TABLE cams_forecast (
    id            BIGSERIAL PRIMARY KEY,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    issued_at     TIMESTAMPTZ NOT NULL,
    valid_at      TIMESTAMPTZ NOT NULL,
    horizon_hours INTEGER NOT NULL,
    pm25          DOUBLE PRECISION NOT NULL,
    aqi           INTEGER,
    source        TEXT NOT NULL,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (latitude, longitude, issued_at, valid_at, source),
    CONSTRAINT chk_cams_coordinates
        CHECK (latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180),
    CONSTRAINT chk_cams_horizon
        CHECK (horizon_hours >= 0),
    CONSTRAINT chk_cams_pm25
        CHECK (pm25 >= 0)
);

CREATE INDEX idx_cams_forecast_target ON cams_forecast (valid_at DESC, horizon_hours);
