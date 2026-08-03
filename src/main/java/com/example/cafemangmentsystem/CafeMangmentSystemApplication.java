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
}
