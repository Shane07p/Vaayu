package org.vaayu.web.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * A submitted position is stored coarsely.
 *
 * The class comment on CitizenReportService has always said "stores only coarse
 * location", but nothing rounded: whatever the client sent went into the geometry
 * verbatim, and browser geolocation resolves to a few metres. A report pairs a
 * position with a photograph and a timestamp, and these reports often concern a
 * neighbour's burning, so an exact fix records who was standing where.
 *
 * These tests pin the guarantee so it cannot quietly become a comment again.
 */
class CitizenReportCoarseningTest {

    @Test
    @DisplayName("a metre-accurate fix is reduced to about a kilometre")
    void roundsToTwoDecimalPlaces() {
        // A plausible GPS reading outside a specific building in Delhi.
        assertThat(CitizenReportService.coarsen(28.646912)).isEqualTo(28.65);
        assertThat(CitizenReportService.coarsen(77.315274)).isEqualTo(77.32);
    }

    @Test
    @DisplayName("southern and western hemispheres round the same way")
    void handlesNegativeCoordinates() {
        assertThat(CitizenReportService.coarsen(-33.868821)).isEqualTo(-33.87);
        assertThat(CitizenReportService.coarsen(-70.123456)).isEqualTo(-70.12);
    }

    @Test
    @DisplayName("an already-coarse position is left alone")
    void isIdempotent() {
        double once = CitizenReportService.coarsen(28.646912);
        assertThat(CitizenReportService.coarsen(once)).isEqualTo(once);
    }

    @Test
    @DisplayName("the equator and prime meridian are not special-cased away")
    void handlesZero() {
        assertThat(CitizenReportService.coarsen(0.0)).isEqualTo(0.0);
        assertThat(CitizenReportService.coarsen(0.004)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("two positions in the same neighbourhood become indistinguishable")
    void neighbouringPositionsCollapse() {
        // Roughly 200 m apart: distinct fixes, the same stored point.
        double first = CitizenReportService.coarsen(28.6461);
        double second = CitizenReportService.coarsen(28.6479);

        assertThat(first).isEqualTo(second);
    }

    @Test
    @DisplayName("the extremes of valid latitude and longitude survive rounding")
    void handlesBounds() {
        assertThat(CitizenReportService.coarsen(90.0)).isEqualTo(90.0);
        assertThat(CitizenReportService.coarsen(-90.0)).isEqualTo(-90.0);
        assertThat(CitizenReportService.coarsen(180.0)).isEqualTo(180.0);
        assertThat(CitizenReportService.coarsen(-180.0)).isEqualTo(-180.0);
    }
}
