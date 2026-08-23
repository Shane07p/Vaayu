FROM ghcr.io/astral-sh/uv:0.12.5 AS uv

FROM python:3.11-slim

COPY --from=uv /uv /uvx /bin/
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY fixtures ./fixtures
RUN uv sync --frozen --no-dev
