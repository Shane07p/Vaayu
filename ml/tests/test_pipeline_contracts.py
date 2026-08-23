"""Contracts the model pipeline depends on but cannot see for itself.

Each test here covers a defect that produced plausible-looking numbers while
being wrong. That is the failure mode this project cares about most: a model
that reports an RMSE while training on nothing, or an alert that states a
confidence nobody measured.
"""

import math

import numpy as np
import pandas as pd
import pytest

from vaayu_ml.attribution.rank import (
    ASSUMED_TRANSPORT_KMH,
    DEFAULT_SCORING_CONFIDENCE,
    TRAJECTORY_CORRIDOR_KM,
    rank_fire_clusters,
)
from vaayu_ml.build_grid import NCR_BBOX, generate_cells
from vaayu_ml.features.upwind_fire import _fire_power
from vaayu_ml.features.wind import wind_direction_from, wind_speed


class TestGridCoversItsBoundingBox:
    """Truncating the cell count left the north and east edges uncovered."""

    def test_cells_reach_the_northern_and_eastern_edges(self):
        min_lon, min_lat, max_lon, max_lat = NCR_BBOX
        cells = generate_cells()

        northmost = max(c["north"] for c in cells)
        eastmost = max(c["east"] for c in cells)

        assert northmost >= max_lat, f"grid stops at {northmost}, box ends at {max_lat}"
        assert eastmost >= max_lon, f"grid stops at {eastmost}, box ends at {max_lon}"

    def test_grid_starts_at_the_box_origin(self):
        min_lon, min_lat, _, _ = NCR_BBOX
        cells = generate_cells()

        assert min(c["south"] for c in cells) == pytest.approx(min_lat)
        assert min(c["west"] for c in cells) == pytest.approx(min_lon)

    def test_longitude_is_scaled_by_latitude(self):
        """A degree of longitude is ~97 km at 28.6N, not 111."""
        cells = generate_cells()
        widths = {round(c["east"] - c["west"], 6) for c in cells}

        assert len(widths) == 1
        assert widths.pop() > 0.0095  # wider than a naive 1/111 degree


class TestWindDirectionConvention:
    """Two implementations disagreed by exactly 180 degrees.

    They now share one function, so the convention cannot silently depend on
    which module ran last.
    """

    def test_northerly_wind_reports_as_coming_from_the_north(self):
        # Blowing toward the south means v is negative; meteorologically that
        # is a northerly, coming FROM 0 degrees.
        assert wind_direction_from(0.0, -5.0) == pytest.approx(0.0, abs=1e-6)

    def test_westerly_wind_reports_as_coming_from_the_west(self):
        # Blowing toward the east means u positive; it comes FROM 270 degrees.
        assert wind_direction_from(5.0, 0.0) == pytest.approx(270.0, abs=1e-6)

    def test_southerly_and_easterly(self):
        assert wind_direction_from(0.0, 5.0) == pytest.approx(180.0, abs=1e-6)
        assert wind_direction_from(-5.0, 0.0) == pytest.approx(90.0, abs=1e-6)

    def test_direction_stays_in_range(self):
        for u in (-7.0, -1.0, 0.0, 1.0, 7.0):
            for v in (-7.0, -1.0, 0.0, 1.0, 7.0):
                assert 0.0 <= float(wind_direction_from(u, v)) < 360.0

    def test_is_the_opposite_of_the_toward_direction(self):
        """The old align.py formula; 180 degrees from the correct one."""
        u, v = 3.0, -4.0
        toward = (math.degrees(math.atan2(u, v)) + 360.0) % 360.0
        coming_from = float(wind_direction_from(u, v))

        assert abs((coming_from - toward) % 360.0 - 180.0) < 1e-6

    def test_speed_is_the_vector_magnitude(self):
        assert wind_speed(3.0, 4.0) == pytest.approx(5.0)


class TestFirePowerColumnName:
    """load_fire_clusters yields total_frp; raw FIRMS rows carry frp."""

    def test_accepts_cluster_column(self):
        fires = pd.DataFrame({"total_frp": [12.5, 8.0]})
        assert list(_fire_power(fires)) == [12.5, 8.0]

    def test_accepts_detection_column(self):
        fires = pd.DataFrame({"frp": [3.0]})
        assert list(_fire_power(fires)) == [3.0]

    def test_missing_both_is_an_error_not_a_zero(self):
        with pytest.raises(KeyError, match="total_frp"):
            _fire_power(pd.DataFrame({"brightness": [300.0]}))


class TestAttributionReportsUnknownsAsUnknown:
    """The ranking previously invented two figures and discarded a third."""

    def _clusters(self) -> pd.DataFrame:
        return pd.DataFrame(
            {
                "fire_cluster_id": [1, 2],
                "code": ["PB-A", "PB-B"],
                "lat": [31.63, 24.00],
                "lon": [74.87, 70.00],
                "total_frp": [800.0, 800.0],
            }
        )

    def test_confidence_is_null_when_no_trajectory_measured_it(self):
        # A literal 0.81 used to be written here as though it had been measured.
        ranked = rank_fire_clusters(
            self._clusters(), trajectories={}, population_grid=None, receptor="DELHI-NCR"
        )

        assert ranked["trajectory_confidence"].isna().all()

    def test_downwind_population_is_null_rather_than_the_whole_grid_total(self):
        # The same grid-wide total was stored for every cluster, which reads as
        # a per-cluster exposure figure and also cancels out of the ranking.
        ranked = rank_fire_clusters(
            self._clusters(), trajectories={}, population_grid=None, receptor="DELHI-NCR"
        )

        assert ranked["downwind_population"].isna().all()

    def test_off_corridor_cluster_does_not_inherit_a_favourable_transport_time(self):
        """A cluster far off the path took t_hours from the nearest waypoint's
        index regardless of distance, collecting the same decay as one sitting
        on the trajectory."""
        trajectory = {"DELHI-NCR": [(28.61, 77.21), (30.0, 76.0), (31.63, 74.87)]}

        ranked = rank_fire_clusters(
            self._clusters(), trajectories=trajectory, population_grid=None, receptor="DELHI-NCR"
        )
        on_path = ranked[ranked["code"] == "PB-A"].iloc[0]
        off_path = ranked[ranked["code"] == "PB-B"].iloc[0]

        assert on_path["trajectory_intersection"] == 1.0
        assert off_path["trajectory_intersection"] == 0.0
        # Equal FRP, so the on-corridor cluster must rank first.
        assert on_path["impact_rank"] < off_path["impact_rank"]
        assert off_path["transport_hours"] > on_path["transport_hours"]

    def test_off_corridor_transport_time_uses_straight_line_distance(self):
        trajectory = {"DELHI-NCR": [(28.61, 77.21)]}
        ranked = rank_fire_clusters(
            self._clusters(), trajectories=trajectory, population_grid=None, receptor="DELHI-NCR"
        )
        off_path = ranked[ranked["code"] == "PB-B"].iloc[0]

        # Far outside the corridor, so transport time should reflect the real
        # distance rather than a waypoint index.
        assert off_path["transport_hours"] > TRAJECTORY_CORRIDOR_KM / ASSUMED_TRANSPORT_KMH

    def test_ranking_still_orders_clusters_when_confidence_is_unknown(self):
        """Unknown confidence must not make clusters incomparable."""
        clusters = self._clusters()
        clusters.loc[0, "total_frp"] = 2000.0

        ranked = rank_fire_clusters(
            clusters, trajectories={}, population_grid=None, receptor="DELHI-NCR"
        )

        assert ranked["impact_rank"].tolist() == [1, 2]
        assert 0.0 < DEFAULT_SCORING_CONFIDENCE <= 1.0
        assert np.isfinite(ranked["impact_score"]).all()
