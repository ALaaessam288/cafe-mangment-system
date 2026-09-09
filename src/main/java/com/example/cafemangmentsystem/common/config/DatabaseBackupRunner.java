package com.example.cafemangmentsystem.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
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
 *
 * <p><strong>Startup alone is not a backup schedule.</strong> A till that stays powered on for six
 * weeks used to hold exactly one copy, taken six weeks earlier, and nobody was told. It now also
 * runs daily.
 *
 * <p><strong>This covers the desktop SQLite build only.</strong> A SaaS deployment on PostgreSQL has
 * no {@code cafe.db} to copy, and nothing else in this codebase backs that database up - that is
 * infrastructure (a managed snapshot policy, or a scheduled {@code pg_dump}), not something the
 * application should pretend to do from inside itself. The warning logged on startup exists so the
 * gap is visible rather than assumed handled.
 */
@Component
@Order(Integer.MIN_VALUE)
public class DatabaseBackupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseBackupRunner.class);

    /** Two weeks of daily copies. */
    private static final int KEEP = 14;

    private static final Path HOME = Path.of(System.getProperty("user.home"), ".cafepos");
    private static final Path DATABASE = HOME.resolve("cafe.db");
    private static final Path BACKUP_DIR = HOME.resolve("backups");

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Override
    public void run(ApplicationArguments args) {
        if (!datasourceUrl.isBlank() && !datasourceUrl.startsWith("jdbc:sqlite")) {
            // Said once, loudly, at startup: this class cannot protect a server database, and
            // silence here would read as "backups are handled".
            log.warn("No application-level backup for {} - this runner only copies the desktop "
                    + "SQLite file. Configure managed snapshots or a scheduled pg_dump.",
                    datasourceUrl.split("\\?")[0]);
            return;
        }
        backup("startup");
    }

    /**
     * Daily copy at 04:00, when a cafe is closed and the file is quiet.
     *
     * <p>Fixed-time rather than fixed-delay: a machine that is switched off overnight should back up
     * shortly after it is switched on, not 24 hours after whenever it last happened to run.
     */
    @Scheduled(cron = "0 0 4 * * *")
    public void scheduledBackup() {
        if (!datasourceUrl.isBlank() && !datasourceUrl.startsWith("jdbc:sqlite")) return;
        backup("daily");
    }

    private void backup(String trigger) {
        try {
            if (!Files.exists(DATABASE) || Files.size(DATABASE) == 0) {
                // First ever launch - nothing worth preserving yet.
                return;
            }

            Files.createDirectories(BACKUP_DIR);
            Path target = BACKUP_DIR.resolve("cafe-" + LocalDateTime.now().format(STAMP) + ".db");
            Files.copy(DATABASE, target, StandardCopyOption.REPLACE_EXISTING);
            log.info("Database backed up to {} ({})", target, trigger);

            prune();
        } catch (IOException | RuntimeException e) {
            log.warn("Database backup failed ({}) - continuing anyway: {}", trigger, e.getMessage());
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
