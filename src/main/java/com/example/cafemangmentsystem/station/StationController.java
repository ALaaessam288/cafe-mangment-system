package com.example.cafemangmentsystem.station;

import com.example.cafemangmentsystem.station.dto.AssignPrinterRequest;
import com.example.cafemangmentsystem.station.dto.StationRequest;
import com.example.cafemangmentsystem.station.dto.StationResponse;
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

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationService stationService;

    @GetMapping
    public List<StationResponse> findAll() {
        return stationService.findAll();
    }

    @GetMapping("/{id}")
    public StationResponse findById(@PathVariable Long id) {
        return stationService.findById(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public StationResponse create(@Valid @RequestBody StationRequest request) {
        return stationService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public StationResponse update(@PathVariable Long id, @Valid @RequestBody StationRequest request) {
        return stationService.update(id, request);
    }

    @PutMapping("/{id}/printer")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public StationResponse assignPrinter(@PathVariable Long id, @Valid @RequestBody AssignPrinterRequest request) {
        return stationService.assignPrinter(id, request);
    }
}