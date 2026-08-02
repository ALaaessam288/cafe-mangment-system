package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.ProductOptionRequest;
import com.example.cafemangmentsystem.menu.dto.ProductOptionResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/products/{productId}/options")
@RequiredArgsConstructor
public class ProductOptionController {

    private final ProductOptionService productOptionService;

    @GetMapping
    public List<ProductOptionResponse> findAll(@PathVariable Long productId) {
        return productOptionService.findAllForProduct(productId);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOptionResponse create(@PathVariable Long productId, @Valid @RequestBody ProductOptionRequest request) {
        return productOptionService.create(productId, request);
    }

    @PutMapping("/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionResponse update(@PathVariable Long productId, @PathVariable Long optionId,
                                         @Valid @RequestBody ProductOptionRequest request) {
        return productOptionService.update(productId, optionId, request);
    }

    @DeleteMapping("/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long productId, @PathVariable Long optionId) {
        productOptionService.delete(productId, optionId);
    }
}