package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
import com.example.cafemangmentsystem.employee.repository.EmployeeTransactionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Removing an employee must never take the wage ledger with it.
 *
 * <p>{@code employee_transactions.employee_id} is a non-null foreign key with no cascade, and this
 * used to be an unconditional {@code repository.delete()}. Anyone who had ever been paid, docked or
 * advanced failed on a constraint violation surfaced as an opaque 500 - and had the delete gone
 * through it would have erased the record behind money that actually changed hands.
 */
@ExtendWith(MockitoExtension.class)
public class EmployeeRemovalTest {

    @Mock private EmployeeRepository employeeRepository;
    @Mock private EmployeeTransactionRepository employeeTransactionRepository;
    @InjectMocks private EmployeeService employeeService;

    private Employee employee;

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
        employee = new Employee();
        employee.setId(7L);
        employee.setName("أحمد");
        employee.setJobTitle("باريستا");
        employee.setBaseSalary(new BigDecimal("1500.00"));
        employee.setActive(true);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void anEmployeeWithPayrollHistoryIsDeactivatedNotDeleted() {
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(employeeTransactionRepository.countByEmployeeId(7L)).thenReturn(3L);

        boolean removed = employeeService.delete(7L);

        assertFalse(removed, "the caller must be told this was a deactivation");
        assertFalse(employee.isActive());
        verify(employeeRepository).save(employee);
        verify(employeeRepository, never()).delete(any());
    }

    @Test
    public void anEmployeeWithNoFinancialHistoryIsDeletedOutright() {
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(employeeTransactionRepository.countByEmployeeId(7L)).thenReturn(0L);

        boolean removed = employeeService.delete(7L);

        assertTrue(removed);
        verify(employeeRepository).delete(employee);
        verify(employeeRepository, never()).save(any());
    }

    @Test
    public void deletingSomeoneWhoIsNotThereIsANotFoundNotACrash() {
        when(employeeRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> employeeService.delete(99L));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    public void deactivationKeepsTheRecordItselfIntact() {
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(employeeTransactionRepository.countByEmployeeId(7L)).thenReturn(1L);

        employeeService.delete(7L);

        // Name and wage survive, because the payroll rows still point at them.
        assertEquals("أحمد", employee.getName());
        assertEquals(new BigDecimal("1500.00"), employee.getBaseSalary());
    }
}
