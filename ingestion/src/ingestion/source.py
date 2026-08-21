"""Base class for every ingestion source.

One code path serves both modes. With the source's API key absent, committed
fixtures are read and the run is recorded as ``FIXTURE``. With the key present
the live endpoint is called and the run is recorded as ``LIVE``.

A live call that fails raises :class:`SourceUnavailableError`. It never falls back to
fixtures: presenting cached values as fresh telemetry would be fabricating
evidence, which is the failure mode this project most wants to avoid.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures"


class SourceUnavailableError(RuntimeError):
    """Raised when a live upstream call fails.

    Never caught and downgraded into fixture data. Callers should record an
    ``ingestion_run`` row with status ``SOURCE_UNAVAILABLE`` and surface that
    distinctly from a crash.
    """


class Source(ABC):
    """A single upstream data source.

    Subclasses set :attr:`name` and :attr:`fixture_file` and implement
    :meth:`_fetch_live`.
    """

    name: str
    fixture_file: str

    def __init__(self, api_key: str | None) -> None:
        # Treat blank strings as absent: an empty .env entry means fixture mode.
        self._api_key = api_key or None

    @property
    def mode(self) -> str:
        """``"LIVE"`` when a key is present, otherwise ``"FIXTURE"``."""
        return "LIVE" if self._api_key else "FIXTURE"

    def fetch(self) -> list[dict]:
        """Return records from whichever mode this source is in."""
        if self.mode == "FIXTURE":
            return self._fetch_fixture()

        try:
            return self._fetch_live()
        except Exception as exc:  # noqa: BLE001 - re-raised as a typed error
            raise SourceUnavailableError(
                f"{self.name}: upstream call failed ({exc}). Not falling back to fixtures."
            ) from exc

    def _fetch_fixture(self) -> list[dict]:
        path = FIXTURE_DIR / self.fixture_file
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)

    @abstractmethod
    def _fetch_live(self) -> list[dict]:
        """Call the real upstream endpoint. Implemented per source."""
