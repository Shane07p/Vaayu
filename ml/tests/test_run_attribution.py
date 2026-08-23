from __future__ import annotations

import pandas as pd
import pytest

import run_attribution
from vaayu_ml.db import EmptyTrainingSetError


def _clusters() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "fire_cluster_id": [1, 2],
            "code": ["PB-01", "HR-02"],
            "lat": [28.8, 28.7],
            "lon": [77.0, 77.1],
            "total_frp": [100.0, 200.0],
        }
    )


def _cells() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "grid_cell_id": [10],
            "centroid_lat": [28.61],
            "centroid_lon": [77.21],
            "population": [18_000_000],
        }
    )


def _met() -> pd.DataFrame:
    return pd.DataFrame({"grid_cell_id": [10], "wind_u": [3.0], "wind_v": [1.0]})


def _ranked(clusters: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "fire_cluster_id": clusters["fire_cluster_id"].to_numpy(),
            "impact_score": [10.0, 5.0],
            "impact_rank": [1, 2],
            "downwind_population": [18_000_000, 18_000_000],
            "transport_hours": [12.0, 18.0],
            "trajectory_confidence": clusters["trajectory_confidence"].to_numpy(),
            "consecutive_days_unactioned": [3, 1],
            "direction_95_eligible": [True, False],
        }
    )


def _patch_data(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run_attribution, "load_fire_clusters", lambda days: _clusters())
    monkeypatch.setattr(run_attribution, "latest_met_by_cell", _met)
    monkeypatch.setattr(run_attribution, "load_grid_cells", _cells)
    monkeypatch.setattr(
        run_attribution,
        "back_trajectory",
        lambda *args, **kwargs: [(28.61, 77.21), (28.60, 77.20)],
    )


def test_run_loads_database_inputs_ranks_and_writes(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    calls: dict[str, object] = {}

    def _rank(
        clusters: pd.DataFrame,
        trajectories: dict[str, list[tuple[float, float]]],
        population: pd.DataFrame,
        receptor: str,
    ) -> pd.DataFrame:
        calls["clusters"] = clusters
        calls["trajectories"] = trajectories
        calls["population"] = population
        calls["receptor"] = receptor
        return _ranked(clusters)

    writes: list[pd.DataFrame] = []
    monkeypatch.setattr(run_attribution, "rank_fire_clusters", _rank)
    monkeypatch.setattr(
        run_attribution,
        "write_cluster_impacts",
        lambda frame, model_version, source: writes.append(frame.copy()) or len(frame),
    )
    monkeypatch.setattr(run_attribution, "record_model_run", lambda *args, **kwargs: None)

    run_attribution.run(trajectory_hours=2)

    assert calls["receptor"] == "DELHI-NCR"
    assert len(writes) == 1
    written = writes[0]
    assert written["receptor"].eq("DELHI-NCR").all()
    assert written["direction_95_eligible"].tolist() == [True, False]
    assert written["consecutive_days_unactioned"].tolist() == [3, 1]


def test_run_reports_no_fire_clusters_without_writing(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(run_attribution, "load_fire_clusters", lambda days: pd.DataFrame())
    writer_called = False

    def _writer(*args: object, **kwargs: object) -> int:
        nonlocal writer_called
        writer_called = True
        return 0

    monkeypatch.setattr(run_attribution, "write_cluster_impacts", _writer)
    run_attribution.run()

    assert "No fire clusters available for attribution" in capsys.readouterr().out
    assert not writer_called


def test_run_rejects_missing_wind_data(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run_attribution, "load_fire_clusters", lambda days: _clusters())
    monkeypatch.setattr(run_attribution, "latest_met_by_cell", lambda: pd.DataFrame())

    with pytest.raises(EmptyTrainingSetError, match="No meteorological wind data"):
        run_attribution.run()


def test_run_rejects_an_empty_trajectory(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    monkeypatch.setattr(
        run_attribution, "back_trajectory", lambda *args, **kwargs: [(28.61, 77.21)]
    )

    with pytest.raises(EmptyTrainingSetError, match="No usable wind path"):
        run_attribution.run()


def test_run_does_not_write_an_empty_ranked_result(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    monkeypatch.setattr(
        run_attribution, "rank_fire_clusters", lambda *args, **kwargs: pd.DataFrame()
    )
    writer_called = False

    def _writer(*args: object, **kwargs: object) -> int:
        nonlocal writer_called
        writer_called = True
        return 0

    monkeypatch.setattr(run_attribution, "write_cluster_impacts", _writer)
    run_attribution.run()

    assert not writer_called


def test_run_surfaces_cluster_impact_write_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    monkeypatch.setattr(
        run_attribution,
        "rank_fire_clusters",
        lambda clusters, *args, **kwargs: _ranked(clusters),
    )
    monkeypatch.setattr(
        run_attribution,
        "write_cluster_impacts",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("write failed")),
    )

    with pytest.raises(RuntimeError, match="write failed"):
        run_attribution.run()
