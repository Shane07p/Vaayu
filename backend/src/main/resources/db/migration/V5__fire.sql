-- Fire detections, clusters, and downwind impact ranking.
--
-- FIRMS detections are a floor, not a census. Satellites overpass at roughly
-- 13:30 and after midnight, and burning has demonstrably shifted to evening
-- hours to evade them. Citizen reports partially mitigate this gap; they do
-- not close it.

CREATE TABLE fire_detection (
    id           BIGSERIAL PRIMARY KEY,
    external_id  TEXT,
    ts           TIMESTAMPTZ NOT NULL,
    geom         geography(Point, 4326) NOT NULL,
    frp          DOUBLE PRECISION,
    confidence   TEXT,
    sensor       TEXT NOT NULL,
    source       TEXT NOT NULL,
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fire_detection_geom ON fire_detection USING GIST (geom);
CREATE INDEX idx_fire_detection_ts ON fire_detection (ts DESC);

CREATE TABLE fire_cluster (
    id               BIGSERIAL PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    detection_date   DATE NOT NULL,
    centroid         geography(Point, 4326) NOT NULL,
    detection_count  INTEGER NOT NULL,
    total_frp        DOUBLE PRECISION NOT NULL,
    tehsil           TEXT,
    district         TEXT,
    state            TEXT,
    source           TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fire_cluster_date ON fire_cluster (detection_date DESC);
CREATE INDEX idx_fire_cluster_centroid ON fire_cluster USING GIST (centroid);

-- This table is what turns "3,400 fires detected" into a ranked worklist of a
-- dozen clusters. consecutive_days_unactioned drives the CAQM Direction 95
-- escalation flag, which the API derives rather than stores.
CREATE TABLE fire_cluster_impact (
    id                          BIGSERIAL PRIMARY KEY,
    fire_cluster_id             BIGINT NOT NULL REFERENCES fire_cluster(id) ON DELETE CASCADE,
    receptor                    TEXT NOT NULL,
    impact_score                DOUBLE PRECISION NOT NULL,
    impact_rank                 INTEGER NOT NULL,
    downwind_population         BIGINT,
    transport_hours             DOUBLE PRECISION,
    trajectory_confidence       DOUBLE PRECISION,
    consecutive_days_unactioned INTEGER NOT NULL DEFAULT 0,
    model_version               TEXT NOT NULL,
    source                      TEXT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (fire_cluster_id, receptor, model_version),
    CONSTRAINT chk_impact_confidence
        CHECK (trajectory_confidence IS NULL
               OR (trajectory_confidence >= 0 AND trajectory_confidence <= 1))
);

CREATE INDEX idx_fire_cluster_impact_rank ON fire_cluster_impact (receptor, impact_rank);
