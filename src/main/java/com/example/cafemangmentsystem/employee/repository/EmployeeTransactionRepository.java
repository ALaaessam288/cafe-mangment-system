package com.example.cafemangmentsystem.employee.repository;

import com.example.cafemangmentsystem.employee.entity.EmployeeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EmployeeTransactionRepository extends JpaRepository<EmployeeTransaction, Long> {

    List<EmployeeTransaction> findByEmployeeIdOrderByTransactionDateDescIdDesc(Long employeeId);

    List<EmployeeTransaction> findByTransactionDateBetween(LocalDate startDate, LocalDate endDate);

    List<EmployeeTransaction> findByEmployeeIdAndTransactionDateBetween(Long employeeId, LocalDate startDate, LocalDate endDate);

    List<EmployeeTransaction> findBySettledFalseAndTransactionDateLessThanEqual(LocalDate transactionDate);

    List<EmployeeTransaction> findBySettledFalse();
}
