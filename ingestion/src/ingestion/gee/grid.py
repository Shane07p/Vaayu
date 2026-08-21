"""The analysis grid, as Earth Engine sees it.

Earth Engine reductions need the grid as a FeatureCollection, but the grid
itself lives in PostGIS. This module is the one place that conversion happens,
so AOD, S5P, and meteorology all reduce over identical geometry and their rows
join cleanly on ``grid_cell_id``.
"""

from __future__ import annotations

from sqlalchemy import text

from ingestion.db import engine
from ingestion.gee.client import EarthEngineUnavailableError

# Delhi-NCR plus the Punjab and Haryana source corridor. Matches the pilot
# scope; national coverage is roadmap, not this sprint.
DEFAULT_BBOX = (73.8, 28.2, 77.6, 32.5)


def grid_cells(limit: int | None = None) -> list[dict]:
    """Read grid cells from PostGIS as GeoJSON geometry plus their code."""
    query = """
        SELECT code, ST_AsGeoJSON(geom) AS geometry
        FROM grid_cell
        ORDER BY id
    """
    if limit is not None:
        query += f" LIMIT {int(limit)}"

    with engine.begin() as connection:
        rows = connection.execute(text(query)).mappings().all()

    return [{"code": row["code"], "geometry": row["geometry"]} for row in rows]


def grid_feature_collection(limit: int | None = None):  # noqa: ANN201 - ee.FeatureCollection
    """Build an Earth Engine FeatureCollection from the PostGIS grid.

    Raises:
        EarthEngineUnavailableError: the grid is empty, so a reduction would
            silently return no rows and look like a coverage failure rather
            than a missing prerequisite.
    """
    try:
        import ee
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise EarthEngineUnavailableError("earthengine-api is not installed") from exc

    import json

    cells = grid_cells(limit)
    if not cells:
        raise EarthEngineUnavailableError(
            "grid_cell is empty; run the grid build before reducing satellite data"
        )

    features = [
        ee.Feature(
            ee.Geometry(json.loads(cell["geometry"])),
            {"code": cell["code"]},
        )
        for cell in cells
    ]
    return ee.FeatureCollection(features)
