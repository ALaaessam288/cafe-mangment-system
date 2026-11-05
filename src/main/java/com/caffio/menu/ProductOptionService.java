package com.caffio.menu;

import com.caffio.menu.dto.ProductOptionRequest;
import com.caffio.menu.dto.ProductOptionResponse;
import com.caffio.menu.entity.Product;
import com.caffio.menu.entity.ProductOption;
import com.caffio.menu.repository.ProductOptionRepository;
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

    /**
     * Every option on the menu, in one read.
     *
     * <p>The POS used to ask for a product's options the first time it was tapped - including the
     * majority of products that have none - so the first tap on almost anything waited on a round
     * trip before the line appeared. Loading them with the menu makes that tap instant. Scoped to
     * the current tenant by the {@code @TenantId} on the entity, like every other read here.
     */
    @Transactional(readOnly = true)
    public List<ProductOptionResponse> findAll() {
        return productOptionRepository.findAll().stream()
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