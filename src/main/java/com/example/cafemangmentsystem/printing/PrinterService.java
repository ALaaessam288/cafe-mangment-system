package com.example.cafemangmentsystem.printing;

import com.example.cafemangmentsystem.printing.dto.PrinterRequest;
import com.example.cafemangmentsystem.printing.dto.PrinterResponse;
import com.example.cafemangmentsystem.printing.entity.Printer;
import com.example.cafemangmentsystem.printing.repository.PrinterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PrinterService {

    private final PrinterRepository printerRepository;

    public PrinterResponse create(PrinterRequest request) {
        Printer printer = new Printer();
        printer.setName(request.name());
        printer.setIpAddress(request.ipAddress());
        printer.setPort(request.port());
        printer.setType(request.type());
        printer.setPaperWidth(request.paperWidth());

        return PrinterResponse.from(printerRepository.save(printer));
    }

    @Transactional(readOnly = true)
    public List<PrinterResponse> findAll() {
        return printerRepository.findAll().stream().map(PrinterResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PrinterResponse findById(Long id) {
        return PrinterResponse.from(getOrThrow(id));
    }

    public PrinterResponse update(Long id, PrinterRequest request) {
        Printer printer = getOrThrow(id);
        printer.setName(request.name());
        printer.setIpAddress(request.ipAddress());
        printer.setPort(request.port());
        printer.setType(request.type());
        printer.setPaperWidth(request.paperWidth());
        return PrinterResponse.from(printer);
    }

    public PrinterResponse heartbeat(Long id) {
        Printer printer = getOrThrow(id);
        printer.setOnline(true);
        printer.setLastSeenAt(Instant.now());
        return PrinterResponse.from(printer);
    }

    Printer getOrThrow(Long id) {
        return printerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Printer not found: " + id));
    }
}