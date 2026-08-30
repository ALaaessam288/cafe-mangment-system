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
    
    @Column(name = "full_name")
    private String fullName;

    @Column(name = "name")
    private String name;
    
    @Column(name = "position")
    private String position;

    @Column(name = "job_title")
    private String jobTitle;
    
    @Column(name = "base_salary", precision = 10, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "daily_wage", precision = 10, scale = 2)
    private BigDecimal dailyWage;

    @Column(name = "phone")
    private String phone;

    @Column(name = "hire_date")
    private java.time.LocalDate hireDate;
    
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    // Mapping helper methods for backward/forward compatibility
    public String getFullName() {
        return fullName != null ? fullName : name;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
        this.name = fullName;
    }

    public String getName() {
        return name != null ? name : fullName;
    }

    public void setName(String name) {
        this.name = name;
        this.fullName = name;
    }

    public String getPosition() {
        return position != null ? position : jobTitle;
    }

    public void setPosition(String position) {
        this.position = position;
        this.jobTitle = position;
    }

    public String getJobTitle() {
        return jobTitle != null ? jobTitle : position;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
        this.position = jobTitle;
    }

    public BigDecimal getBaseSalary() {
        return baseSalary != null ? baseSalary : dailyWage;
    }

    public void setBaseSalary(BigDecimal baseSalary) {
        this.baseSalary = baseSalary;
        this.dailyWage = baseSalary;
    }

    public BigDecimal getDailyWage() {
        return dailyWage != null ? dailyWage : baseSalary;
    }

    public void setDailyWage(BigDecimal dailyWage) {
        this.dailyWage = dailyWage;
        this.baseSalary = dailyWage;
    }

    @Column(name = "salary_period")
    @Builder.Default
    private String salaryPeriod = "WEEKLY";

    public String getSalaryPeriod() {
        return salaryPeriod != null ? salaryPeriod : "WEEKLY";
    }

    public void setSalaryPeriod(String salaryPeriod) {
        this.salaryPeriod = salaryPeriod;
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public java.time.LocalDate getHireDate() { return hireDate; }
    public void setHireDate(java.time.LocalDate hireDate) { this.hireDate = hireDate; }
}
