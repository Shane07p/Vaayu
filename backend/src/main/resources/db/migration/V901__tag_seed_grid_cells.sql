-- Tag the demo grid cells as SEED.
--
-- V12 added grid_cell.covariate_source and tried to tag demo rows in the same
-- migration. Flyway orders by version, so V12 runs before V900: on a fresh
-- database that UPDATE matched zero rows because grid_cell was still empty, and
-- the 400 demo cells V900 inserts afterwards silently took the APPROXIMATED
-- default instead.
--
-- The consequence is not cosmetic. APPROXIMATED means "a real cell whose
-- covariates are distance-derived stand-ins"; SEED means "demo data, never
-- observed". Conflating them makes demo cells indistinguishable from pilot
-- cells, and vaayu_ml.db.load_station_cell_map excludes demo cells with
-- `WHERE covariate_source <> 'SEED'`, so mistagged rows leak into the station
-- to grid mapping the nowcast trains on.
--
-- This runs after V900 (901 > 900) and is idempotent, so it corrects both fresh
-- databases and any that already applied V12 and V900 in that order. V900 is
-- deliberately left untouched: editing an applied migration changes its
-- checksum and breaks every database that already ran it.

UPDATE grid_cell
   SET covariate_source = 'SEED'
 WHERE code LIKE 'SEED-%'
   AND covariate_source <> 'SEED';
