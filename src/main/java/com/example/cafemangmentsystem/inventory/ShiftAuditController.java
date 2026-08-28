package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.ProductRecipeDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditItemDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditRecordDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftClosingAuditRequest;
import com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ShiftAuditController {

    private final ShiftAuditService shiftAuditService;

    @GetMapping("/inventory/audit-items")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ShiftAuditItemDto> getAuditItems() {
        return shiftAuditService.getAuditItems();
    }

    @PostMapping("/inventory/audit-items")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public ShiftAuditItemDto saveAuditItem(@Valid @RequestBody ShiftAuditItemDto dto) {
        return shiftAuditService.saveAuditItem(dto);
    }

    @DeleteMapping("/inventory/audit-items/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public void deleteAuditItem(@PathVariable Long id) {
        shiftAuditService.deleteAuditItem(id);
    }

    @GetMapping("/inventory/recipes")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ProductRecipeDto> getAllRecipes() {
        return shiftAuditService.getAllRecipes();
    }

    @GetMapping("/inventory/recipes/{productId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ProductRecipeDto> getProductRecipes(@PathVariable Long productId) {
        return shiftAuditService.getProductRecipes(productId);
    }

    @PostMapping("/inventory/recipes/{productId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public List<ProductRecipeDto> saveProductRecipes(
            @PathVariable Long productId,
            @RequestBody List<ProductRecipeDto> recipeDtos
    ) {
        return shiftAuditService.saveProductRecipes(productId, recipeDtos);
    }

    @PostMapping("/shifts/{shiftId}/opening-audit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ShiftAuditRecordDto> recordShiftOpening(
            @PathVariable Long shiftId,
            @RequestBody ShiftOpeningAuditRequest request
    ) {
        return shiftAuditService.recordShiftOpening(shiftId, request);
    }

    @PostMapping("/shifts/{shiftId}/closing-audit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ShiftAuditRecordDto> recordShiftClosing(
            @PathVariable Long shiftId,
            @RequestBody ShiftClosingAuditRequest request
    ) {
        return shiftAuditService.recordShiftClosing(shiftId, request);
    }

    @GetMapping("/shifts/{shiftId}/audit-records")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CASHIER')")
    public List<ShiftAuditRecordDto> getShiftAuditRecords(@PathVariable Long shiftId) {
        return shiftAuditService.getShiftAuditRecords(shiftId);
    }
}
