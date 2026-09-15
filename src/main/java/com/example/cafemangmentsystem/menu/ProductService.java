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
    private final com.example.cafemangmentsystem.order.repository.OrderItemRepository orderItemRepository;
    private final com.example.cafemangmentsystem.inventory.repository.StockAdjustmentRepository stockAdjustmentRepository;

    /**
     * Deletes a product outright, or refuses and says why.
     *
     * <p>This used to try the delete and, on any exception, quietly deactivate instead - reporting
     * success either way. Two things wrong with that. The owner pressed "delete", was told it was
     * done, and then found the product still sitting in the list; and the rescue could not work
     * anyway, because a constraint violation inside a transaction marks it rollback-only, so the
     * save() that followed was doomed and the whole call ended as a 500.
     *
     * <p>So it asks first. order_items and stock_adjustments both point at products with no
     * cascade - deliberately: a sold item's line must keep resolving, and a stock movement that
     * forgot its product is not an audit trail. If either exists, deleting is genuinely the wrong
     * operation and the caller is told to deactivate, which hides the product everywhere while
     * leaving the history intact.
     */
    public void delete(Long id) {
        Product product = getOrThrow(id);

        if (orderItemRepository.existsByProductId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "الصنف ده اتباع قبل كده، فمينفعش يتمسح - تاريخ الأوردرات محتاجه. "
                    + "عطّله بدل ما تمسحه وهيختفي من الكاشير.");
        }
        if (stockAdjustmentRepository.existsByProductId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "الصنف ده عليه حركات مخزون مسجلة، فمينفعش يتمسح. "
                    + "عطّله بدل ما تمسحه وهيختفي من الكاشير.");
        }

        // These two DO cascade, but deleting them here keeps the order explicit rather than
        // relying on a schema detail that a future migration could quietly change.
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
