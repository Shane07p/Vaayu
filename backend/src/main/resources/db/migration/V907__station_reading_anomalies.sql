-- Readings which fail a deliberately conservative data-quality check.
--
-- A flag is not a claim that a value is false. It is a reason to withhold that
-- value from rankings and "air near you" until a person reviews it. The source
-- value remains intact in station_reading so the decision can be audited.
CREATE TABLE station_reading_anomaly (
    reading_id   BIGINT NOT NULL REFERENCES station_reading(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,
    details      JSONB NOT NULL,
    status       TEXT NOT NULL DEFAULT 'OPEN',
    detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at  TIMESTAMPTZ,
    reviewed_by  TEXT,
    CONSTRAINT chk_station_reading_anomaly_reason CHECK (
        reason IN ('IMPOSSIBLE_CONCENTRATION', 'STUCK_SENSOR', 'NEIGHBOUR_OUTLIER')
    ),
    CONSTRAINT chk_station_reading_anomaly_status CHECK (
        status IN ('OPEN', 'CONFIRMED', 'DISMISSED')
    ),
    CONSTRAINT chk_station_reading_anomaly_review CHECK (
        (status = 'OPEN' AND reviewed_at IS NULL AND reviewed_by IS NULL)
        OR (status IN ('CONFIRMED', 'DISMISSED') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    ),
    PRIMARY KEY (reading_id, reason)
);

CREATE INDEX idx_station_reading_anomaly_active
    ON station_reading_anomaly (reading_id)
    WHERE status IN ('OPEN', 'CONFIRMED');

-- The collector can be healthy while a connector regresses from 250 rows/hour
-- to zero. This view is the dashboard contract: Grafana reads it directly and
-- does not fabricate a rate from a service heartbeat.
CREATE VIEW station_reading_hourly_throughput AS
SELECT date_trunc('hour', ingested_at) AS hour,
       source,
       COUNT(*) AS rows_ingested,
       COUNT(*) FILTER (WHERE pm25 IS NOT NULL) AS pm25_rows
FROM station_reading
GROUP BY date_trunc('hour', ingested_at), source;
