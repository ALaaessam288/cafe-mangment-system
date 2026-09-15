package com.example.cafemangmentsystem.employee;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * The pay period an employee is currently in, worked out from an anchor date rather than stored.
 *
 * <p>This exists because the screen had no notion of a period at all. The summary took a start and
 * an end date from whoever called it, handed every employee their whole base salary regardless of
 * the window, and offered a "تصفية أسبوع جديد" button that swept every unsettled transaction to
 * settled - without paying any of it. Press it a day early and the money owed simply stopped being
 * displayed.
 *
 * <p>A computed period removes the whole category of problem. There is nothing to reset, so nothing
 * can be reset at the wrong moment; nothing drifts if the café is closed for a week or the server
 * is down on a Friday; and asking which period a date in the past belonged to is the same
 * calculation as asking about today, so old payouts stay correctly attributed forever. A scheduled
 * job that flips a flag at midnight has none of those properties.
 *
 * @param start first day of the period, inclusive
 * @param end   last day of the period, inclusive
 */
public record PayrollPeriod(LocalDate start, LocalDate end) {

    public static final String DAILY = "DAILY";
    public static final String WEEKLY = "WEEKLY";
    public static final String MONTHLY = "MONTHLY";

    /**
     * The period containing {@code on}, for an employee whose cycle began on {@code anchor}.
     *
     * <p>Periods are counted FROM the anchor, not from a calendar boundary: an employee hired on a
     * Tuesday is paid Tuesday to Monday, which is what was actually agreed with them, rather than
     * being handed a short first week because the calendar happens to start on Saturday.
     */
    public static PayrollPeriod of(String salaryPeriod, LocalDate anchor, LocalDate on) {
        LocalDate from = anchor != null ? anchor : on;
        // A date before the cycle even began has no earlier period to fall into; treat the anchor
        // as the start rather than counting backwards into negative periods.
        if (on.isBefore(from)) return new PayrollPeriod(from, from);

        return switch (normalise(salaryPeriod)) {
            case DAILY -> new PayrollPeriod(on, on);

            case MONTHLY -> {
                // Whole months from the anchor's day-of-month. plusMonths already clamps the 31st
                // into a 30-day month, so a cycle anchored on the 31st does not skip February.
                long months = ChronoUnit.MONTHS.between(from, on);
                LocalDate periodStart = from.plusMonths(months);
                if (periodStart.isAfter(on)) periodStart = from.plusMonths(months - 1);
                yield new PayrollPeriod(periodStart, periodStart.plusMonths(1).minusDays(1));
            }

            default -> {
                long weeks = ChronoUnit.DAYS.between(from, on) / 7;
                LocalDate periodStart = from.plusWeeks(weeks);
                yield new PayrollPeriod(periodStart, periodStart.plusDays(6));
            }
        };
    }

    /** Anything unrecognised is treated as weekly, which is the system's own default. */
    private static String normalise(String salaryPeriod) {
        if (salaryPeriod == null) return WEEKLY;
        String upper = salaryPeriod.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (upper) {
            case DAILY, WEEKLY, MONTHLY -> upper;
            default -> WEEKLY;
        };
    }

    public boolean contains(LocalDate date) {
        return date != null && !date.isBefore(start) && !date.isAfter(end);
    }
}
