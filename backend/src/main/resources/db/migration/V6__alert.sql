-- Alert packets and their delivery outbox.
--
-- Mirrors the alert packet schema in docs/TECHNICAL.md section 7.3. Every alert
-- carries its model version, its uncertainty interval, and its evidence
-- provenance, so an authority acting on it can audit it.

CREATE TABLE alert (
    id                     BIGSERIAL PRIMARY KEY,
    alert_id               TEXT NOT NULL UNIQUE,
    issued_at              TIMESTAMPTZ NOT NULL,
    horizon_hours          INTEGER NOT NULL,
    predicted_aqi          INTEGER NOT NULL,
    ci_low                 INTEGER NOT NULL,
    ci_high                INTEGER NOT NULL,
    recommended_grap_stage TEXT NOT NULL,
    statutory_basis        TEXT NOT NULL,
    jurisdiction           TEXT[] NOT NULL,
    mandated_actions       TEXT[] NOT NULL,
    exposed_population     BIGINT,
    dominant_source        JSONB,
    escalation             JSONB,
    model_version          TEXT NOT NULL,
    evidence_sources       TEXT[] NOT NULL,
    source                 TEXT NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_alert_stage
        CHECK (recommended_grap_stage IN ('I', 'II', 'III', 'IV')),
    CONSTRAINT chk_alert_interval_order
        CHECK (ci_low <= ci_high)
);

CREATE INDEX idx_alert_issued_at ON alert (issued_at DESC);

-- Transactional outbox, written in the same transaction as the alert itself.
-- This replaces Pub/Sub: at this scale a table plus a poller is one fewer
-- managed service without any loss of delivery guarantee.
CREATE TABLE alert_outbox (
    id             BIGSERIAL PRIMARY KEY,
    alert_id       BIGINT NOT NULL REFERENCES alert(id) ON DELETE CASCADE,
    channel        TEXT NOT NULL,
    payload        JSONB NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING',
    attempts       INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at  TIMESTAMPTZ,
    CONSTRAINT chk_outbox_status
        CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_alert_outbox_pending ON alert_outbox (status, created_at)
    WHERE status = 'PENDING';
