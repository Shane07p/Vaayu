<#!
.SYNOPSIS
Build and deploy the unattended hourly OpenAQ collector, then schedule it.

.DESCRIPTION
The job uses the same command declared in infra/scheduler-jobs.json. It does
not make failed live calls look like fixtures: the connector records the source
failure in ingestion_run and exits non-zero. Cloud Scheduler is deliberately
outside a developer laptop, so a reboot cannot age every station out.

Before running, create vaayu-ingestion-database-url as a Secret Manager value
containing a percent-encoded SQLAlchemy PostgreSQL URL that uses the Cloud SQL
Unix socket, for example:
postgresql+psycopg://vaayu:PASSWORD@/vaayu?host=/cloudsql/PROJECT:REGION:INSTANCE
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$Region,
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$InstanceConnectionName,
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
$Jobs = Get-Content (Join-Path $Root "infra\\scheduler-jobs.json") -Raw | ConvertFrom-Json
$Collector = $Jobs.jobs | Where-Object name -eq "vaayu-openaq-latest"
if ($null -eq $Collector) { throw "vaayu-openaq-latest is missing from scheduler-jobs.json" }

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/vaayu-ingestion:$Tag"
$ServiceAccount = "vaayu-ingestion@$ProjectId.iam.gserviceaccount.com"
$SchedulerAccount = "vaayu-scheduler@$ProjectId.iam.gserviceaccount.com"
$JobName = "vaayu-openaq-latest"
$ScheduleName = "vaayu-openaq-latest-hourly"
$Command = $Collector.command[3]
$Arguments = ($Collector.command | Select-Object -Skip 4) -join ","

gcloud config set project $ProjectId
gcloud builds submit $Root --file (Join-Path $Root "ingestion\\Dockerfile") --tag $Image

gcloud run jobs deploy $JobName --image $Image --region $Region --service-account $ServiceAccount `
    --set-cloudsql-instances $InstanceConnectionName `
    --set-secrets "DATABASE_URL=vaayu-ingestion-database-url:latest,OPENAQ_API_KEY=vaayu-openaq-key:latest" `
    --command $Command --args $Arguments --task-timeout "$($Collector.timeout_seconds)s" --max-retries 0

# Cloud Scheduler invokes the Cloud Run Jobs v2 run endpoint with an OAuth token.
# The scheduler identity needs roles/run.invoker on this job; grant it once before
# the first run rather than embedding a user credential in this script.
$Uri = "https://run.googleapis.com/v2/projects/$ProjectId/locations/$Region/jobs/${JobName}:run"
gcloud scheduler jobs delete $ScheduleName --location $Region --quiet 2>$null
gcloud scheduler jobs create http $ScheduleName --location $Region `
    --schedule $Collector.schedule --time-zone $Collector.timezone --http-method POST --uri $Uri `
    --oauth-service-account-email $SchedulerAccount

Write-Host "Deployed $JobName and scheduled $($Collector.schedule) $($Collector.timezone)."
Write-Host "Import infra/monitoring/grafana-ingestion-throughput.json into Grafana with the production PostgreSQL datasource."
