"""Smoke tests for the ml dependency stack.

These look trivial but are not. This package's dependency graph has already
broken once: shap pulls numba transitively, and without an explicit floor the
resolver selected llvmlite 0.36, which refuses to build on anything above
Python 3.9. A plain import test catches that entire class of failure before it
reaches anyone's machine.

Model behaviour is tested alongside each model as it lands.
"""

import sys


def test_runs_on_python_311():
    """uv fetches the interpreter, so this is independent of the host Python."""
    assert sys.version_info[:2] == (3, 11)


def test_gradient_boosting_libraries_import():
    import lightgbm
    import xgboost

    assert xgboost.__version__
    assert lightgbm.__version__


def test_numba_is_recent_enough_for_numpy_2():
    """Guards the llvmlite 0.36 regression. numba 0.61 is the first release
    supporting numpy 2.1; anything older silently breaks the build on 3.11."""
    import numba

    major, minor = (int(part) for part in numba.__version__.split(".")[:2])
    assert (major, minor) >= (0, 61), f"numba {numba.__version__} predates numpy 2.1 support"


def test_explainability_and_tracking_import():
    import mlflow
    import shap

    assert shap.__version__
    assert mlflow.__version__


def test_geospatial_and_db_stack_imports():
    """Writing to PostGIS is the contract with the Java service."""
    import geoalchemy2
    import geopandas
    import sqlalchemy

    assert geopandas.__version__
    assert sqlalchemy.__version__
    assert geoalchemy2.__version__


def test_package_is_importable():
    import vaayu_ml

    assert vaayu_ml.__version__ == "0.1.0"
