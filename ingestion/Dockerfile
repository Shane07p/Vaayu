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

# The venv lives beside pyproject.toml, which is WORKDIR -- not /app.
# WORKDIR moved to /app/ingestion so the build context could be the repo
# root and COPY ml/src/vaayu_ml/quality would resolve, but this line kept
# pointing at the old location. A non-existent directory on PATH is silent:
# the image builds, starts, and every console script is simply missing, so
# the scheduler exits with "executable file not found in $PATH" and every
# documented `docker compose run --rm ingestion vaayu-...` fails the same way.
ENV PATH="/app/ingestion/.venv/bin:$PATH"

# Fail the build rather than the deployment. This is the assertion that the
# line above is right: it runs the real console script through PATH exactly
# as the scheduler and the compose jobs do.
RUN vaayu-scheduler --help > /dev/null

# Jobs are invoked explicitly, so starting the stack cannot write to the
# database as a side effect.
CMD ["python", "-c", "print('ingestion image ready; invoke a connector, e.g. docker compose run --rm ingestion vaayu-openmeteo')"]
