package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.ProductOptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * All product options at once, for the POS to load alongside the menu.
 *
 * <p>Kept apart from {@link ProductOptionController}, whose routes all hang off one product.
 */
@RestController
@RequestMapping("/api/product-options")
@RequiredArgsConstructor
public class ProductOptionCatalogController {

    private final ProductOptionService productOptionService;

    @GetMapping
    public List<ProductOptionResponse> findAll() {
        return productOptionService.findAll();
    }
}
