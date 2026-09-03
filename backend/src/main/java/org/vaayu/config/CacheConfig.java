package org.vaayu.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Cache lifetimes follow how frequently each upstream projection can change. */
@Configuration
public class CacheConfig {

    @Bean
    CaffeineCacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache("stations", cache(Duration.ofMinutes(15)));
        manager.registerCustomCache("forecastStations", cache(Duration.ofMinutes(15)));
        manager.registerCustomCache("grid", cache(Duration.ofMinutes(30)));
        manager.registerCustomCache("forecast", cache(Duration.ofMinutes(5)));
        manager.registerCustomCache("worklist", cache(Duration.ofMinutes(5)));
        // An alert's facts do not change once it is issued, so its narrative is
        // stable and cacheable. A change to the facts produces a different key
        // and therefore a regeneration, so this cannot serve a stale briefing
        // for facts that have moved.
        manager.registerCustomCache("narratives", cache(Duration.ofHours(6)));
        return manager;
    }

    private static com.github.benmanes.caffeine.cache.Cache<Object, Object> cache(Duration ttl) {
        return Caffeine.newBuilder().maximumSize(1_000).expireAfterWrite(ttl).build();
    }
}
