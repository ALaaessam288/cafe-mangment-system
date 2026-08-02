package com.example.cafemangmentsystem.printing.repository;

import com.example.cafemangmentsystem.printing.entity.PrintJob;
import com.example.cafemangmentsystem.printing.entity.PrintJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PrintJobRepository extends JpaRepository<PrintJob, Long> {

    List<PrintJob> findAllByOrderId(Long orderId);

    List<PrintJob> findAllByStatus(PrintJobStatus status);

    List<PrintJob> findAllByPrinterIdAndStatus(Long printerId, PrintJobStatus status);
}