-- A source can complete useful work while a bounded subset of independent
-- units fails. Keeping PARTIAL distinct prevents both discarded progress and
-- a misleading full-success provenance record.
ALTER TABLE ingestion_run
    DROP CONSTRAINT chk_ingestion_status;

ALTER TABLE ingestion_run
    ADD CONSTRAINT chk_ingestion_status
    CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL', 'SOURCE_UNAVAILABLE', 'FAILED'));
