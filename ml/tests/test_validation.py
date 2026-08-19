import numpy as np
import pytest

from vaayu_ml.attribution.cluster import cluster_fire_detections
from vaayu_ml.attribution.rank import impact_score
from vaayu_ml.baselines import climatology_baseline, persistence_baseline
from vaayu_ml.evaluation.blocked_cv import blocked_splits
from vaayu_ml.evaluation.calibration import interval_coverage
from vaayu_ml.evaluation.exceedance import exceedance_metrics
from vaayu_ml.evaluation.loso_cv import loso_splits
from vaayu_ml.trajectory import back_trajectory


def test_persistence_leaves_unavailable_history_empty():
    result = persistence_baseline([10, 20, 30], horizon=2)
    assert np.isnan(result[:2]).all()
    assert result[2] == 10


def test_climatology_does_not_leak_future_values():
    result = climatology_baseline([10, 20, 30, 40], period=2)
    assert np.isnan(result[:2]).all()
    assert result.tolist()[2:] == [10, 20]


def test_loso_holds_every_station_out_once():
    splits = list(loso_splits(["a", "a", "b"]))
    assert len(splits) == 2
    assert splits[0][1].tolist() == [0, 1]
    assert splits[1][1].tolist() == [2]


def test_blocked_cv_never_trains_on_future_rows():
    for train, test in blocked_splits(12, n_splits=3, min_train=3):
        assert train.max() < test.min()


def test_exceedance_handles_a_clean_period_without_nan():
    metrics = exceedance_metrics([10, 20], [30, 40])
    assert metrics["precision"] == metrics["recall"] == metrics["f1"] == 0.0


def test_interval_coverage_counts_inclusive_bounds():
    assert interval_coverage([1, 2], [1, 0], [1, 2])["coverage"] == 1.0


def test_fire_clusters_use_real_geodesic_distance():
    labels = cluster_fire_detections(
        [(28.61, 77.21), (28.62, 77.21), (29.5, 77.21)], eps_km=5
    )
    assert labels[0] == labels[1]
    assert labels[2] == -1


def test_impact_score_rewards_population_and_confidence():
    assert impact_score(500, 10_000_000, 12, 0.9) > impact_score(500, 10_000, 12, 0.2)


def test_back_trajectory_moves_against_the_wind_and_stops_on_missing_data():
    path = back_trajectory(28.6, 77.2, lambda *_: (10, 0), hours=2)
    assert len(path) == 3
    assert path[-1][1] < 77.2
    assert len(back_trajectory(28.6, 77.2, lambda *_: None, hours=2)) == 1


def test_invalid_validation_arguments_fail_loudly():
    with pytest.raises(ValueError):
        list(blocked_splits(4, n_splits=4))
    with pytest.raises(ValueError):
        interval_coverage([1], [2], [1])
