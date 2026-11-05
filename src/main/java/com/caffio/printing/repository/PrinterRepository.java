package com.caffio.printing.repository;

import com.caffio.printing.entity.Printer;
import com.caffio.printing.entity.PrinterType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrinterRepository extends JpaRepository<Printer, Long> {

    List<Printer> findAllByType(PrinterType type);

    Optional<Printer> findFirstByType(PrinterType type);
}