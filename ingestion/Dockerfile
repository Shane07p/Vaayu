# Ingestion runner. Connector jobs run on the compose network against
# postgres:5432 rather than a published host port.
FROM ghcr.io/astral-sh/uv:0.12.5 AS uv

FROM python:3.11-slim

# The pinned uv image and committed lockfile keep image and developer installs
# on the same dependency set.
COPY --from=uv /uv /uvx /usr/local/bin/

WORKDIR /app

# Dependency layer first: source edits do not invalidate the slow geospatial
# dependency install.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY fixtures ./fixtures
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Jobs are invoked explicitly, so starting the stack cannot write to the
# database as a side effect.
CMD ["python", "-c", "print('ingestion image ready; invoke a connector, e.g. docker compose run --rm ingestion vaayu-openmeteo')"]
