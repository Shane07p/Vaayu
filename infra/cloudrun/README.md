# Cloud Run definitions

Unapplied. Provisioned at first deploy, not during scaffolding.

## What deploys here

| Resource | Type | Notes |
|---|---|---|
| `vaayu-api` | Cloud Run **Service** | Spring Boot, public |
| `vaayu-web` | Cloud Run **Service** | Next.js, public |
| `vaayu-ingest-*` | Cloud Run **Job** | One per source, triggered by Cloud Scheduler |
| `vaayu-train` | Cloud Run **Job** | Model retraining |

Jobs and Services are distinct resources with distinct deployment paths. The
Python batch work is a Job, not a Service — it runs to completion and exits.

## Required but absent from the original stack list

- **Artifact Registry** — Cloud Run cannot deploy without a container registry.
- **Secret Manager** — holds the data.gov.in, OpenAQ, FIRMS, and Gemini keys,
  the Earth Engine service-account JSON, and the database password. These must
  not be stored as plaintext Cloud Run environment variables.
- **Cloud SQL Auth Proxy / connector** — the connection path from Cloud Run to
  Cloud SQL.
- **Per-component IAM service accounts** — ingestion needs Earth Engine and
  BigQuery write; the backend needs Cloud SQL, Cloud Storage, and Gemini.
  Neither should hold the other's grants.

## Scheduling

Cloud Scheduler triggers the ingestion and inference Jobs. Without it the
batch-precompute architecture has no clock.
