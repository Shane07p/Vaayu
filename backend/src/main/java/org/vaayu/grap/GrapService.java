package org.vaayu.grap;

import java.util.Optional;
import org.springframework.stereotype.Service;

/** Resolves a forecast AQI to the currently configured legal response stage. */
@Service
public class GrapService {
    private final GrapProperties properties;

    public GrapService(GrapProperties properties) {
        this.properties = properties;
    }

    public Optional<GrapProperties.Stage> stageFor(int aqi) {
        return properties.stages().stream()
                .filter(stage -> aqi >= stage.minAqi() && aqi <= stage.maxAqi())
                .findFirst();
    }

    public String statutoryBasis(GrapProperties.Stage stage) {
        return properties.statutoryBasisTemplate()
                .formatted(properties.revision(), stage.stage());
    }
}
