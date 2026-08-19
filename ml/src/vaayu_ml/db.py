"""PostGIS writers for model output.

Predictions are written here on a schedule; the Spring Boot service reads them.
Python is never in the HTTP request path.

Column names must match the Flyway migrations in
``backend/src/main/resources/db/migration`` exactly.

Note two constraints the schema enforces, so writes must supply them:

* ``grid_prediction`` requires all three quantiles and ``coverage_fraction``,
  with a CHECK on quantile ordering. There is no way to write a point estimate.
* ``forecast`` requires ``baseline_persistence``. There is no way to record a
  forecast without the number it must be compared against.
"""

from __future__ import annotations
