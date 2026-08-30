package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.employee.dto.EmployeeDto;
import com.example.cafemangmentsystem.employee.dto.EmployeeRequest;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
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

    @Transactional
    public void delete(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        employeeRepository.delete(employee);
    }
}
