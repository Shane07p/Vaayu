"""MLflow tracking configuration.

One place, because getting this wrong is platform-dependent and the failure is
obscure.

Two problems this avoids:

1. MLflow's default filesystem backend is in maintenance mode in 2.18 and
   refuses plain ``./mlruns`` paths outright.
2. Passing an absolute Windows path URL-encodes spaces, so a developer whose
   home directory contains a space gets ``mkdir 'Shane%20Christian'`` and a
   PermissionError. That is not hypothetical; it is where this project runs.

A local SQLite file sidesteps both and still needs no tracking server, which
keeps the "no extra infrastructure" constraint intact.
"""

from __future__ import annotations

import os

import mlflow

# Relative on purpose. An absolute path re-introduces the space-encoding bug.
DEFAULT_TRACKING_URI = "sqlite:///mlflow.db"


def configure(experiment: str) -> str:
    """Point MLflow at the local store and select an experiment.

    Honours ``MLFLOW_TRACKING_URI`` when set, so a real tracking server can be
    used later without touching the models.

    Returns:
        The tracking URI in effect.
    """
    uri = os.environ.get("MLFLOW_TRACKING_URI", DEFAULT_TRACKING_URI)
    mlflow.set_tracking_uri(uri)
    mlflow.set_experiment(experiment)
    return uri
