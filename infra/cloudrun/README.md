# Cloud Run deployment

The production stack is Cloud SQL for PostgreSQL 16 with PostGIS, Artifact
Registry, Cloud Run, and Secret Manager. It deploys two public services:
`vaayu-api` and `vaayu-web`. Database credentials and upstream API keys are
never embedded in images or tracked environment files.

## Provision

Authenticate `gcloud`, choose a region, then set non-secret values:

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-south1"
export REPOSITORY="vaayu"
export DB_INSTANCE="vaayu-postgres"
export DB_NAME="vaayu"
export DB_USER="vaayu"
export TAG="$(git rev-parse --short HEAD)"
gcloud config set project "$PROJECT_ID"

gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com \
  run.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com
gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker --location="$REGION"
```

Create a new database. **Do not manually enable PostGIS or create application
tables.** The database must be fresh and empty: Flyway starts with the API and
`V1__enable_postgis.sql` creates the extension before all other migrations.
`baseline-on-migrate` remains false to expose an incorrectly initialized schema.

```bash
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 --region="$REGION" \
  --cpu=1 --memory=3840MiB --availability-type=zonal
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE"
gcloud sql users set-password "$DB_USER" --instance="$DB_INSTANCE" --prompt-for-password
```

Cloud SQL for PostgreSQL supports PostGIS. Use the database-user password as
the value for `vaayu-db-password` below.

## Secrets and runtime identities

Create each secret and paste its value at the prompt; `--data-file=-` avoids
placing it in shell history. The four live source secrets are retained for the
scheduled ingestion jobs; the API currently consumes only the Gemini key.

```bash
for secret in vaayu-db-password vaayu-console-secret vaayu-data-gov-key \
  vaayu-openaq-key vaayu-firms-key vaayu-gemini-key; do
  gcloud secrets create "$secret" --replication-policy=automatic
  gcloud secrets versions add "$secret" --data-file=-
done

gcloud iam service-accounts create vaayu-api
gcloud iam service-accounts create vaayu-web
API_SA="vaayu-api@$PROJECT_ID.iam.gserviceaccount.com"
WEB_SA="vaayu-web@$PROJECT_ID.iam.gserviceaccount.com"
INSTANCE_CONNECTION_NAME="$PROJECT_ID:$REGION:$DB_INSTANCE"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$API_SA" --role="roles/cloudsql.client"
for secret in vaayu-db-password vaayu-console-secret vaayu-gemini-key; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$API_SA" --role="roles/secretmanager.secretAccessor"
done
gcloud secrets add-iam-policy-binding vaayu-console-secret \
  --member="serviceAccount:$WEB_SA" --role="roles/secretmanager.secretAccessor"
```

Create a dedicated ingestion service account later and grant it access only to
`vaayu-data-gov-key`, `vaayu-openaq-key`, and `vaayu-firms-key`; do not reuse
either web-service identity.

## Build and deploy

Build the existing Dockerfiles and publish both images to Artifact Registry:

```bash
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/vaayu-api:$TAG"
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/vaayu-web:$TAG"
gcloud builds submit backend --tag "$API_IMAGE"
gcloud builds submit web --tag "$WEB_IMAGE"
```

Deploy the API first. The Cloud SQL Java Connector in the image authenticates
with the API service account, so there is no public database-IP allowlist. The
temporary CORS origin blocks browser traffic until the web URL is known.

```bash
gcloud run deploy vaayu-api \
  --image="$API_IMAGE" --region="$REGION" --platform=managed \
  --service-account="$API_SA" --allow-unauthenticated --port=8080 \
  --set-env-vars="SPRING_PROFILES_ACTIVE=production,SPRING_DATASOURCE_URL=jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$INSTANCE_CONNECTION_NAME&socketFactory=com.google.cloud.sql.postgres.SocketFactory,POSTGRES_USER=$DB_USER,WEB_ALLOWED_ORIGIN=https://example.invalid" \
  --set-secrets="POSTGRES_PASSWORD=vaayu-db-password:latest,CONSOLE_SHARED_SECRET=vaayu-console-secret:latest,GEMINI_API_KEY=vaayu-gemini-key:latest"

API_URL="$(gcloud run services describe vaayu-api --region="$REGION" --format='value(status.url)')"
```

`NEXT_PUBLIC_API_URL` is deliberately built as `/api`. Browser calls remain
same-origin and Next.js proxies them at runtime to `INTERNAL_API_URL`; server
components use that internal URL directly. This prevents the deployed API URL
from being baked into the frontend, and leaves `CONSOLE_SECRET` server-only.

```bash
gcloud run deploy vaayu-web \
  --image="$WEB_IMAGE" --region="$REGION" --platform=managed \
  --service-account="$WEB_SA" --allow-unauthenticated --port=8080 \
  --set-env-vars="INTERNAL_API_URL=$API_URL,NEXT_PUBLIC_API_URL=/api" \
  --set-secrets="CONSOLE_SECRET=vaayu-console-secret:latest"

WEB_URL="$(gcloud run services describe vaayu-web --region="$REGION" --format='value(status.url)')"
gcloud run services update vaayu-api --region="$REGION" \
  --update-env-vars="WEB_ALLOWED_ORIGIN=$WEB_URL"
```

`WEB_ALLOWED_ORIGIN` is explicit and is never `*`. Local Compose uses the same
configuration model with `http://localhost:3000` and `http://backend:8080`.

## Verify

```bash
curl --fail "$API_URL/actuator/health"
curl --fail "$WEB_URL"
curl --fail "$WEB_URL/api/v1/public/stations"
gcloud run services logs read vaayu-api --region="$REGION" --limit=100
```

The initial API deployment can take longer while Flyway installs PostGIS and
applies migrations. Record a public URL only after all three HTTP checks pass.
Rotate a secret by adding a new Secret Manager version and redeploying the
service that consumes it.
