package com.example.cafemangmentsystem.employee.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee extends TenantScopedEntity {
    
    @Column(nullable = false)
    private String name;
    
    @Column(name = "job_title")
    private String jobTitle;
    
    @Column(name = "base_salary", precision = 10, scale = 2)
    private BigDecimal baseSalary;
    
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
