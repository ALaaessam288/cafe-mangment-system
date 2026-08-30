package com.example.cafemangmentsystem.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Copies the SQLite database to a timestamped file on every startup, keeping the most recent
 * {@link #KEEP} copies.
 * <p>
 * Caffio ships with {@code ddl-auto=update} and auto-updates itself in the field, so a schema
 * change in a new release is applied directly to a live cafe's data with no migration history and
 * no way back. A dated copy taken before Hibernate touches anything is the difference between
 * "restore yesterday's file" and "the month's sales are gone".
 * <p>
 * Runs as an {@link ApplicationRunner} rather than a pre-context hook: by this point Hibernate has
 * already opened the database, so a WAL checkpoint has happened and the {@code .db} file on disk is
 * consistent. Any failure here is logged and swallowed - a backup problem must never stop a cafe
 * from taking orders.
 */
@Component
@Order(Integer.MIN_VALUE)
public class DatabaseBackupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseBackupRunner.class);

    /** Roughly two weeks of daily restarts. */
    private static final int KEEP = 14;

    private static final Path HOME = Path.of(System.getProperty("user.home"), ".cafepos");
    private static final Path DATABASE = HOME.resolve("cafe.db");
    private static final Path BACKUP_DIR = HOME.resolve("backups");

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!Files.exists(DATABASE) || Files.size(DATABASE) == 0) {
                // First ever launch - nothing worth preserving yet.
                return;
            }

            Files.createDirectories(BACKUP_DIR);
            Path target = BACKUP_DIR.resolve("cafe-" + LocalDateTime.now().format(STAMP) + ".db");
            Files.copy(DATABASE, target, StandardCopyOption.REPLACE_EXISTING);
            log.info("Database backed up to {}", target);

            prune();
        } catch (IOException | RuntimeException e) {
            log.warn("Database backup failed - continuing startup anyway: {}", e.getMessage());
        }
    }

    private void prune() throws IOException {
        try (Stream<Path> files = Files.list(BACKUP_DIR)) {
            List<Path> stale = files
                    .filter(p -> p.getFileName().toString().startsWith("cafe-"))
                    .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                    .skip(KEEP)
                    .toList();

            for (Path p : stale) {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    log.warn("Could not delete old backup {}: {}", p, e.getMessage());
                }
            }
        }
    }
}
