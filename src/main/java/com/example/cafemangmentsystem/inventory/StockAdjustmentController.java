package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.StockAdjustmentRequest;
import com.example.cafemangmentsystem.inventory.dto.StockAdjustmentResponse;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products/{productId}/stock-adjustments")
@RequiredArgsConstructor
public class StockAdjustmentController {

    private final StockAdjustmentService stockAdjustmentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public StockAdjustmentResponse create(@PathVariable Long productId, @AuthenticationPrincipal UserPrincipal principal,
                                           @Valid @RequestBody StockAdjustmentRequest request) {
        return stockAdjustmentService.create(productId, principal.getId(), request);
    }

    @GetMapping
    public List<StockAdjustmentResponse> findAllByProduct(@PathVariable Long productId) {
        return stockAdjustmentService.findAllByProduct(productId);
    }
}