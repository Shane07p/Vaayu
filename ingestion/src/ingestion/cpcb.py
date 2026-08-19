"""CPCB real-time AQI via the sanctioned data.gov.in resource.

The ``app.cpcbccr.com`` station API used by many projects is reverse-engineered
and unofficial. This module deliberately uses the data.gov.in route instead,
which is slightly less convenient and officially sanctioned.

Response gotcha: fields are ``pollutant_min`` / ``pollutant_max`` /
``pollutant_avg`` per pollutant, not a single value per station. Timestamps are
``DD-MM-YYYY HH:MM:SS`` in IST and are occasionally stale.

Implement: ``CpcbSource(Source)`` with ``_fetch_live``, and a ``main()``
supporting ``--dry-run``.
"""

from __future__ import annotations

RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
