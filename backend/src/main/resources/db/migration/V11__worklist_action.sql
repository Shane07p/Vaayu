-- Audit the most recent district-authority action without keeping personal data.
ALTER TABLE fire_cluster_impact ADD COLUMN last_actioned_at TIMESTAMPTZ;
ALTER TABLE fire_cluster_impact ADD COLUMN actioned_by TEXT;
