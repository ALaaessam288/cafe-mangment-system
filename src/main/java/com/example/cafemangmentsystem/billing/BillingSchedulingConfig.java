package com.example.cafemangmentsystem.billing;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns Spring's scheduler on for the billing lifecycle pass.
 *
 * <p>Gated by the same property as the job so a packaged single-café desktop install — which has no
 * subscriptions to age and no gateway to notify through — can switch the whole thing off with
 * {@code app.billing.scheduler-enabled=false} rather than running a pointless hourly transaction
 * against a local SQLite file.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "app.billing", name = "scheduler-enabled", havingValue = "true", matchIfMissing = true)
public class BillingSchedulingConfig {
}
