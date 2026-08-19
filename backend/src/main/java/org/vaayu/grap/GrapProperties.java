package org.vaayu.grap;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Runtime-loaded GRAP schedule. Statutory thresholds do not belong in Java constants. */
@ConfigurationProperties(prefix = "grap")
public record GrapProperties(
        String revision, String statutoryBasisTemplate, List<Stage> stages) {

    public record Stage(
            String stage, String label, int minAqi, int maxAqi, List<String> mandatedActions) {}
}
