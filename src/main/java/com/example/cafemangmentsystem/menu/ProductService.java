package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.ProductRequest;
import com.example.cafemangmentsystem.menu.dto.ProductResponse;
import com.example.cafemangmentsystem.menu.entity.Category;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import com.example.cafemangmentsystem.billing.QuotaService;
import com.example.cafemangmentsystem.inventory.ShiftAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StationRepository stationRepository;
    private final QuotaService quotaService;
    private final ShiftAuditService shiftAuditService;
    private final com.example.cafemangmentsystem.menu.repository.ProductOptionRepository productOptionRepository;
    private final com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository productRecipeRepository;

    public void delete(Long id) {
        Product product = getOrThrow(id);
        try {
            productOptionRepository.deleteAll(productOptionRepository.findAllByProductId(id));
        } catch (Exception ignored) {}
        try {
            productRecipeRepository.deleteAll(productRecipeRepository.findAllByProductId(id));
        } catch (Exception ignored) {}
        try {
            productRepository.delete(product);
        } catch (Exception e) {
            product.deactivate(null);
            productRepository.save(product);
        }
    }

    public ProductResponse create(ProductRequest request) {
        quotaService.checkProducts(productRepository::count);
        
        Product product = new Product();
        product.setCategory(getCategoryOrThrow(request.categoryId()));
        product.setStation(getStationOrThrow(request.stationId()));
        product.setRevenueLine(request.revenueLine());
        product.setNameAr(request.nameAr());
        product.setNameEn(request.nameEn());
        product.setPrice(request.price());
        product.setPrepNote(request.prepNote());
        product.setTrackInventory(request.trackInventory() != null && request.trackInventory());
        product.setMinStockThreshold(request.minStockThreshold());

        return toResponse(productRepository.save(product));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> findAll(Long categoryId) {
        List<Product> products = categoryId == null
                ? productRepository.findAll()
                : productRepository.findAllByCategoryId(categoryId);
        return toResponses(products);
    }
    
    @Transactional(readOnly = true)
    public List<ProductResponse> getTopSellers(int limit) {
        return toResponses(productRepository.findTopSellers(org.springframework.data.domain.PageRequest.of(0, limit)));
    }

    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        Product product = getOrThrow(id);
        return toResponse(product);
    }

    public ProductResponse update(Long id, ProductRequest request) {
        Product product = getOrThrow(id);
        product.setCategory(getCategoryOrThrow(request.categoryId()));
        product.setStation(getStationOrThrow(request.stationId()));
        product.setRevenueLine(request.revenueLine());
        product.setNameAr(request.nameAr());
        product.setNameEn(request.nameEn());
        product.setPrice(request.price());
        product.setPrepNote(request.prepNote());
        product.setTrackInventory(request.trackInventory() != null && request.trackInventory());
        product.setMinStockThreshold(request.minStockThreshold());
        return toResponse(product);
    }

    public ProductResponse setAvailability(Long id, boolean available) {
        Product product = getOrThrow(id);
        product.setAvailable(available);
        return toResponse(product);
    }

    public ProductResponse deactivate(Long id, Long deactivatedByUserId) {
        Product product = getOrThrow(id);
        product.deactivate(deactivatedByUserId);
        return toResponse(product);
    }

    public ProductResponse activate(Long id) {
        Product product = getOrThrow(id);
        product.activate();
        return toResponse(product);
    }

    public ProductResponse addStock(Long id, Integer quantity, Double rawQuantity) {
        Product product = getOrThrow(id);
        boolean isRecipe = shiftAuditService.replenishRecipeStock(product, quantity, rawQuantity);
        if (!isRecipe) {
            int qtyToAdd = quantity != null ? quantity : (rawQuantity != null ? (int) Math.round(rawQuantity) : 0);
            product.setStockQuantity(product.getStockQuantity() + qtyToAdd);
            product.setTrackInventory(true);
        }
        product.setAvailable(true);
        Product saved = productRepository.save(product);
        return toResponse(saved);
    }

    Product getOrThrow(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }

    private List<ProductResponse> toResponses(List<Product> products) {
        Map<Long, Integer> recipeAvailability = shiftAuditService.getRecipeAvailableQuantities(products);
        Map<Long, com.example.cafemangmentsystem.inventory.ShiftAuditService.PrimaryIngredientInfo> ingredientsMap =
                shiftAuditService.getPrimaryIngredientsMap(products);
        return products.stream()
                .map(product -> ProductResponse.from(
                        product,
                        recipeAvailability.get(product.getId()),
                        ingredientsMap.get(product.getId())
                ))
                .toList();
    }

    private ProductResponse toResponse(Product product) {
        return ProductResponse.from(
                product,
                shiftAuditService.getRecipeAvailableQuantity(product),
                shiftAuditService.getPrimaryIngredientInfo(product)
        );
    }

    private Category getCategoryOrThrow(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found: " + categoryId));
    }

    private Station getStationOrThrow(Long stationId) {
        return stationRepository.findById(stationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Station not found: " + stationId));
    }
}
