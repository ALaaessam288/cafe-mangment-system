package com.example.cafemangmentsystem.printing;

import com.example.cafemangmentsystem.printing.dto.PrintJobResponse;
import com.example.cafemangmentsystem.printing.dto.UpdatePrintJobStatusRequest;
import com.example.cafemangmentsystem.printing.entity.PrintJobStatus;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/print-jobs")
@RequiredArgsConstructor
public class PrintJobController {

    private final PrintJobService printJobService;

    @GetMapping
    public List<PrintJobResponse> findAll(@RequestParam(required = false) PrintJobStatus status,
                                           @RequestParam(required = false) Long printerId) {
        return printJobService.findAll(status, printerId);
    }

    @PutMapping("/{id}/status")
    public PrintJobResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdatePrintJobStatusRequest request) {
        return printJobService.updateStatus(id, request);
    }
}