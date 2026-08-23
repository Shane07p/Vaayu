# Ingestion runner.
#
# Exists so the connectors run on the compose network against postgres:5432
# rather than the published host port. A locally installed PostgreSQL also
# binds 5432 on a developer machine; when both listen, a host connection
# reaches whichever won the bind and fails authentication against the wrong
# server. Running in the network removes the ambiguity, and matches how
# Cloud Scheduler will invoke these jobs.
FROM python:3.11-slim

# uv resolves from the committed lockfile, so an image build and a developer
# machine install the same versions.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dependency layer first: source edits must not invalidate the resolved
# environment, which pulls geopandas and rasterio and is slow to rebuild.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY src ./src
COPY fixtures ./fixtures
RUN uv sync --frozen

ENV PATH="/app/.venv/bin:$PATH"

# No CMD that ingests on its own. Each connector is invoked explicitly, so
# starting the stack never writes to the database as a side effect.
CMD ["python", "-c", "print('ingestion image ready; invoke a connector, e.g. docker compose run --rm ingestion vaayu-openmeteo')"]
