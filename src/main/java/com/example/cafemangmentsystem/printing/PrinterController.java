package com.example.cafemangmentsystem.printing;

import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.printing.dto.PrinterRequest;
import com.example.cafemangmentsystem.printing.dto.PrinterResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiresFeature(Feature.THERMAL_PRINT)
@RestController
@RequestMapping("/api/printers")
@RequiredArgsConstructor
public class PrinterController {

    private final PrinterService printerService;

    @GetMapping
    public List<PrinterResponse> findAll() {
        return printerService.findAll();
    }

    @GetMapping("/{id}")
    public PrinterResponse findById(@PathVariable Long id) {
        return printerService.findById(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public PrinterResponse create(@Valid @RequestBody PrinterRequest request) {
        return printerService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public PrinterResponse update(@PathVariable Long id, @Valid @RequestBody PrinterRequest request) {
        return printerService.update(id, request);
    }

    @PutMapping("/{id}/heartbeat")
    public PrinterResponse heartbeat(@PathVariable Long id) {
        return printerService.heartbeat(id);
    }
}