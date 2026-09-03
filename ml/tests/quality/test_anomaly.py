from vaayu_ml.quality import detect_anomalies


def test_flags_the_known_unit_scale_failure():
    flags = detect_anomalies(3320.0, [20.0, 24.0, 29.0], [3320.0])

    assert {flag.reason for flag in flags} == {
        "IMPOSSIBLE_CONCENTRATION",
        "NEIGHBOUR_OUTLIER",
    }


def test_does_not_call_normal_local_disagreement_a_fault():
    flags = detect_anomalies(80.0, [25.0, 31.0, 46.0, 57.0], [70.0, 80.0])

    assert flags == []


def test_flags_six_identical_observations_as_a_stuck_sensor():
    flags = detect_anomalies(42.0, [], [42.0] * 6)

    assert [flag.reason for flag in flags] == ["STUCK_SENSOR"]


def test_requires_multiple_neighbours_before_holding_out_a_reading():
    flags = detect_anomalies(400.0, [20.0, 25.0], [400.0])

    assert flags == []
