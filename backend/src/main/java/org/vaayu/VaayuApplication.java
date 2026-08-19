package org.vaayu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class VaayuApplication {

    public static void main(String[] args) {
        SpringApplication.run(VaayuApplication.class, args);
    }
}
