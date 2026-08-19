"""Leave-one-station-out cross-validation.

Random splits let a model memorise a station's mean and leak spatial
autocorrelation, which inflates reported accuracy. Under LOSO the model must
predict a location it has never seen.

LOSO scores are always lower than random-split scores. Both are reported. A
submission claiming R-squared above 0.9 at hourly 1 km without LOSO should be
treated as unvalidated, including ours.

Implement ``loso_splits(station_ids) -> Iterator[tuple[ndarray, ndarray]]``.
"""

from __future__ import annotations

from collections.abc import Iterator

import numpy as np


def loso_splits(
    station_ids: np.ndarray | list[object],
) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """Yield train/test row indexes for each unique held-out station.

    Stable first-seen ordering keeps reports reproducible even when station
    identifiers are strings or mixed scalar types.
    """
    ids = np.asarray(station_ids)
    if ids.ndim != 1:
        raise ValueError("station_ids must be one-dimensional")
    if not len(ids):
        raise ValueError("station_ids must not be empty")

    unique_ids = list(dict.fromkeys(ids.tolist()))
    for held_out in unique_ids:
        test = np.flatnonzero(ids == held_out)
        train = np.flatnonzero(ids != held_out)
        yield train, test
