package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.employee.dto.EmployeeRequest;
import com.example.cafemangmentsystem.employee.dto.EmployeeResponse;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeResponse create(EmployeeRequest request) {
        Employee employee = Employee.builder()
                .fullName(request.fullName())
                .position(request.position())
                .phone(request.phone())
                .dailyWage(request.dailyWage())
                .hireDate(request.hireDate())
                .build();

        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> findAll() {
        return employeeRepository.findAll().stream()
                .map(EmployeeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse findById(Long id) {
        return EmployeeResponse.from(getOrThrow(id));
    }

    public EmployeeResponse update(Long id, EmployeeRequest request) {
        Employee employee = getOrThrow(id);
        employee.setFullName(request.fullName());
        employee.setPosition(request.position());
        employee.setPhone(request.phone());
        employee.setDailyWage(request.dailyWage());
        employee.setHireDate(request.hireDate());
        return EmployeeResponse.from(employee);
    }

    public EmployeeResponse deactivate(Long id, Long deactivatedByUserId) {
        Employee employee = getOrThrow(id);
        employee.deactivate(deactivatedByUserId);
        return EmployeeResponse.from(employee);
    }

    public EmployeeResponse activate(Long id) {
        Employee employee = getOrThrow(id);
        employee.activate();
        return EmployeeResponse.from(employee);
    }

    Employee getOrThrow(Long id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found: " + id));
    }
}