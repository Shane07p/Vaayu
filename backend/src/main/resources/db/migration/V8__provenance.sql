-- Model and ingestion provenance.
--
-- Every prediction in this database names a model_version. This table is where
-- that version resolves to a training date and a metrics blob, so an alert can
-- be audited back to the run that produced it.

CREATE TABLE model_run (
    id             BIGSERIAL PRIMARY KEY,
    model_name     TEXT NOT NULL,
    model_version  TEXT NOT NULL,
    trained_at     TIMESTAMPTZ NOT NULL,
    metrics        JSONB NOT NULL,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (model_name, model_version)
);

-- SOURCE_UNAVAILABLE is a first-class status rather than a flavour of FAILED.
-- The console must be able to tell a user "the upstream is down" as distinct
-- from "our job crashed", because those warrant different responses.
CREATE TABLE ingestion_run (
    id           BIGSERIAL PRIMARY KEY,
    source       TEXT NOT NULL,
    mode         TEXT NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL,
    finished_at  TIMESTAMPTZ,
    status       TEXT NOT NULL,
    row_count    INTEGER,
    error        TEXT,
    CONSTRAINT chk_ingestion_mode
        CHECK (mode IN ('FIXTURE', 'LIVE')),
    CONSTRAINT chk_ingestion_status
        CHECK (status IN ('RUNNING', 'SUCCESS', 'SOURCE_UNAVAILABLE', 'FAILED'))
);

CREATE INDEX idx_ingestion_run_source ON ingestion_run (source, started_at DESC);
