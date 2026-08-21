"""One place where an ingestion run is recorded, whatever its outcome.

Every source entrypoint used to call ``record_run`` only after a successful
write. A run that failed therefore left no ``ingestion_run`` row at all, so the
console could not distinguish "the upstream is down" from "nobody ran it". The
absence of evidence looked the same as the absence of a problem.
"""

from __future__ import annotations

from collections.abc import Callable

from ingestion.db import record_run
from ingestion.source import Source, SourceUnavailableError


def run_source(
    source: Source,
    write: Callable[[list[dict], str], int],
    dry_run: bool = False,
) -> int:
    """Fetch, write, and record the outcome exactly once.

    Args:
        source: the source to fetch from.
        write: writer taking ``(records, mode)`` and returning rows written.
        dry_run: fetch and report without writing or recording.

    Returns:
        Rows written, or records fetched when ``dry_run`` is set.

    Raises:
        SourceUnavailableError: upstream failed. Recorded as
            ``SOURCE_UNAVAILABLE`` before re-raising.
        Exception: anything else. Recorded as ``FAILED`` before re-raising, so
            a crash in our own code is never reported as an upstream outage.
    """
    try:
        records = source.fetch()
    except SourceUnavailableError as exc:
        record_run(source.name, source.mode, "SOURCE_UNAVAILABLE", 0, str(exc))
        raise

    if dry_run:
        return len(records)

    try:
        written = write(records, source.mode)
    except Exception as exc:  # noqa: BLE001 - recorded then re-raised
        record_run(source.name, source.mode, "FAILED", 0, str(exc))
        raise

    record_run(source.name, source.mode, "SUCCESS", written)
    return written
