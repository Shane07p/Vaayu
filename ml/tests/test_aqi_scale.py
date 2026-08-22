"""Tests for the PM2.5 to CPCB AQI conversion.

This conversion decides which GRAP stage an alert recommends, and GRAP stages
stop construction, ban trucks, and close schools. A wrong number here is not a
wrong chart, it is a wrong instruction to a district magistrate.

Mirrored by AqiScaleTest.java in the backend, because the conversion is
duplicated across both languages.
"""

import pytest

from vaayu_ml.models.forecast_lgbm import ForecastModel

SEVERE_PLUS = 500


@pytest.fixture(scope="module")
def to_aqi():
    return ForecastModel().pm25_to_aqi


class TestPublishedBandEndpoints:
    @pytest.mark.parametrize(
        ("pm25", "expected"),
        [(0, 0), (15, 25), (30, 50), (60, 100), (90, 200), (120, 300), (250, 400)],
    )
    def test_band_endpoints_match_the_cpcb_scale(self, to_aqi, pm25, expected):
        assert to_aqi(pm25) == expected

    def test_extreme_concentrations_saturate(self, to_aqi):
        assert to_aqi(250_000) == SEVERE_PLUS


class TestGapsBetweenPublishedBands:
    """The regression this file exists for.

    The published CPCB table is integer-banded: 0-30, 31-60, 61-90, 91-120,
    121-250, 251+. PM2.5 is a continuous measurement, so 30.5 belonged to no
    band, matched nothing, and fell through to the severe fallback. A reading of
    30.5 micrograms is clean air, and reporting it as AQI 500 maps to GRAP
    Stage IV.
    """

    @pytest.mark.parametrize("pm25", [30.5, 60.5, 90.5, 120.5, 250.5])
    def test_values_between_bands_do_not_report_severe(self, to_aqi, pm25):
        assert to_aqi(pm25) != SEVERE_PLUS

    def test_clean_air_does_not_report_as_severe(self, to_aqi):
        assert to_aqi(30.5) < 110

    def test_gap_values_land_in_the_band_above(self, to_aqi):
        assert 50 <= to_aqi(30.5) <= 100
        assert 100 <= to_aqi(60.5) <= 200
        assert 200 <= to_aqi(90.5) <= 300


class TestScaleProperties:
    def test_conversion_is_monotonic(self, to_aqi):
        """A higher concentration must never yield a lower index.

        Prediction interval bounds are converted independently, so a
        non-monotonic scale could invert an interval.
        """
        previous = -1
        pm25 = 0.0
        while pm25 <= 600:
            aqi = to_aqi(pm25)
            assert aqi >= previous, f"AQI fell from {previous} to {aqi} at {pm25}"
            previous = aqi
            pm25 += 0.5

    def test_negative_concentrations_clamp_to_zero(self, to_aqi):
        """An interval's lower bound can go below zero; a concentration cannot."""
        assert to_aqi(-12.5) == 0

    def test_output_stays_within_the_scale(self, to_aqi):
        for pm25 in (0, 0.1, 45, 30.5, 300, 9_999):
            assert 0 <= to_aqi(pm25) <= SEVERE_PLUS

    def test_matches_the_java_implementation_at_shared_points(self, to_aqi):
        """Values asserted identically in AqiScaleTest.java."""
        assert to_aqi(0) == 0
        assert to_aqi(15) == 25
        assert to_aqi(30) == 50
        assert to_aqi(60) == 100
        assert to_aqi(90) == 200
        assert to_aqi(120) == 300
        assert to_aqi(250) == 400
