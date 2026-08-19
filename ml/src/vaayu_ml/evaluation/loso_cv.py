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
