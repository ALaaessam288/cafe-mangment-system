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

    /**
     * Deletes a product outright. Nothing refuses it any more.
     *
     * <p>The previous version refused when the product had ever been sold, to protect
     * order_items. That protection was aimed at the wrong thing: an order line does not need its
     * product row. It was written with the name, category, unit price, station and revenue line
     * snapshotted at the moment of sale, exactly so that a later rename, reprice or deletion can
     * never rewrite what a customer was charged - and every report reads those snapshots. V11
     * makes the foreign key ON DELETE SET NULL, so the history keeps every figure and simply
     * stops pointing at a menu entry that is gone.
     *
     * <p>What IS lost, and the caller should have been told before pressing the button: the
     * product's stock-adjustment rows go with it (they carry no snapshot, so a movement whose
     * product is gone can say nothing about what moved), along with its options and recipe. The
     * sales history survives; the inventory audit trail for this one product does not. Deactivate
     * remains the choice that loses nothing.
     */
    public void delete(Long id) {
        Product product = getOrThrow(id);

        productOptionRepository.deleteAll(productOptionRepository.findAllByProductId(id));
        productRecipeRepository.deleteAll(productRecipeRepository.findAllByProductId(id));
        productRepository.delete(product);
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
