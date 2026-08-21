"""Tests for the Earth Engine sources.

These run without credentials and without network. Earth Engine itself cannot
be exercised in CI, so what is tested here is the part that is ours: the
fixture/live gate, the QA bit arithmetic, coverage accounting, and the rule
that a gap never becomes a value.
"""

import json
from pathlib import Path

import pytest

from ingestion.gee.client import coverage_fraction, credentials_present
from ingestion.gee.era5 import KELVIN_OFFSET, Era5Source
from ingestion.gee.maiac_aod import (
    AOD_QA_BEST,
    AOD_QA_SHIFT,
    AOD_QA_WIDTH,
    CLOUD_MASK_CLEAR,
    MaiacAodSource,
)
from ingestion.gee.s5p import Sentinel5PSource

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class TestCredentialGate:
    """Absent credentials behave exactly like an absent API key."""

    def test_sources_fall_back_to_fixture_mode_without_credentials(self, monkeypatch):
        # Forced rather than assumed: a developer with real GEE credentials
        # configured would otherwise see this test fail for the wrong reason.
        monkeypatch.setattr("ingestion.gee.maiac_aod.credentials_present", lambda: False)
        monkeypatch.setattr("ingestion.gee.s5p.credentials_present", lambda: False)
        monkeypatch.setattr("ingestion.gee.era5.credentials_present", lambda: False)

        assert MaiacAodSource().mode == "FIXTURE"
        assert Sentinel5PSource().mode == "FIXTURE"
        assert Era5Source().mode == "FIXTURE"

    def test_credentials_absent_when_key_path_does_not_exist(self, monkeypatch):
        monkeypatch.setattr(
            "ingestion.gee.client.settings.gee_service_account_key", "/no/such/key.json"
        )
        assert not credentials_present()

    def test_fixtures_load_for_every_source(self):
        assert len(MaiacAodSource().fetch()) == 400
        assert len(Sentinel5PSource().fetch()) == 400
        assert len(Era5Source().fetch()) == 400

    @pytest.mark.parametrize("days_back", [0, -1])
    def test_invalid_lookback_is_rejected(self, days_back):
        with pytest.raises(ValueError, match="at least 1"):
            MaiacAodSource(days_back=days_back)

    def test_era5_rejects_unknown_kind(self):
        with pytest.raises(ValueError, match="REANALYSIS or FORECAST"):
            Era5Source(kind="GUESS")


class TestQualityBits:
    """The AOD_QA layout is from the MODIS MAIAC user guide, not the plan.

    The implementation plan described bits 0-1 as the cloud mask and 2-4 as
    retrieval quality. The published spec puts the cloud mask at bits 0-2 and
    AOD quality at bits 8-11. Using the plan's layout would silently admit
    cloudy, low-confidence retrievals into training data.
    """

    def _qa_word(self, cloud: int, quality: int) -> int:
        return (cloud & 0b111) | ((quality & 0b1111) << AOD_QA_SHIFT)

    def test_clear_best_quality_word_decodes_as_passing(self):
        word = self._qa_word(CLOUD_MASK_CLEAR, AOD_QA_BEST)
        cloud = word & 0b111
        quality = (word >> AOD_QA_SHIFT) & ((1 << AOD_QA_WIDTH) - 1)
        assert cloud == CLOUD_MASK_CLEAR
        assert quality == AOD_QA_BEST

    def test_cloudy_pixel_does_not_decode_as_clear(self):
        word = self._qa_word(0b011, AOD_QA_BEST)  # 011 = cloudy
        assert (word & 0b111) != CLOUD_MASK_CLEAR

    def test_low_quality_pixel_does_not_decode_as_best(self):
        word = self._qa_word(CLOUD_MASK_CLEAR, 0b0011)
        quality = (word >> AOD_QA_SHIFT) & ((1 << AOD_QA_WIDTH) - 1)
        assert quality != AOD_QA_BEST


class TestCoverageAccounting:
    def test_full_and_partial_and_absent_coverage(self):
        assert coverage_fraction(100, 100) == 1.0
        assert coverage_fraction(50, 100) == 0.5
        assert coverage_fraction(0, 100) == 0.0

    def test_zero_denominator_is_zero_coverage_not_an_error(self):
        """No pixels at all means the satellite saw nothing, not a crash."""
        assert coverage_fraction(0, 0) == 0.0
        assert coverage_fraction(5, 0) == 0.0

    def test_coverage_is_clamped_to_unit_interval(self):
        assert coverage_fraction(150, 100) == 1.0
        assert coverage_fraction(-5, 100) == 0.0

    def test_non_numeric_counts_degrade_to_zero(self):
        assert coverage_fraction(None, None) == 0.0
        assert coverage_fraction("nope", 10) == 0.0


class TestGapsNeverBecomeValues:
    """The central honesty rule for satellite data."""

    def test_zero_coverage_cells_carry_no_aod_value(self):
        records = json.loads((FIXTURES / "gee_aod_sample.json").read_text())
        unseen = [r for r in records if r["coverage_fraction"] == 0]

        assert unseen, "fixture must contain unseen cells or it tests nothing"
        for record in unseen:
            assert record["aod_047"] is None
            assert record["aod_055"] is None
            assert record["qa_passed"] is False

    def test_unseen_cells_are_retained_rather_than_dropped(self):
        """A gap must reach the database as a gap, not vanish."""
        records = json.loads((FIXTURES / "gee_aod_sample.json").read_text())
        assert len(records) == 400
        assert any(r["coverage_fraction"] == 0 for r in records)

    def test_row_builder_strips_values_when_coverage_is_zero(self):
        row = MaiacAodSource()._to_row(
            {
                "code": "SEED-GRID-0-0",
                "Optical_Depth_047": 0.9,
                "Optical_Depth_055": 0.7,
                "n_Optical_Depth_047": 0,
                "n_total": 120,
            },
            "2026-08-20T00:00:00",
        )
        assert row["coverage_fraction"] == 0.0
        assert row["aod_047"] is None
        assert row["aod_055"] is None
        assert row["qa_passed"] is False

    def test_partial_coverage_is_reported_as_a_fraction_not_a_flag(self):
        """The denominator is the cell's full pixel count, not the observed count.

        Using the observed count as its own denominator made coverage only ever
        1.0 or 0.0, so a cell seen in a tenth of its area reported full coverage.
        """
        row = MaiacAodSource()._to_row(
            {
                "code": "SEED-GRID-0-0",
                "Optical_Depth_047": 0.8,
                "n_Optical_Depth_047": 12,
                "n_total": 120,
            },
            "2026-08-20T00:00:00",
        )
        assert row["coverage_fraction"] == pytest.approx(0.1)
        assert row["aod_047"] == 0.8


class TestSentinel5PNoiseIsPreserved:
    def test_negative_no2_survives_the_row_builder(self):
        """Negative columns are the instrument's noise floor over clean air.

        Clipping them to zero biases the feature upward exactly where the air
        is cleanest, so no clamping may be introduced here.
        """
        row = Sentinel5PSource()._to_row(
            {
                "code": "SEED-GRID-0-0",
                "no2_column": -1.1e-05,
                "n_no2_column": 12,
                "n_total": 12,
                "aer_ai": -0.3,
            },
            "2026-08-20T00:00:00",
        )
        assert row["no2_column"] == -1.1e-05
        assert row["aer_ai"] == -0.3

    def test_partial_coverage_uses_the_cell_pixel_count(self):
        row = Sentinel5PSource()._to_row(
            {"code": "SEED-GRID-0-0", "n_no2_column": 3, "n_total": 12},
            "2026-08-20T00:00:00",
        )
        assert row["coverage_fraction"] == pytest.approx(0.25)

    def test_fixture_retains_negative_columns(self):
        records = json.loads((FIXTURES / "gee_s5p_sample.json").read_text())
        assert any(r["no2_column"] < 0 for r in records)


class TestMeteorology:
    def test_era5_kelvin_is_converted_to_celsius(self):
        row = Era5Source(kind="REANALYSIS")._to_row(
            {"code": "SEED-GRID-0-0", "temp_2m": 300.15}, "2026-08-20T00:00:00"
        )
        assert row["temp_2m"] == pytest.approx(300.15 - KELVIN_OFFSET)

    def test_gfs_celsius_is_left_alone(self):
        """GFS reports celsius already.

        Applying the kelvin offset to forecast rows wrote about -253 C, and no
        CHECK constraint on met_snapshot would have caught it.
        """
        row = Era5Source(kind="FORECAST")._to_row(
            {"code": "SEED-GRID-0-0", "temp_2m": 27.0}, "2026-08-20T00:00:00"
        )
        assert row["temp_2m"] == pytest.approx(27.0)
        assert row["temp_2m"] > -50

    def test_missing_temperature_stays_none(self):
        row = Era5Source()._to_row({"code": "SEED-GRID-0-0"}, "2026-08-20T00:00:00")
        assert row["temp_2m"] is None

    def test_forecast_and_reanalysis_are_tagged_distinctly(self):
        """Conflating them would leak future weather into nowcast training."""
        assert Era5Source(kind="REANALYSIS").kind == "REANALYSIS"
        assert Era5Source(kind="FORECAST").kind == "FORECAST"

    def test_boundary_layer_height_is_present_in_the_fixture(self):
        """BLH is what makes column AOD translate to surface PM2.5. Not optional."""
        records = json.loads((FIXTURES / "met_sample.json").read_text())
        assert all(r["boundary_layer_height"] is not None for r in records)
        assert all(r["boundary_layer_height"] >= 0 for r in records)
