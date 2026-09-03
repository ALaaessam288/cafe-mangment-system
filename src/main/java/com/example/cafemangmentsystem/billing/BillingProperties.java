package com.example.cafemangmentsystem.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Platform billing policy. Everything here used to be a magic number scattered through the
 * services — 14 in three places, 30 in another, 3650 for "lifetime".
 */
@Component
@ConfigurationProperties(prefix = "app.billing")
public class BillingProperties {

    /** Free trial length for a self-service signup. */
    private int trialDays = 14;

    /** Days of continued write access after a period lapses, before the account goes read-only. */
    private int graceDays = 5;

    /** Days before expiry at which the owner is warned. Descending. */
    private List<Integer> warningDays = List.of(7, 3, 1);

    /** Days an invoice is payable before it is considered overdue. */
    private int invoiceDueDays = 7;

    /** Prefix for generated invoice numbers. */
    private String invoicePrefix = "CAF";

    /** Run the expiry/grace/warning pass on a schedule. Off inside the packaged desktop build. */
    private boolean schedulerEnabled = true;

    public int getTrialDays() { return trialDays; }
    public void setTrialDays(int trialDays) { this.trialDays = trialDays; }

    public int getGraceDays() { return graceDays; }
    public void setGraceDays(int graceDays) { this.graceDays = graceDays; }

    public List<Integer> getWarningDays() { return warningDays; }
    public void setWarningDays(List<Integer> warningDays) { this.warningDays = warningDays; }

    public int getInvoiceDueDays() { return invoiceDueDays; }
    public void setInvoiceDueDays(int invoiceDueDays) { this.invoiceDueDays = invoiceDueDays; }

    public String getInvoicePrefix() { return invoicePrefix; }
    public void setInvoicePrefix(String invoicePrefix) { this.invoicePrefix = invoicePrefix; }

    public boolean isSchedulerEnabled() { return schedulerEnabled; }
    public void setSchedulerEnabled(boolean schedulerEnabled) { this.schedulerEnabled = schedulerEnabled; }
}
