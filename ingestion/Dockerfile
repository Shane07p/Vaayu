# Ingestion runner. Connector jobs run on the compose network against
# postgres:5432 rather than a published host port.
FROM ghcr.io/astral-sh/uv:0.12.5 AS uv

FROM python:3.11-slim

# The pinned uv image and committed lockfile keep image and developer installs
# on the same dependency set.
COPY --from=uv /uv /uvx /usr/local/bin/

WORKDIR /app/ingestion

# Dependency layer first: source edits do not invalidate the slow geospatial
# dependency install.
COPY ingestion/pyproject.toml ingestion/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY ingestion/src ./src
COPY ingestion/fixtures ./fixtures
# The collector runs the same small, dependency-free quality module as ML
# without pulling model training libraries into an hourly Cloud Run Job.
COPY ml/src/vaayu_ml/__init__.py ./src/vaayu_ml/__init__.py
COPY ml/src/vaayu_ml/quality ./src/vaayu_ml/quality
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Jobs are invoked explicitly, so starting the stack cannot write to the
# database as a side effect.
CMD ["python", "-c", "print('ingestion image ready; invoke a connector, e.g. docker compose run --rm ingestion vaayu-openmeteo')"]
