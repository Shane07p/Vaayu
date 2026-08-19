-- Demo seed data.
--
-- Exists so the frontend member is not blocked on the ingestion member. Every
-- row here carries source = 'SEED' so it can never be mistaken for observed
-- telemetry, and the UI badges any SEED-derived value as CACHED.
--
-- These are real station coordinates with entirely synthetic readings.

INSERT INTO station (code, name, city, state, geom, source) VALUES
  ('SEED-DL-001', 'Anand Vihar',        'Delhi',    'Delhi',         ST_GeogFromText('POINT(77.3152 28.6469)'), 'SEED'),
  ('SEED-DL-002', 'R K Puram',          'Delhi',    'Delhi',         ST_GeogFromText('POINT(77.1855 28.5631)'), 'SEED'),
  ('SEED-DL-003', 'Punjabi Bagh',       'Delhi',    'Delhi',         ST_GeogFromText('POINT(77.1314 28.6741)'), 'SEED'),
  ('SEED-HR-001', 'Gurugram Sector 51', 'Gurugram', 'Haryana',       ST_GeogFromText('POINT(77.0688 28.4211)'), 'SEED'),
  ('SEED-UP-001', 'Noida Sector 125',   'Noida',    'Uttar Pradesh', ST_GeogFromText('POINT(77.3250 28.5445)'), 'SEED');

-- 24 hours of synthetic readings per station, with a diurnal shape.
INSERT INTO station_reading (station_id, ts, pm25, pm10, no2, source)
SELECT s.id,
       date_trunc('hour', now()) - (h || ' hours')::interval,
       120 + 60 * sin(h / 4.0) + (s.id * 7 % 25),
       210 + 90 * sin(h / 4.0),
       40  + 15 * cos(h / 3.0),
       'SEED'
FROM station s CROSS JOIN generate_series(0, 23) AS h
WHERE s.source = 'SEED';

-- A 20x20 cell demo grid over the Delhi-Gurugram area, roughly 1 km cells.
INSERT INTO grid_cell (code, geom, centroid, population, district, state)
SELECT
  format('SEED-GRID-%s-%s', gx, gy),
  ST_MakeEnvelope(76.9 + gx * 0.01, 28.4 + gy * 0.01,
                  76.9 + (gx + 1) * 0.01, 28.4 + (gy + 1) * 0.01, 4326),
  ST_GeogFromText(format('POINT(%s %s)', 76.9 + gx * 0.01 + 0.005,
                                          28.4 + gy * 0.01 + 0.005)),
  5000 + (gx * gy * 37) % 20000,
  'Demo District',
  'Delhi'
FROM generate_series(0, 19) AS gx CROSS JOIN generate_series(0, 19) AS gy;

INSERT INTO grid_prediction
  (grid_cell_id, ts, pm25_q10, pm25_q50, pm25_q90, coverage_fraction, model_version, source)
SELECT g.id,
       date_trunc('hour', now()),
       90  + (g.id % 40),
       140 + (g.id % 60),
       200 + (g.id % 90),
       0.6 + (g.id % 4) * 0.1,
       'seed-v0',
       'SEED'
FROM grid_cell g WHERE g.code LIKE 'SEED-GRID-%';

-- Forecasts at all three horizons, each carrying its persistence baseline.
INSERT INTO forecast
  (station_id, issued_at, horizon_hours, valid_at, pm25, aqi, ci_low, ci_high,
   baseline_persistence, baseline_cams, model_version, source)
SELECT s.id,
       date_trunc('hour', now()),
       t.hz,
       date_trunc('hour', now()) + (t.hz || ' hours')::interval,
       160 + t.hz,
       300 + t.hz,
       140 + t.hz,
       190 + t.hz,
       155.0,
       165.0,
       'seed-v0',
       'SEED'
FROM station s CROSS JOIN (VALUES (6), (24), (72)) AS t(hz)
WHERE s.source = 'SEED';

INSERT INTO fire_cluster
  (code, detection_date, centroid, detection_count, total_frp, tehsil, district, state, source)
VALUES
  ('SEED-PB-SGR-0412', CURRENT_DATE, ST_GeogFromText('POINT(74.8723 31.6340)'),
   47, 812.5, 'Ajnala', 'Amritsar', 'Punjab', 'SEED'),
  ('SEED-HR-KTL-0198', CURRENT_DATE, ST_GeogFromText('POINT(76.3869 29.6857)'),
   23, 415.2, 'Gharaunda', 'Karnal', 'Haryana', 'SEED');

-- The first cluster is flagged at 3 consecutive unactioned days, which makes it
-- Direction 95 eligible. The API derives that flag rather than storing it.
INSERT INTO fire_cluster_impact
  (fire_cluster_id, receptor, impact_score, impact_rank, downwind_population,
   transport_hours, trajectory_confidence, consecutive_days_unactioned,
   model_version, source)
SELECT c.id, 'DELHI-NCR',
       CASE WHEN c.code LIKE '%SGR%' THEN 0.87 ELSE 0.64 END,
       CASE WHEN c.code LIKE '%SGR%' THEN 1 ELSE 2 END,
       CASE WHEN c.code LIKE '%SGR%' THEN 18400000 ELSE 9200000 END,
       CASE WHEN c.code LIKE '%SGR%' THEN 22.5 ELSE 14.0 END,
       0.81,
       CASE WHEN c.code LIKE '%SGR%' THEN 3 ELSE 0 END,
       'seed-v0', 'SEED'
FROM fire_cluster c WHERE c.source = 'SEED';

INSERT INTO alert
  (alert_id, issued_at, horizon_hours, predicted_aqi, ci_low, ci_high,
   recommended_grap_stage, statutory_basis, jurisdiction, mandated_actions,
   exposed_population, dominant_source, escalation, model_version,
   evidence_sources, source)
VALUES (
  'SEED-VAAYU-0001', now(), 48, 428, 391, 461, 'III',
  'CAQM GRAP Schedule (rev. 2025-11-21), Stage III',
  ARRAY['DPCC', 'GMDA', 'UPPCB'],
  ARRAY['halt_non_essential_construction', 'close_brick_kilns'],
  18400000,
  '{"type":"crop_residue_transport","clusters":["SEED-PB-SGR-0412"],"trajectory_confidence":0.81}'::jsonb,
  '{"direction_95_eligible":true,"consecutive_days_unactioned":3}'::jsonb,
  'seed-v0',
  ARRAY['SEED'],
  'SEED'
);

INSERT INTO citizen_report (geom, gemini_band, confidence, status, source)
VALUES
  (ST_GeogFromText('POINT(77.2090 28.6139)'), 'POOR',     0.62, 'PENDING',  'SEED'),
  (ST_GeogFromText('POINT(76.7794 30.7333)'), 'SEVERE',   0.48, 'ACCEPTED', 'SEED');

INSERT INTO model_run (model_name, model_version, trained_at, metrics, notes)
VALUES ('seed', 'seed-v0', now(),
        '{"note":"seed data, not a trained model"}'::jsonb,
        'Demo seed rows. Not a model run. Replace once nowcast_xgb has trained.');

INSERT INTO ingestion_run (source, mode, started_at, finished_at, status, row_count)
VALUES ('SEED', 'FIXTURE', now(), now(), 'SUCCESS', 5);
