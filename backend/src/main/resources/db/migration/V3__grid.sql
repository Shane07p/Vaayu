-- 1 km analysis grid with static covariates.
--
-- Covariates come from WorldPop (population), SRTM (elevation), OSM-derived
-- road density, and built-up fraction. They are static per cell and joined to
-- dynamic satellite and meteorological features at prediction time.

CREATE TABLE grid_cell (
    id                BIGSERIAL PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    geom              geometry(Polygon, 4326) NOT NULL,
    centroid          geography(Point, 4326) NOT NULL,
    population        INTEGER,
    elevation_m       DOUBLE PRECISION,
    road_density      DOUBLE PRECISION,
    built_up_fraction DOUBLE PRECISION,
    district          TEXT,
    state             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_grid_cell_geom ON grid_cell USING GIST (geom);
CREATE INDEX idx_grid_cell_centroid ON grid_cell USING GIST (centroid);
