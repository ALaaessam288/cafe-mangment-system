package com.example.cafemangmentsystem.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFileAttributeView;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Per-installation secret material, persisted next to the database in {@code ~/.cafepos}.
 * <p>
 * Caffio ships as a desktop installer, so anything hardcoded in {@code application.properties}
 * is compiled into {@code backend.jar} and is identical on every customer's machine - a JWT
 * signing key baked into the artifact lets anyone who unzips the installer forge a token for
 * any tenant on any installation. Instead, each install generates its own random secret on
 * first boot and reuses it thereafter.
 * <p>
 * An explicitly configured value (property or environment variable) always wins, so server
 * deployments and integration tests can still pin a known key.
 */
public final class SecretMaterial {

    private static final Logger log = LoggerFactory.getLogger(SecretMaterial.class);

    /** Same directory the SQLite database lives in, so backup/restore covers both. */
    private static final Path HOME = Path.of(System.getProperty("user.home"), ".cafepos");

    private SecretMaterial() {
    }

    /**
     * Returns the configured value if one was supplied, otherwise the contents of
     * {@code ~/.cafepos/<fileName>} - generating that file with {@code byteLength} bytes of
     * strong randomness the first time it is needed.
     */
    public static String resolveOrGenerate(String configuredValue, String fileName, int byteLength) {
        if (configuredValue != null && !configuredValue.isBlank()) {
            return configuredValue;
        }

        Path file = HOME.resolve(fileName);
        try {
            if (Files.exists(file)) {
                try {
                    String existing = Files.readString(file, StandardCharsets.UTF_8).trim();
                    if (!existing.isEmpty()) {
                        return existing;
                    }
                } catch (IOException e) {
                    log.warn("Could not read existing secret from {}, regenerating: {}", file, e.getMessage());
                }
            }

            try {
                Files.createDirectories(HOME);
            } catch (IOException e) {
                log.warn("Could not create directory {}, proceeding with in-memory secret: {}", HOME, e.getMessage());
            }

            byte[] raw = new byte[byteLength];
            SecureRandom.getInstanceStrong().nextBytes(raw);
            String generated = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

            try {
                Files.writeString(file, generated, StandardCharsets.UTF_8);
                restrictToOwner(file);
                log.info("Generated a new per-installation secret at {}", file);
            } catch (IOException e) {
                log.warn("Could not persist secret to {}, using in-memory: {}", file, e.getMessage());
            }

            return generated;
        } catch (NoSuchAlgorithmException e) {
            log.error("SecureRandom algorithm unavailable, using fallback random", e);
            byte[] raw = new byte[byteLength];
            new SecureRandom().nextBytes(raw);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        }
    }

    /**
     * Best-effort tightening of file permissions to the current user only on POSIX systems.
     * Windows profile folders (~/.cafepos) are already private to the current Windows user.
     */
    private static void restrictToOwner(Path file) {
        try {
            PosixFileAttributeView posix = Files.getFileAttributeView(file, PosixFileAttributeView.class);
            if (posix != null) {
                posix.setPermissions(EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
            }
        } catch (IOException | UnsupportedOperationException | SecurityException e) {
            log.warn("Could not restrict POSIX permissions on {}: {}", file, e.getMessage());
        }
    }
}
