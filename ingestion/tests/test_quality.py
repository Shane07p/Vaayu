from datetime import timedelta

from ingestion import quality


class _Rows:
    def __init__(self, values):
        self.values = values

    def mappings(self):
        return self.values

    def __iter__(self):
        return iter(self.values)


class _Result:
    def __init__(self, rowcount=0):
        self.rowcount = rowcount


class _Connection:
    def __init__(self):
        self.inserts = []

    def execute(self, statement, params):
        sql = str(statement)
        if "SELECT r.id" in sql:
            return _Rows(
                [
                    {
                        "id": 11,
                        "station_id": 5,
                        "ts": __import__("datetime").datetime.now(__import__("datetime").UTC),
                        "pm25": 3320.0,
                        "geom": "point",
                    }
                ]
            )
        if "SELECT other.pm25" in sql:
            return [(20.0,), (25.0,), (30.0,)]
        if "SELECT pm25" in sql:
            return [(3320.0,)]
        self.inserts.append(params)
        return _Result(1)


class _Transaction:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, *args):
        return None


def test_scan_persists_every_explainable_reason(monkeypatch):
    connection = _Connection()
    monkeypatch.setattr(quality.engine, "begin", lambda: _Transaction(connection))

    assert quality.scan_recent_openaq_readings(timedelta(minutes=1)) == 2
    assert {row["reason"] for row in connection.inserts} == {
        "IMPOSSIBLE_CONCENTRATION",
        "NEIGHBOUR_OUTLIER",
    }
