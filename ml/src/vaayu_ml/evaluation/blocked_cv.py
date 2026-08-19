"""Forward-chaining blocked cross-validation.

Random splits on a time series leak the future into training. Each fold trains
on everything before a cut point and tests on the block after it.

Implement ``blocked_splits(n_samples, n_splits=5, min_train=None)``.
"""

from __future__ import annotations
