"""Forward-chaining blocked cross-validation.

Random splits on a time series leak the future into training. Each fold trains
on everything before a cut point and tests on the block after it.

Implement ``blocked_splits(n_samples, n_splits=5, min_train=None)``.
"""

from __future__ import annotations

from collections.abc import Iterator

import numpy as np


def blocked_splits(
    n_samples: int, n_splits: int = 5, min_train: int | None = None
) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """Yield expanding-window train/test indexes in chronological order."""
    if n_samples < 2:
        raise ValueError("n_samples must be at least 2")
    if n_splits < 1:
        raise ValueError("n_splits must be at least 1")

    initial_train = min_train if min_train is not None else n_samples // (n_splits + 1)
    if initial_train < 1 or initial_train >= n_samples:
        raise ValueError("min_train must be between 1 and n_samples - 1")

    remainder = n_samples - initial_train
    if n_splits > remainder:
        raise ValueError("n_splits cannot exceed the available test observations")

    block_sizes = np.full(n_splits, remainder // n_splits, dtype=int)
    block_sizes[: remainder % n_splits] += 1
    train_end = initial_train
    for block_size in block_sizes:
        test_end = train_end + int(block_size)
        yield np.arange(train_end), np.arange(train_end, test_end)
        train_end = test_end
