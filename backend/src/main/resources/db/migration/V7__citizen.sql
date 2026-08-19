-- Citizen photo reports.
--
-- Two deliberate omissions:
--
-- 1. There is no numeric concentration column. Published work on estimating
--    PM2.5 from a photograph tops out around R-squared 0.6 and degrades badly
--    with camera pipeline, exposure, sun angle, and cloud-versus-haze
--    confusion. gemini_band is constrained to four bands so that no code path
--    can record a microgram-per-cubic-metre value derived from an image.
--
-- 2. There are no personal identifiers. The project commits to collecting no
--    PII beyond coarse geolocation, and the schema offers nowhere to put any.

CREATE TABLE citizen_report (
    id                BIGSERIAL PRIMARY KEY,
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    geom              geography(Point, 4326) NOT NULL,
    photo_uri         TEXT,
    gemini_band       TEXT,
    confidence        DOUBLE PRECISION,
    status            TEXT NOT NULL DEFAULT 'PENDING',
    corroborated_by   TEXT[],
    source            TEXT NOT NULL,
    CONSTRAINT chk_citizen_band
        CHECK (gemini_band IS NULL
               OR gemini_band IN ('GOOD', 'MODERATE', 'POOR', 'SEVERE')),
    CONSTRAINT chk_citizen_status
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SPAM')),
    CONSTRAINT chk_citizen_confidence
        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_citizen_report_geom ON citizen_report USING GIST (geom);
CREATE INDEX idx_citizen_report_status ON citizen_report (status, submitted_at DESC);
