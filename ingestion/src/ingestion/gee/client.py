"""Earth Engine authentication and grid-reduction helpers.

Every Earth Engine module shares one initialisation path and one reduction
helper, so authentication behaviour and coverage accounting cannot drift apart
between AOD, S5P, and meteorology.

Earth Engine has no Java client. That is the reason ingestion is a separate
Python service rather than part of the Spring Boot application.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ingestion.settings import settings

# Earth Engine reports masked pixels as absent rather than as a sentinel value.
# reduceRegions with a count reducer alongside the mean is what lets us tell
# "clean air" apart from "could not see", which the schema then requires.
COVERAGE_REDUCER_KEYS = ("mean", "count")


class EarthEngineUnavailableError(RuntimeError):
    """Raised when Earth Engine cannot be initialised or a request fails.

    Callers convert this into ``SourceUnavailableError`` so it records as
    ``SOURCE_UNAVAILABLE`` rather than a crash. It is never downgraded into
    fixture data.
    """


def credentials_present() -> bool:
    """Whether a usable service-account key is configured.

    Absent credentials put the Earth Engine sources into fixture mode, exactly
    as a missing API key does for the HTTP sources.
    """
    key = settings.gee_service_account_key
    if not key:
        return False
    return Path(key).is_file()


def initialise() -> None:
    """Initialise Earth Engine from the configured service-account key.

    Raises:
        EarthEngineUnavailableError: credentials are missing or rejected.
    """
    if not credentials_present():
        raise EarthEngineUnavailableError(
            "GEE_SERVICE_ACCOUNT_KEY is unset or does not point at a readable file"
        )

    key_path = Path(settings.gee_service_account_key or "")

    try:
        import ee
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise EarthEngineUnavailableError("earthengine-api is not installed") from exc

    try:
        payload = json.loads(key_path.read_text(encoding="utf-8"))
        service_account = payload["client_email"]
        credentials = ee.ServiceAccountCredentials(service_account, str(key_path))
        ee.Initialize(credentials)
    except Exception as exc:  # noqa: BLE001 - re-raised as a typed error
        raise EarthEngineUnavailableError(f"Earth Engine initialisation failed: {exc}") from exc


def coverage_fraction(count: Any, expected: Any) -> float:
    """Fraction of a cell that returned a valid retrieval, clamped to [0, 1].

    ``expected`` of zero means the reduction returned nothing at all, which is
    zero coverage rather than an error. The schema constraint
    ``chk_aod_no_value_without_coverage`` then prevents a value being recorded
    alongside it.
    """
    try:
        observed = float(count or 0)
        total = float(expected or 0)
    except (TypeError, ValueError):
        return 0.0

    if total <= 0:
        return 0.0
    return max(0.0, min(1.0, observed / total))


def snapshot_timestamp() -> str:
    """The hour a snapshot belongs to, as an ISO-8601 UTC string.

    Truncated to the hour on purpose. Each Earth Engine job runs independently
    and previously stamped ``datetime.now(UTC).isoformat()`` at its own runtime,
    so AOD, meteorology and S5P landed on timestamps differing by microseconds.
    The model joins those three tables on exact ``ts`` equality, so under live
    credentials no row ever carried satellite and meteorological features
    together: the nowcast trained on meteorology alone while still reporting a
    plausible RMSE.

    The bug was invisible in fixture mode because the fixture generator happened
    to truncate to the hour, so it would have appeared for the first time on the
    day real credentials were installed.

    An hour is also the natural granularity: station readings are hourly, ERA5
    is hourly, and MODIS is daily.
    """
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0).isoformat()
