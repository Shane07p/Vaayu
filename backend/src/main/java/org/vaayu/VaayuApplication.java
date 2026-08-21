package org.vaayu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.vaayu.grap.GrapProperties;

@SpringBootApplication
@EnableCaching
@EnableScheduling
@EnableConfigurationProperties(GrapProperties.class)
public class VaayuApplication {

    public static void main(String[] args) {
        SpringApplication.run(VaayuApplication.class, args);
    }
}
