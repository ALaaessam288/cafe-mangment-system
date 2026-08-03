package com.example.cafemangmentsystem.employee.entity;

import com.example.cafemangmentsystem.common.entity.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** A staff member paid a daily wage with no system login - kitchen/cleaning/floor staff who never touch the POS. See {@link com.example.cafemangmentsystem.user.entity.User} for staff who do. */
@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee extends SoftDeletableEntity {

    @Column(name = "full_name", nullable = false)
    private String fullName;

    /** Free-text job title (e.g. "Kitchen Helper", "Cleaner") - not one of the login Roles. */
    @Column
    private String position;

    private String phone;

    @Column(name = "daily_wage", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyWage;

    @Column(name = "hire_date")
    private LocalDate hireDate;
}