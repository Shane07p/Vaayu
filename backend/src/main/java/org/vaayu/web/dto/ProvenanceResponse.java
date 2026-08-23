package org.vaayu.web.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * What the system actually knows about where its data came from.
 *
 * <p>This exists because the console previously rendered its provenance strip from
 * string literals: "CPCB Active", "FIRMS VIIRS/MODIS" and "ERA5 / IMD GFS" were
 * printed with green indicators on every screen regardless of whether those feeds
 * had ever run. They had not. Every row in the database was seed data, and the
 * meteorology table was empty.
 *
 * <p>Every field here is derived from {@code ingestion_run} and {@code model_run}.
 * There is nothing to type, so there is nothing to overstate.
 */
public record ProvenanceResponse(List<FeedProvenance> feeds, ModelProvenance model) {

    /**
     * One ingestion source and its most recent run.
     *
     * @param source     canonical name, matching {@code ingestion.source.Source.name}
     * @param liveName   what this feed is when it is connected, for display only
     * @param state      LIVE, FIXTURE, NEVER_RUN, UNAVAILABLE or FAILED
     * @param status     the recorded run status, null when the feed has never run
     * @param rowCount   rows written by that run, null when it never ran
     * @param lastRunAt  when it last ran, null when it never ran
     * @param error      why it failed, null on success
     */
    public record FeedProvenance(
            String source,
            String liveName,
            String state,
            String status,
            Integer rowCount,
            OffsetDateTime lastRunAt,
            String error) {}

    /**
     * The model behind the predictions on screen.
     *
     * @param isTrainedModel false while the rows are seeded. Derived rather than
     *                       asserted, so a seeded database cannot present itself
     *                       as a trained one.
     */
    public record ModelProvenance(
            String name, String version, OffsetDateTime trainedAt, boolean isTrainedModel) {}
}
