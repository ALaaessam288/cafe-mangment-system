package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.employee.dto.EmployeeDto;
import com.example.cafemangmentsystem.employee.dto.EmployeeRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    // Accessible to all authenticated users so Cashier can view and pay salary
    @GetMapping
    public List<EmployeeDto> findAll() {
        return employeeService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public EmployeeDto create(@Valid @RequestBody EmployeeRequest request) {
        return employeeService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public EmployeeDto update(@PathVariable Long id, @Valid @RequestBody EmployeeRequest request) {
        return employeeService.update(id, request);
    }

    /** Returns whether the record was removed outright or only deactivated, so the UI can say which. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public java.util.Map<String, Boolean> delete(@PathVariable Long id) {
        boolean removed = employeeService.delete(id);
        return java.util.Map.of("removed", removed, "deactivated", !removed);
    }
}
