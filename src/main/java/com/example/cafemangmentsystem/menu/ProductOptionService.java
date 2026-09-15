package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.ProductOptionRequest;
import com.example.cafemangmentsystem.menu.dto.ProductOptionResponse;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.entity.ProductOption;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductOptionService {

    private final ProductOptionRepository productOptionRepository;
    private final ProductService productService;

    public ProductOptionResponse create(Long productId, ProductOptionRequest request) {
        Product product = productService.getOrThrow(productId);

        ProductOption option = new ProductOption();
        option.setProduct(product);
        option.setNameAr(request.nameAr());
        option.setPriceDelta(request.priceDelta());
        option.setDefault(request.isDefault());
        option.setOptionGroup(normaliseGroup(request.optionGroup()));

        return ProductOptionResponse.from(productOptionRepository.save(option));
    }

    @Transactional(readOnly = true)
    public List<ProductOptionResponse> findAllForProduct(Long productId) {
        productService.getOrThrow(productId);
        return productOptionRepository.findAllByProductId(productId).stream()
                .map(ProductOptionResponse::from)
                .toList();
    }

    public ProductOptionResponse update(Long productId, Long optionId, ProductOptionRequest request) {
        ProductOption option = getOrThrow(productId, optionId);
        option.setNameAr(request.nameAr());
        option.setPriceDelta(request.priceDelta());
        option.setDefault(request.isDefault());
        option.setOptionGroup(normaliseGroup(request.optionGroup()));
        return ProductOptionResponse.from(option);
    }

    public void delete(Long productId, Long optionId) {
        ProductOption option = getOrThrow(productId, optionId);
        productOptionRepository.delete(option);
    }

    /**
     * An unrecognised or absent group becomes ADDON rather than being rejected.
     *
     * <p>A bad group name is a cosmetic problem - the option shows under extras instead of under
     * sizes - and refusing to save a menu item over it would be a much worse outcome than putting
     * it in the obvious bucket.
     */
    private String normaliseGroup(String requested) {
        if (requested == null || requested.isBlank()) return "ADDON";
        String upper = requested.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (upper) {
            case "SIZE", "SUGAR", "SPICE", "ADDON" -> upper;
            default -> "ADDON";
        };
    }

    private ProductOption getOrThrow(Long productId, Long optionId) {
        ProductOption option = productOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product option not found: " + optionId));

        if (!option.getProduct().getId().equals(productId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Product option " + optionId + " does not belong to product " + productId);
        }

        return option;
    }
}