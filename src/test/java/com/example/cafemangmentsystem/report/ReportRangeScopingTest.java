package com.example.cafemangmentsystem.report;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Every panel on the reports screen has to answer for the same window.
 *
 * <p>Best sellers and hourly sales did not accept {@code shiftId} at all, while the financial report
 * and recipe profitability did. Selecting a shift therefore left two panels showing all-time totals
 * underneath a heading naming one shift - two different answers to the same question on one screen,
 * with nothing to tell the reader which was wrong.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class ReportRangeScopingTest {

    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private ShiftRepository shiftRepository;

    private ReportService reportService;

    private final Instant shiftOpened = Instant.parse("2026-09-01T06:00:00Z");
    private final Instant shiftClosed = Instant.parse("2026-09-01T18:00:00Z");

    @BeforeEach
    public void setUp() throws Exception {
        TenantContext.set(1L);
        reportService = newServiceWithMocks();

        Shift shift = new Shift();
        shift.setId(42L);
        shift.setOpenedAt(shiftOpened);
        shift.setClosedAt(shiftClosed);
        when(shiftRepository.findById(42L)).thenReturn(Optional.of(shift));

        when(orderItemRepository.findTopProductsByQuantity(any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(orderRepository.findHourlySales(any(), any())).thenReturn(List.of());
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    /** ReportService takes eight collaborators; only three matter here, so inject by field. */
    private ReportService newServiceWithMocks() throws Exception {
        ReportService svc = (ReportService) sun(ReportService.class);
        set(svc, "orderRepository", orderRepository);
        set(svc, "orderItemRepository", orderItemRepository);
        set(svc, "shiftRepository", shiftRepository);
        return svc;
    }

    private static Object sun(Class<?> c) throws Exception {
        // No no-arg constructor (Lombok @RequiredArgsConstructor), so build one unsafely.
        java.lang.reflect.Constructor<?> ctor = c.getDeclaredConstructors()[0];
        ctor.setAccessible(true);
        Object[] args = new Object[ctor.getParameterCount()];
        return ctor.newInstance(args);
    }

    private static void set(Object target, String field, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(target, value);
    }

    @Test
    public void bestSellersScopedByShiftUsesTheShiftWindow() {
        reportService.getBestSellers(null, null, 42L, 15);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(orderItemRepository).findTopProductsByQuantity(from.capture(), to.capture(), any(Pageable.class));

        assertEquals(shiftOpened, from.getValue());
        assertEquals(shiftClosed, to.getValue());
    }

    @Test
    public void hourlySalesScopedByShiftUsesTheSameWindow() {
        reportService.getHourlySales(null, null, 42L);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).findHourlySales(from.capture(), to.capture());

        assertEquals(shiftOpened, from.getValue());
        assertEquals(shiftClosed, to.getValue());
    }

    @Test
    public void bestSellersAndHourlySalesAgreeOnTheWindowForTheSameShift() {
        reportService.getBestSellers(null, null, 42L, 15);
        reportService.getHourlySales(null, null, 42L);

        ArgumentCaptor<Instant> bsFrom = ArgumentCaptor.forClass(Instant.class);
        verify(orderItemRepository).findTopProductsByQuantity(bsFrom.capture(), any(), any(Pageable.class));
        ArgumentCaptor<Instant> hsFrom = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).findHourlySales(hsFrom.capture(), any());

        assertEquals(bsFrom.getValue(), hsFrom.getValue(),
                "two panels on one screen must not report on different periods");
    }

    @Test
    public void aStillOpenShiftIsScopedFromItsOpeningUntilNow() {
        Shift open = new Shift();
        open.setId(43L);
        open.setOpenedAt(shiftOpened);
        open.setClosedAt(null);
        when(shiftRepository.findById(43L)).thenReturn(Optional.of(open));

        Instant before = Instant.now();
        reportService.getHourlySales(null, null, 43L);

        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).findHourlySales(any(), to.capture());
        assertFalse(to.getValue().isBefore(before), "an open shift runs up to now, not to null");
    }

    @Test
    public void anUnknownShiftFallsBackToTheDateRangeRatherThanSilentlyReturningEverything() {
        when(shiftRepository.findById(999L)).thenReturn(Optional.empty());

        reportService.getHourlySales("2026-09-01", "2026-09-01", 999L);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).findHourlySales(from.capture(), any());
        assertNotNull(from.getValue());
    }

    @Test
    public void withNoShiftTheDatesStillDecideTheWindow() {
        reportService.getBestSellers("2026-09-01", "2026-09-02", null, 15);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(orderItemRepository).findTopProductsByQuantity(from.capture(), to.capture(), any(Pageable.class));

        assertNotNull(from.getValue());
        assertNotNull(to.getValue());
        assertTrue(from.getValue().isBefore(to.getValue()));
        assertTrue(Duration(from.getValue(), to.getValue()) <= 48,
                "two calendar days in Africa/Cairo, not an open-ended range");
    }

    private static long Duration(Instant a, Instant b) {
        return ChronoUnit.HOURS.between(a, b);
    }
}
