"""Current-readings connector, and the PARTIAL outcome it needed.

Each test here covers a way this job could report something that is not true:
a station that stopped reporting in 2018 rendered as current air quality, a
national run silently missing stations, or an outage described as a success.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from ingestion.openaq_latest import (
    INGEST_WINDOW,
    OpenAqLatestSource,
    _city_from_name,
)
from ingestion.runner import run_source


def _iso(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


PM25_SENSOR = 1001
CO_SENSOR = 1002


def _location(
    location_id: int,
    name: str,
    age: timedelta,
    locality: str = "Delhi",
    country: str = "IN",
    sensors: list[dict] | None = None,
) -> dict:
    """One entry as /v3/locations returns it.

    The `sensors` block matters: /locations/{id}/latest identifies its values
    only by sensorsId, so this listing is the only place a value can be tied to
    a parameter.
    """
    if sensors is None:
        sensors = [
            {"id": PM25_SENSOR, "parameter": {"id": 2, "name": "pm25", "units": "ug/m3"}},
            {"id": CO_SENSOR, "parameter": {"id": 102, "name": "co", "units": "ppb"}},
        ]
    return {
        "id": location_id,
        "name": name,
        "locality": locality,
        # The real country block, not a placeholder: `locality` is checked
        # against it, and a fake that says "Country" cannot exercise that.
        "country": {"id": 9, "code": country, "name": "India" if country == "IN" else country},
        "sensors": sensors,
        "datetimeLast": {"utc": _iso(datetime.now(UTC) - age)},
        "coordinates": {"latitude": 28.64, "longitude": 77.31},
    }


def _measurement(value: float, age: timedelta, sensor_id: int = PM25_SENSOR) -> dict:
    """One entry as /v3/locations/{id}/latest returns it: no parameter field."""
    return {
        "value": value,
        "sensorsId": sensor_id,
        "locationsId": 1,
        "datetime": {"utc": _iso(datetime.now(UTC) - age)},
    }


class FakeApi:
    """Stands in for the OpenAQ v3 endpoints this source calls."""

    def __init__(self, locations: list[dict], latest: dict[int, object]) -> None:
        self.locations = locations
        self.latest = latest
        self.location_calls: list[int] = []

    def __call__(self, path: str, params: dict | None = None) -> dict:
        if path == "/locations":
            page = (params or {}).get("page", 1)
            # One page of results, then empty, which is how the real listing ends.
            return {"results": self.locations if page == 1 else []}

        location_id = int(path.split("/")[2])
        self.location_calls.append(location_id)
        result = self.latest[location_id]
        if isinstance(result, Exception):
            raise result
        return {"results": result}


def _source(api: FakeApi, **kwargs) -> OpenAqLatestSource:
    source = OpenAqLatestSource("test-key", **kwargs)
    source._get = api  # type: ignore[method-assign]
    return source


class TestStaleStationsAreNotIngested:
    """OpenAQ lists Indian stations whose newest measurement is from 2018."""

    def test_a_station_reporting_years_ago_is_skipped(self):
        api = FakeApi(
            locations=[_location(1, "Live Station", timedelta(minutes=30))],
            latest={1: [_measurement(120.0, timedelta(minutes=30))]},
        )
        api.locations.append(_location(2, "Dead Station", timedelta(days=3000)))
        api.latest[2] = [_measurement(40.3, timedelta(days=3000))]

        records = _source(api).fetch()

        assert [r["station"] for r in records] == ["Live Station"]
        # The dead station is never even read: staleness is decided from the
        # listing, so it costs no request.
        assert api.location_calls == [1]

    def test_a_fresh_station_with_a_lagging_sensor_drops_that_reading(self):
        """A station can list as reporting while one sensor lags far behind."""
        api = FakeApi(
            locations=[_location(1, "Lagging Sensor", timedelta(minutes=10))],
            latest={1: [_measurement(120.0, INGEST_WINDOW + timedelta(hours=2))]},
        )

        assert _source(api).fetch() == []

    def test_a_reading_older_than_display_freshness_is_still_stored(self):
        """The store keeps what the reader may not be told is current.

        OpenAQ's mirror of the government network runs 36-48 hours behind, so a
        collector that only kept readings under six hours old discarded almost
        all of it -- 286 rows on 23 August, 26 on 4 September, SUCCESS both
        times. The reading is real; how old it is gets decided and shown
        downstream, never by dropping it here.
        """
        age = timedelta(hours=40)
        api = FakeApi(
            locations=[_location(1, "Anand Vihar, Delhi - DPCC", age)],
            latest={1: [_measurement(96.0, age)]},
        )

        records = _source(api).fetch()

        assert [r["station"] for r in records] == ["Anand Vihar, Delhi - DPCC"]
        # Stored with the time it was actually measured, not the time it arrived.
        measured_at = datetime.fromisoformat(records[0]["last_update"].replace("Z", "+00:00"))
        assert measured_at < datetime.now(UTC) - timedelta(hours=39)


class TestOnlyProvableMeasurementsAreKept:
    def test_a_reading_from_a_non_pm25_sensor_is_ignored(self):
        """The latest endpoint returns every parameter with no label.

        Reading them all as PM2.5 stored a CO value of 3320 as a PM2.5
        concentration, which is physically impossible and was displayed.
        """
        api = FakeApi(
            locations=[_location(1, "Station", timedelta(minutes=5))],
            latest={1: [_measurement(3320.0, timedelta(minutes=5), sensor_id=CO_SENSOR)]},
        )

        assert _source(api).fetch() == []

    def test_both_sensors_present_keeps_only_the_pm25_one(self):
        api = FakeApi(
            locations=[_location(1, "Station", timedelta(minutes=5))],
            latest={
                1: [
                    _measurement(3320.0, timedelta(minutes=5), sensor_id=CO_SENSOR),
                    _measurement(88.0, timedelta(minutes=5), sensor_id=PM25_SENSOR),
                ]
            },
        )

        records = _source(api).fetch()

        assert [r["pollutant_avg"] for r in records] == [88.0]

    def test_a_station_with_no_pm25_sensor_is_never_read(self):
        api = FakeApi(
            locations=[
                _location(
                    1,
                    "CO Only",
                    timedelta(minutes=5),
                    sensors=[
                        {"id": CO_SENSOR, "parameter": {"id": 102, "name": "co", "units": "ppb"}},
                    ],
                )
            ],
            latest={1: [_measurement(900.0, timedelta(minutes=5), sensor_id=CO_SENSOR)]},
        )
        source = _source(api)

        assert source.fetch() == []
        assert api.location_calls == []

    def test_a_non_numeric_value_is_dropped_rather_than_coerced(self):
        api = FakeApi(
            locations=[_location(1, "Station", timedelta(minutes=5))],
            latest={
                1: [
                    {
                        "value": None,
                        "sensorsId": PM25_SENSOR,
                        "datetime": {"utc": _iso(datetime.now(UTC))},
                    }
                ]
            },
        )

        assert _source(api).fetch() == []

    def test_a_station_outside_india_is_rejected(self):
        """The bbox is a rectangle and contains Lahore, Peshawar and Dhaka."""
        api = FakeApi(
            locations=[
                _location(1, "Forman Christian College", timedelta(minutes=5), country="PK"),
                _location(2, "Dhaka", timedelta(minutes=5), country="BD"),
                _location(3, "Anand Vihar", timedelta(minutes=5), country="IN"),
            ],
            latest={i: [_measurement(90.0, timedelta(minutes=5))] for i in (1, 2, 3)},
        )

        records = _source(api).fetch()

        assert [r["station"] for r in records] == ["Anand Vihar"]

    def test_country_is_not_stored_as_state(self):
        """openaq.py puts the country in station.state, so every Indian station reads "India"."""
        api = FakeApi(
            locations=[_location(1, "Station", timedelta(minutes=5))],
            latest={1: [_measurement(88.0, timedelta(minutes=5))]},
        )

        record = _source(api).fetch()[0]

        assert record["state"] is None
        assert record["city"] == "Delhi"
        assert record["pollutant_id"] == "PM2.5"
        assert record["pollutant_avg"] == 88.0


class TestOneFailedStationDoesNotEndTheRun:
    def _api_with_one_failure(self) -> FakeApi:
        return FakeApi(
            locations=[
                _location(1, "Good", timedelta(minutes=5)),
                _location(2, "Broken", timedelta(minutes=5)),
                _location(3, "Also Good", timedelta(minutes=5)),
            ],
            latest={
                1: [_measurement(101.0, timedelta(minutes=5))],
                2: RuntimeError("500 Internal Server Error"),
                3: [_measurement(102.0, timedelta(minutes=5))],
            },
        )

    def test_readings_from_the_other_stations_survive(self):
        source = _source(self._api_with_one_failure())

        records = source.fetch()

        assert sorted(r["station"] for r in records) == ["Also Good", "Good"]
        assert source.failed_units == 1
        assert source.total_units == 3

    def test_the_run_is_recorded_as_partial_not_success(self, monkeypatch):
        """SUCCESS would describe a map with a hole in it as complete."""
        recorded: list[tuple] = []
        monkeypatch.setattr(
            "ingestion.runner.record_run",
            lambda *args: recorded.append(args),
        )
        source = _source(self._api_with_one_failure())

        run_source(source, lambda records, mode: len(records))

        name, mode, status, rows, error = recorded[0]
        assert (name, status, rows) == ("OPENAQ_LATEST", "PARTIAL", 2)
        # The recorded error names which station failed and why, rather than
        # only counting them, so a recurring bad station is identifiable from
        # ingestion_run alone.
        assert "station 2" in error
        assert "500" in error

    def test_a_run_that_loses_nothing_is_still_success(self, monkeypatch):
        recorded: list[tuple] = []
        monkeypatch.setattr(
            "ingestion.runner.record_run",
            lambda *args: recorded.append(args),
        )
        api = FakeApi(
            locations=[_location(1, "Good", timedelta(minutes=5))],
            latest={1: [_measurement(101.0, timedelta(minutes=5))]},
        )

        run_source(_source(api), lambda records, mode: len(records))

        assert recorded[0][2] == "SUCCESS"


class TestBounds:
    def test_max_stations_caps_the_run(self):
        api = FakeApi(
            locations=[_location(i, f"S{i}", timedelta(minutes=5)) for i in range(1, 11)],
            latest={i: [_measurement(90.0, timedelta(minutes=5))] for i in range(1, 11)},
        )

        source = _source(api, max_stations=3)
        source.fetch()

        assert source.total_units == 3

    def test_max_stations_must_be_positive(self):
        with pytest.raises(ValueError, match="max_stations"):
            OpenAqLatestSource("k", max_stations=0)


class TestRateLimiting:
    def _source_with_stubbed_client(self, responses: list, **kwargs) -> OpenAqLatestSource:
        calls = {"n": 0}

        class StubClient:
            def get(self, path, params=None):
                index = min(calls["n"], len(responses) - 1)
                calls["n"] += 1
                result = responses[index]
                if isinstance(result, Exception):
                    raise result
                return result

            def close(self):
                pass

        source = OpenAqLatestSource("test-key", **kwargs)
        source._client = StubClient()  # type: ignore[assignment]
        source._calls = calls  # type: ignore[attr-defined]
        return source

    def test_429_waits_then_retries_once(self):
        clock = type(
            "Clock",
            (),
            {
                "now": 0.0,
                "sleeps": [],
                "monotonic": lambda self: self.now,
                "sleep": lambda self, seconds: (
                    self.sleeps.append(seconds),
                    setattr(self, "now", self.now + seconds),
                ),
            },
        )()
        request = httpx.Request("GET", "http://x")
        source = self._source_with_stubbed_client(
            [
                httpx.Response(429, headers={"Retry-After": "2"}, request=request),
                httpx.Response(200, json={"results": []}, request=request),
            ],
            clock=clock.monotonic,
            sleeper=clock.sleep,
        )

        assert source._get("/locations") == {"results": []}
        assert source._calls["n"] == 2
        assert clock.sleeps == [2.0]

    def test_normal_client_error_is_not_retried(self):
        request = httpx.Request("GET", "http://x")
        source = self._source_with_stubbed_client([httpx.Response(404, request=request)])

        with pytest.raises(httpx.HTTPStatusError):
            source._get("/locations/1/latest")
        assert source._calls["n"] == 1

    def test_one_client_serves_the_whole_run(self):
        source = OpenAqLatestSource("test-key")
        first = source._http()

        assert source._http() is first


class TestCityComesFromTheStationName:
    """OpenAQ's locality is null for every Indian station."""

    def test_the_common_board_format(self):
        assert _city_from_name("R K Puram, Delhi - DPCC") == "Delhi"
        assert _city_from_name("Zoo Park, Hyderabad - TSPCB") == "Hyderabad"

    def test_a_multi_word_operator(self):
        assert _city_from_name("Plammoodu, Thiruvananthapuram - Kerala PCB") == "Thiruvananthapuram"
        assert _city_from_name("Ratanpura, Rupnagar - Ambuja Cements") == "Rupnagar"

    def test_a_name_without_a_city_yields_none_rather_than_a_guess(self):
        assert _city_from_name("Tata Stadium - Jorapokhar - JSPCB") is None
        assert _city_from_name("SPARTAN - IIT Kanpur") is None
        assert _city_from_name("") is None

    def test_a_supplied_locality_wins_over_the_name(self, monkeypatch):
        api = FakeApi(
            locations=[
                _location(1, "R K Puram, Delhi - DPCC", timedelta(minutes=5), locality="New Delhi")
            ],
            latest={1: [_measurement(60.0, timedelta(minutes=5))]},
        )

        assert _source(api).fetch()[0]["city"] == "New Delhi"

    def test_the_name_is_used_when_locality_is_absent(self):
        api = FakeApi(
            locations=[
                _location(1, "Sanjay Palace, Agra - UPPCB", timedelta(minutes=5), locality=None)
            ],
            latest={1: [_measurement(60.0, timedelta(minutes=5))]},
        )

        assert _source(api).fetch()[0]["city"] == "Agra"

    def test_a_locality_naming_the_country_is_not_a_city(self):
        """A country is not a city, however confidently the source says so.

        Three Indian stations return locality "India". Stored, that put "India"
        in the citizen rankings as a city, aggregating Delhi, Mumbai and Chennai
        into one row that outranked every real city.
        """
        api = FakeApi(
            locations=[_location(1, "New Delhi", timedelta(minutes=5), locality="India")],
            latest={1: [_measurement(60.0, timedelta(minutes=5))]},
        )

        # Unattributed, not misattributed. The name carries no city either, and
        # the ranking counts what it could not place.
        assert _source(api).fetch()[0]["city"] is None

    def test_the_country_code_is_refused_as_a_city_too(self):
        api = FakeApi(
            locations=[
                _location(1, "Sanjay Palace, Agra - UPPCB", timedelta(minutes=5), locality="IN")
            ],
            latest={1: [_measurement(60.0, timedelta(minutes=5))]},
        )

        # Falls back to the name, which does carry one.
        assert _source(api).fetch()[0]["city"] == "Agra"
