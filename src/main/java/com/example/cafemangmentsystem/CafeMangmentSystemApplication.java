package com.example.cafemangmentsystem;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CafeMangmentSystemApplication {

    static {
        // Create .cafepos folder in user home so SQLite JDBC driver does not fail with "directory not found"
        String userHome = System.getProperty("user.home");
        java.io.File dir = new java.io.File(userHome + java.io.File.separator + ".cafepos");
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(CafeMangmentSystemApplication.class, args);
    }

    @org.springframework.context.annotation.Bean
    public com.fasterxml.jackson.databind.ObjectMapper objectMapper() {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }
}
