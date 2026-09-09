package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.employee.dto.EmployeeDto;
import com.example.cafemangmentsystem.employee.dto.EmployeeRequest;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
import com.example.cafemangmentsystem.employee.repository.EmployeeTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeTransactionRepository employeeTransactionRepository;

    @Transactional(readOnly = true)
    public List<EmployeeDto> findAll() {
        return employeeRepository.findAll().stream()
                .map(EmployeeDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public EmployeeDto create(EmployeeRequest request) {
        Employee employee = new Employee();
        employee.setName(request.name());
        employee.setJobTitle(request.jobTitle());
        employee.setBaseSalary(request.baseSalary());
        employee.setSalaryPeriod(request.salaryPeriod() != null ? request.salaryPeriod() : "WEEKLY");
        employee.setActive(request.active() != null ? request.active() : true);
        return EmployeeDto.from(employeeRepository.save(employee));
    }

    @Transactional
    public EmployeeDto update(Long id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        employee.setName(request.name());
        employee.setJobTitle(request.jobTitle());
        employee.setBaseSalary(request.baseSalary());
        if (request.salaryPeriod() != null) {
            employee.setSalaryPeriod(request.salaryPeriod());
        }
        if (request.active() != null) {
            employee.setActive(request.active());
        }

        return EmployeeDto.from(employeeRepository.save(employee));
    }

    /**
     * Removes an employee, keeping the payroll record intact.
     *
     * <p>This used to be an unconditional hard delete. {@code employee_transactions.employee_id} is
     * a non-null foreign key with no cascade, so deleting anyone who had ever been paid, docked or
     * advanced failed on a constraint violation surfaced as an opaque 500 - and had it succeeded it
     * would have erased the wage history behind money that was actually handed over. An employee who
     * has left is deactivated instead: they drop out of the active lists, their ledger survives, and
     * only a record with no financial history is deleted outright.
     *
     * @return {@code true} if the row was deleted, {@code false} if it was deactivated instead.
     */
    @Transactional
    public boolean delete(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        if (employeeTransactionRepository.countByEmployeeId(id) > 0) {
            employee.setActive(false);
            employeeRepository.save(employee);
            return false;
        }
        employeeRepository.delete(employee);
        return true;
    }
}
