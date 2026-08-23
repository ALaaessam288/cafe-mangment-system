package com.example.cafemangmentsystem.cafetable;

import com.example.cafemangmentsystem.cafetable.dto.CafeTableRequest;
import com.example.cafemangmentsystem.cafetable.dto.CafeTableResponse;
import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
import com.example.cafemangmentsystem.tenant.QuotaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CafeTableService {

    private final CafeTableRepository cafeTableRepository;
    private final QuotaService quotaService;

    public CafeTableResponse create(CafeTableRequest request) {
        if (cafeTableRepository.existsByNumber(request.number())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Table already exists for number: " + request.number());
        }
        
        quotaService.checkTableQuota(cafeTableRepository.count());

        CafeTable table = CafeTable.builder()
                .number(request.number())
                .zone(request.zone())
                .seats(request.seats())
                .build();

        return CafeTableResponse.from(cafeTableRepository.save(table));
    }

    @Transactional(readOnly = true)
    public List<CafeTableResponse> findAll() {
        return cafeTableRepository.findAll().stream()
                .map(CafeTableResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CafeTableResponse findById(Long id) {
        return CafeTableResponse.from(getOrThrow(id));
    }

    public CafeTableResponse update(Long id, CafeTableRequest request) {
        CafeTable table = getOrThrow(id);
        table.setNumber(request.number());
        table.setZone(request.zone());
        table.setSeats(request.seats());
        return CafeTableResponse.from(table);
    }

    public CafeTableResponse deactivate(Long id, Long deactivatedByUserId) {
        CafeTable table = getOrThrow(id);
        table.deactivate(deactivatedByUserId);
        return CafeTableResponse.from(table);
    }

    public CafeTableResponse activate(Long id) {
        CafeTable table = getOrThrow(id);
        table.activate();
        return CafeTableResponse.from(table);
    }

    private CafeTable getOrThrow(Long id) {
        return cafeTableRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found: " + id));
    }
}