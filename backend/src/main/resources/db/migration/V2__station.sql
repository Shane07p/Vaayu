-- Station registry and readings.
--
-- Ingested from the sanctioned data.gov.in CPCB resource and from OpenAQ v3.
-- The app.cpcbccr.com station API used by many projects is reverse-engineered
-- and unofficial; it is deliberately not a source here.

CREATE TABLE station (
    id           BIGSERIAL PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    city         TEXT,
    state        TEXT,
    geom         geography(Point, 4326) NOT NULL,
    source       TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_station_geom ON station USING GIST (geom);

-- Pollutant columns are nullable on purpose: CPCB stations report different
-- pollutant sets, and a station reporting only PM10 is real data, not an error.
CREATE TABLE station_reading (
    id           BIGSERIAL PRIMARY KEY,
    station_id   BIGINT NOT NULL REFERENCES station(id) ON DELETE CASCADE,
    ts           TIMESTAMPTZ NOT NULL,
    pm25         DOUBLE PRECISION,
    pm10         DOUBLE PRECISION,
    no2          DOUBLE PRECISION,
    so2          DOUBLE PRECISION,
    co           DOUBLE PRECISION,
    o3           DOUBLE PRECISION,
    source       TEXT NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (station_id, ts, source)
);

CREATE INDEX idx_station_reading_ts ON station_reading (ts DESC);
CREATE INDEX idx_station_reading_station_ts ON station_reading (station_id, ts DESC);
