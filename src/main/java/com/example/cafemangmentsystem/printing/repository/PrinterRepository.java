package com.example.cafemangmentsystem.printing.repository;

import com.example.cafemangmentsystem.printing.entity.Printer;
import com.example.cafemangmentsystem.printing.entity.PrinterType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrinterRepository extends JpaRepository<Printer, Long> {

    List<Printer> findAllByType(PrinterType type);

    Optional<Printer> findFirstByType(PrinterType type);
}