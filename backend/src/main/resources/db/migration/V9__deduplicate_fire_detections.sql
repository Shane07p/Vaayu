-- FIRMS retries are normal after transient upstream or process failures. A
-- source-stable external identifier makes replays idempotent instead of
-- accumulating duplicate detections that would inflate cluster impact scores.
CREATE UNIQUE INDEX uq_fire_detection_external_id
    ON fire_detection (external_id)
    WHERE external_id IS NOT NULL;
