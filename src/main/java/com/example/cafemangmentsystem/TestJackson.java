package com.example.cafemangmentsystem;

import com.example.cafemangmentsystem.employee.dto.EmployeeDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.math.BigDecimal;
import java.time.Instant;

public class TestJackson {
    public static void main(String[] args) throws Exception {
        EmployeeDto dto = new EmployeeDto(1L, "ali", "Waiter", new BigDecimal("200"), true, Instant.now());
        
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        System.out.println(mapper.writeValueAsString(dto));
    }
}
