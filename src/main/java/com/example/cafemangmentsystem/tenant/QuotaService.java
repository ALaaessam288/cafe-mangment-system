package com.example.cafemangmentsystem.tenant;

/**
 * @deprecated Superseded by {@link com.example.cafemangmentsystem.billing.QuotaService}, which
 * resolves limits from the tenant's subscription rather than from a hardcoded enum, understands
 * {@code UNLIMITED}, and does not treat a limit of {@code 0} as "no limit".
 *
 * <p>Kept only as a tombstone so the old fully-qualified name doesn't silently resolve to
 * something else during review. It is not a Spring bean and has no behaviour; delete the file.
 */
@Deprecated(forRemoval = true)
public final class QuotaService {

    private QuotaService() {
        throw new UnsupportedOperationException("Use com.example.cafemangmentsystem.billing.QuotaService");
    }
}
