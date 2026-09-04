-- Stop serving seed grid predictions, forecasts, and alerts as live data.
--
-- PLAN §4.5: "The seed surface and seed alerts must stop being rendered as
-- predictions." Showing them with an amber CACHED chip is explicitly listed
-- as "not acceptable."
--
-- Strategy: add demo_only = true flags rather than DELETE, so:
--   1. The /example demonstration route can still narrate the seed alert.
--   2. V900 is not edited (editing an applied migration breaks Flyway checksum).
--   3. The change is reversible without a data-destructive migration.
--
-- Real ingestion rows (source <> 'SEED') are never touched.

ALTER TABLE grid_prediction
    ADD COLUMN IF NOT EXISTS demo_only boolean NOT NULL DEFAULT false;

ALTER TABLE forecast
    ADD COLUMN IF NOT EXISTS demo_only boolean NOT NULL DEFAULT false;

ALTER TABLE alert
    ADD COLUMN IF NOT EXISTS demo_only boolean NOT NULL DEFAULT false;

UPDATE grid_prediction SET demo_only = true WHERE source = 'SEED';
UPDATE forecast         SET demo_only = true WHERE source = 'SEED';
UPDATE alert            SET demo_only = true WHERE source = 'SEED';
