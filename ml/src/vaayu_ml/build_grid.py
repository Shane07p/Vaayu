"""Build the 1 km analysis grid over the pilot area and write it to PostGIS.

Every prediction in this system is per grid cell, so this runs before anything
else in the pipeline. It is idempotent: re-running updates covariates in place
rather than duplicating cells.

Scope is Delhi-NCR plus the immediate surroundings. National coverage is
roadmap, not this sprint.

On covariates
-------------
population, elevation_m, road_density, and built_up_fraction are currently
distance-derived approximations, not measurements. Every cell this module
writes is therefore tagged ``covariate_source = 'APPROXIMATED'``, and the
migration that added that column explains what it means.

This matters more than it looks. These four values are model inputs. If they
were written untagged, a prediction resting on a guessed population would be
indistinguishable from one resting on WorldPop, and the exposure figure in an
alert packet would inherit that uncertainty invisibly. Replacing them with real
WorldPop, SRTM, and OSM joins is the obvious next improvement, and the tag is
what makes the difference visible when it happens.

Usage:
    python -m vaayu_ml.build_grid --dry-run
    python -m vaayu_ml.build_grid
"""

from __future__ import annotations

import argparse
import math

from sqlalchemy import text

from vaayu_ml.db import engine

# Delhi-NCR pilot bounding box: min lon, min lat, max lon, max lat.
NCR_BBOX = (76.80, 28.20, 77.60, 28.90)

CELL_SIZE_KM = 1.0
KM_PER_DEGREE_LAT = 110.574

DELHI_LAT, DELHI_LON = 28.6139, 77.2090

# Approximation constants, kept named so they read as assumptions rather than
# as measurements that happen to be round numbers.
BASE_ELEVATION_M = 215.0
ARAVALLI_RISE_M = 30.0
ARAVALLI_LAT_BELOW = 28.5

CORE_RADIUS_DEG = 0.20
INNER_RADIUS_DEG = 0.40

CORE_ROAD_DENSITY = 8.5
INNER_ROAD_DENSITY = 5.0
OUTER_ROAD_DENSITY = 2.5

CORE_BUILT_UP = 0.85
INNER_BUILT_UP = 0.55
OUTER_BUILT_UP = 0.30

# Rough population per square kilometre by ring. Delhi's density varies by
# more than an order of magnitude across the city; these are placeholders.
CORE_POP_PER_KM2 = 28_000
INNER_POP_PER_KM2 = 11_000
OUTER_POP_PER_KM2 = 2_500


def km_per_degree_lon(latitude: float) -> float:
    """Longitude degrees shrink towards the poles; at 28.6N a degree is ~97 km."""
    return KM_PER_DEGREE_LAT * math.cos(math.radians(latitude))


def _ring(distance_deg: float) -> str:
    if distance_deg < CORE_RADIUS_DEG:
        return "core"
    if distance_deg < INNER_RADIUS_DEG:
        return "inner"
    return "outer"


def _covariates(lat: float, lon: float) -> dict:
    """Distance-derived stand-ins. Not measurements. See the module docstring."""
    distance = math.hypot(lat - DELHI_LAT, lon - DELHI_LON)
    ring = _ring(distance)

    road_density = {
        "core": CORE_ROAD_DENSITY,
        "inner": INNER_ROAD_DENSITY,
        "outer": OUTER_ROAD_DENSITY,
    }[ring]
    built_up = {
        "core": CORE_BUILT_UP,
        "inner": INNER_BUILT_UP,
        "outer": OUTER_BUILT_UP,
    }[ring]
    population = {
        "core": CORE_POP_PER_KM2,
        "inner": INNER_POP_PER_KM2,
        "outer": OUTER_POP_PER_KM2,
    }[ring]

    elevation = BASE_ELEVATION_M + (ARAVALLI_RISE_M if lat < ARAVALLI_LAT_BELOW else 0.0)

    return {
        "population": population,
        "elevation_m": elevation,
        "road_density": road_density,
        "built_up_fraction": built_up,
    }


def generate_cells(bbox: tuple[float, float, float, float] = NCR_BBOX) -> list[dict]:
    """Generate 1 km cells covering the bounding box."""
    min_lon, min_lat, max_lon, max_lat = bbox

    lat_step = CELL_SIZE_KM / KM_PER_DEGREE_LAT
    mid_lat = (min_lat + max_lat) / 2
    lon_step = CELL_SIZE_KM / km_per_degree_lon(mid_lat)

    n_rows = int((max_lat - min_lat) / lat_step)
    n_cols = int((max_lon - min_lon) / lon_step)

    cells = []
    for row in range(n_rows):
        for col in range(n_cols):
            west = min_lon + col * lon_step
            south = min_lat + row * lat_step
            east = west + lon_step
            north = south + lat_step
            centre_lat = south + lat_step / 2
            centre_lon = west + lon_step / 2

            cells.append(
                {
                    "code": f"NCR-{row:03d}-{col:03d}",
                    "west": west,
                    "south": south,
                    "east": east,
                    "north": north,
                    "centroid_lat": centre_lat,
                    "centroid_lon": centre_lon,
                    "district": "Delhi-NCR",
                    "state": "Delhi-NCR",
                    **_covariates(centre_lat, centre_lon),
                }
            )
    return cells


_UPSERT_CELL = text("""
    INSERT INTO grid_cell
        (code, geom, centroid, population, elevation_m, road_density,
         built_up_fraction, district, state, covariate_source)
    VALUES (
        :code,
        ST_MakeEnvelope(:west, :south, :east, :north, 4326),
        ST_SetSRID(ST_MakePoint(:centroid_lon, :centroid_lat), 4326)::geography,
        :population, :elevation_m, :road_density, :built_up_fraction,
        :district, :state, 'APPROXIMATED'
    )
    ON CONFLICT (code) DO UPDATE SET
        geom = EXCLUDED.geom,
        centroid = EXCLUDED.centroid,
        population = EXCLUDED.population,
        elevation_m = EXCLUDED.elevation_m,
        road_density = EXCLUDED.road_density,
        built_up_fraction = EXCLUDED.built_up_fraction,
        covariate_source = EXCLUDED.covariate_source
""")


def write_cells(cells: list[dict]) -> int:
    """Upsert cells by code, so re-running refreshes rather than duplicates."""
    if not cells:
        return 0
    with engine.begin() as connection:
        connection.execute(_UPSERT_CELL, cells)
    return len(cells)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the 1 km analysis grid")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be written without touching the database.",
    )
    args = parser.parse_args()

    cells = generate_cells()
    mid_lat = (NCR_BBOX[1] + NCR_BBOX[3]) / 2
    area = len(cells) * CELL_SIZE_KM**2

    print(f"cells={len(cells)}  approx_area={area:,.0f} km^2")
    print(f"lon degree at {mid_lat:.2f}N = {km_per_degree_lon(mid_lat):.1f} km")
    print("covariate_source=APPROXIMATED (distance-derived, not measurements)")

    if args.dry_run:
        for cell in cells[:3]:
            print(
                f"  {cell['code']}  "
                f"({cell['centroid_lat']:.4f}, {cell['centroid_lon']:.4f})  "
                f"pop={cell['population']}  road={cell['road_density']}"
            )
        return

    written = write_cells(cells)
    print(f"written={written}")


if __name__ == "__main__":
    main()
