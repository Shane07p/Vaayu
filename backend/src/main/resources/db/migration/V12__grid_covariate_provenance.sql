-- Provenance for grid cell covariates.
--
-- population, elevation_m, road_density, and built_up_fraction are model inputs.
-- Until WorldPop, SRTM, and OSM are actually joined, they are geographic
-- approximations derived from distance to the city centre. Without a provenance
-- column an approximation is indistinguishable from a real covariate, and a
-- reader has no way to know which one a prediction rests on.
--
-- APPROXIMATED  distance-based stand-in, not a measurement
-- WORLDPOP      population from WorldPop rasters
-- SRTM          elevation from SRTM DEM
-- OSM           road density derived from OpenStreetMap
-- MIXED         covariates from more than one real source
-- SEED          demo rows, never observed data

ALTER TABLE grid_cell
    ADD COLUMN covariate_source TEXT NOT NULL DEFAULT 'APPROXIMATED';

ALTER TABLE grid_cell
    ADD CONSTRAINT chk_grid_cell_covariate_source
    CHECK (covariate_source IN
        ('APPROXIMATED', 'WORLDPOP', 'SRTM', 'OSM', 'MIXED', 'SEED'));

-- Existing demo rows are seed data, not approximations of anything.
UPDATE grid_cell SET covariate_source = 'SEED' WHERE code LIKE 'SEED-%';

CREATE INDEX idx_grid_cell_covariate_source ON grid_cell (covariate_source);

COMMENT ON COLUMN grid_cell.covariate_source IS
    'Provenance of population, elevation_m, road_density, built_up_fraction. '
    'APPROXIMATED means distance-derived stand-ins, not measurements.';
