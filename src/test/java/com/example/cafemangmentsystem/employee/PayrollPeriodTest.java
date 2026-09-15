package com.example.cafemangmentsystem.employee;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pay periods are computed from an anchor date, which is what lets the manual "تصفية أسبوع جديد"
 * button go away. These tests pin the arithmetic that replaces it.
 */
class PayrollPeriodTest {

    @Test
    void aWeeklyCycleRunsFromTheAnchorsWeekdayNotTheCalendars() {
        // Hired on a Tuesday: paid Tuesday to Monday, which is what was agreed with them - not a
        // short first week because the calendar happens to roll over on Saturday.
        LocalDate tuesday = LocalDate.of(2026, 9, 1);
        PayrollPeriod p = PayrollPeriod.of("WEEKLY", tuesday, LocalDate.of(2026, 9, 5));

        assertEquals(tuesday, p.start());
        assertEquals(LocalDate.of(2026, 9, 7), p.end());
    }

    @Test
    void theNextWeekRollsOverOnItsOwnWithNobodyPressingAnything() {
        LocalDate anchor = LocalDate.of(2026, 9, 1);

        PayrollPeriod first = PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 9, 7));
        PayrollPeriod second = PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 9, 8));

        assertEquals(LocalDate.of(2026, 9, 7), first.end());
        assertEquals(LocalDate.of(2026, 9, 8), second.start());
        assertEquals(LocalDate.of(2026, 9, 14), second.end());
    }

    @Test
    void weeksDoNotDriftAcrossAClosureOrAnOutage() {
        // Nobody opened the app for two months. A scheduled job would have missed every rollover;
        // a computed period simply answers correctly on the day someone does look.
        LocalDate anchor = LocalDate.of(2026, 9, 1);
        PayrollPeriod p = PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 11, 3));

        assertEquals(LocalDate.of(2026, 11, 3), p.start());
        assertEquals(LocalDate.of(2026, 11, 9), p.end());
        assertTrue(p.contains(LocalDate.of(2026, 11, 3)));
    }

    @Test
    void aDailyCycleIsJustTheDay() {
        PayrollPeriod p = PayrollPeriod.of("DAILY", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 20));
        assertEquals(LocalDate.of(2026, 9, 20), p.start());
        assertEquals(LocalDate.of(2026, 9, 20), p.end());
    }

    @Test
    void aMonthlyCycleRunsFromItsOwnDayOfTheMonth() {
        LocalDate anchor = LocalDate.of(2026, 1, 10);
        PayrollPeriod p = PayrollPeriod.of("MONTHLY", anchor, LocalDate.of(2026, 3, 15));

        assertEquals(LocalDate.of(2026, 3, 10), p.start());
        assertEquals(LocalDate.of(2026, 4, 9), p.end());
    }

    @Test
    void aMonthlyCycleAnchoredOnThe31stClampsIntoShortMonthsWithoutLeavingAGap() {
        // The interesting case, and one I got wrong first time: on 15 Feb the employee is still
        // inside the cycle that began 31 Jan, because a month from 31 Jan is 28 Feb. The clamp
        // shows up in the NEXT period, which starts on the 28th rather than skipping February.
        LocalDate anchor = LocalDate.of(2026, 1, 31);

        PayrollPeriod january = PayrollPeriod.of("MONTHLY", anchor, LocalDate.of(2026, 2, 15));
        assertEquals(LocalDate.of(2026, 1, 31), january.start());
        assertEquals(LocalDate.of(2026, 2, 27), january.end());

        PayrollPeriod february = PayrollPeriod.of("MONTHLY", anchor, LocalDate.of(2026, 3, 5));
        assertEquals(LocalDate.of(2026, 2, 28), february.start());

        // And no day falls between the two - a gap here would be a day nobody was paid for.
        assertEquals(january.end().plusDays(1), february.start());
    }

    @Test
    void anUnknownOrMissingCycleFallsBackToWeekly() {
        LocalDate anchor = LocalDate.of(2026, 9, 1);
        assertEquals(PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 9, 3)),
                     PayrollPeriod.of(null, anchor, LocalDate.of(2026, 9, 3)));
        assertEquals(PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 9, 3)),
                     PayrollPeriod.of("fortnightly", anchor, LocalDate.of(2026, 9, 3)));
    }

    @Test
    void aDateBeforeTheCycleBeganDoesNotCountBackwards() {
        LocalDate anchor = LocalDate.of(2026, 9, 10);
        PayrollPeriod p = PayrollPeriod.of("WEEKLY", anchor, LocalDate.of(2026, 9, 1));
        assertEquals(anchor, p.start());
    }
}
