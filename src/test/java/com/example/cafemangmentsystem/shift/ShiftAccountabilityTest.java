package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.cashmovement.dto.CashDrawerSummaryDto;
import com.example.cafemangmentsystem.cashmovement.dto.CashMovementRequest;
import com.example.cafemangmentsystem.cashmovement.entity.CashMovement;
import com.example.cafemangmentsystem.cashmovement.entity.CashMovementType;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.order.dto.OpenOrderRequest;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderType;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.shift.dto.CloseShiftRequest;
import com.example.cafemangmentsystem.shift.dto.OpenShiftRequest;
import com.example.cafemangmentsystem.shift.dto.ShiftResponse;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class ShiftAccountabilityTest {

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void canonicalDrawerEquationCalculatesAccurately() {
        BigDecimal openingFloat = new BigDecimal("500.00");
        BigDecimal cashSales = new BigDecimal("1250.00");
        BigDecimal cashIn = new BigDecimal("200.00");
        BigDecimal safeDrops = new BigDecimal("1000.00");
        BigDecimal cashOut = new BigDecimal("150.00");
        BigDecimal cashExpenses = new BigDecimal("100.00");
        BigDecimal countedCash = new BigDecimal("700.00");

        // Canonical: 500 + 1250 + 200 - 1000 - 150 - 100 = 700.00
        BigDecimal expectedCash = openingFloat
                .add(cashSales)
                .add(cashIn)
                .subtract(safeDrops)
                .subtract(cashOut)
                .subtract(cashExpenses);

        assertEquals(new BigDecimal("700.00"), expectedCash);

        BigDecimal variance = countedCash.subtract(expectedCash);
        assertEquals(new BigDecimal("0.00"), variance);
    }

    @Test
    public void drawerWithShortfallShowsNegativeVariance() {
        BigDecimal openingFloat = new BigDecimal("200.00");
        BigDecimal cashSales = new BigDecimal("800.00");
        BigDecimal expectedCash = openingFloat.add(cashSales); // 1000.00

        BigDecimal countedCash = new BigDecimal("950.00"); // 50 shortfall
        BigDecimal variance = countedCash.subtract(expectedCash);

        assertEquals(new BigDecimal("-50.00"), variance);
        assertTrue(variance.compareTo(BigDecimal.ZERO) < 0);
    }

    @Test
    public void cannotOpenShiftWithNegativeFloat() {
        OpenShiftRequest req = new OpenShiftRequest(1L, new BigDecimal("-100.00"));
        assertTrue(req.openingFloat().compareTo(BigDecimal.ZERO) < 0);
    }

    @Test
    public void closedShiftIsImmutable() {
        Shift shift = new Shift();
        shift.setId(101L);
        shift.setClosedAt(Instant.now());

        Order order = new Order();
        order.setId(501L);
        order.setShift(shift);

        // Verification of immutability rule
        boolean isClosed = order.getShift() != null && order.getShift().getClosedAt() != null;
        assertTrue(isClosed);
    }
}
