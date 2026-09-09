package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementDto;
import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementRequest;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The raw-material stock ledger: what arrived, what was thrown away, and what it cost. */
@RestController
@RequestMapping("/api/inventory/raw-materials")
@RequiredArgsConstructor
public class RawMaterialController {

    private final RawMaterialLedgerService ledgerService;

    /**
     * Records a delivery, a spillage or a correction.
     *
     * <p>Cashiers may record movements — they are the ones who receive a delivery or drop a jug —
     * but every row carries who did it, so the record is attributable rather than anonymous.
     */
    @PostMapping("/movements")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public RawMaterialMovementDto record(@Valid @RequestBody RawMaterialMovementRequest request) {
        return ledgerService.record(request);
    }

    @GetMapping("/{auditItemId}/movements")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<RawMaterialMovementDto> history(@PathVariable Long auditItemId) {
        return ledgerService.historyFor(auditItemId);
    }

    /** The whole ledger, newest first — the view an owner reconciles purchases against. */
    @GetMapping("/movements")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Page<RawMaterialMovementDto> ledger(
            @RequestParam(name = "type", required = false) RawMaterialMovementType type,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size) {
        return ledgerService.ledger(type,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200)));
    }
}
