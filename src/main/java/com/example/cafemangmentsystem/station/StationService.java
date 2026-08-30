package com.example.cafemangmentsystem.station;

import com.example.cafemangmentsystem.printing.entity.Printer;
import com.example.cafemangmentsystem.printing.repository.PrinterRepository;
import com.example.cafemangmentsystem.station.dto.AssignPrinterRequest;
import com.example.cafemangmentsystem.station.dto.StationRequest;
import com.example.cafemangmentsystem.station.dto.StationResponse;
import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class StationService {

    private final StationRepository stationRepository;
    private final PrinterRepository printerRepository;

    public StationResponse create(StationRequest request) {
        if (stationRepository.existsByCode(request.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Station already exists for code: " + request.code());
        }

        Station station = new Station();
        station.setCode(request.code());
        station.setNameAr(request.nameAr());

        return StationResponse.from(stationRepository.save(station));
    }

    @Transactional(readOnly = true)
    public List<StationResponse> findAll() {
        return stationRepository.findAll().stream()
                .map(StationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public StationResponse findById(Long id) {
        return StationResponse.from(getOrThrow(id));
    }

    public StationResponse update(Long id, StationRequest request) {
        Station station = getOrThrow(id);
        station.setCode(request.code());
        station.setNameAr(request.nameAr());
        return StationResponse.from(station);
    }

    public StationResponse assignPrinter(Long id, AssignPrinterRequest request) {
        Station station = getOrThrow(id);
        Printer printer = printerRepository.findById(request.printerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Printer not found: " + request.printerId()));
        station.setPrinter(printer);
        return StationResponse.from(station);
    }

    private Station getOrThrow(Long id) {
        return stationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Station not found: " + id));
    }
}