package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.ProductRecipeDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditItemDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditRecordDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftClosingAuditRequest;
import com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest;
import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditRecordRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class ShiftAuditService {

    /** Safety ceiling for a single cafe stock count (for example, one metric ton in grams). */
    public static final double MAX_AUDIT_QUANTITY = 1_000_000.0;

    private final ShiftAuditItemRepository shiftAuditItemRepository;
    private final ProductRecipeRepository productRecipeRepository;
    private final ShiftAuditRecordRepository shiftAuditRecordRepository;
    private final ProductRepository productRepository;
    private final ShiftRepository shiftRepository;
    private final RawMaterialLedgerService rawMaterialLedgerService;

    public List<ShiftAuditItemDto> getAuditItems() {
        List<ShiftAuditItem> list = shiftAuditItemRepository.findAllByActiveTrue();
        if (list.isEmpty()) {
            ShiftAuditItem coffee = new ShiftAuditItem();
            coffee.setName("بن قهوة (جرام)");
            coffee.setUnit("جرام");
            coffee.setStockQuantity(1000.0);
            coffee.setMinThreshold(200.0);
            coffee.setRequiresAudit(true);
            coffee.setActive(true);

            ShiftAuditItem milk = new ShiftAuditItem();
            milk.setName("حليب / لبن (لتر)");
            milk.setUnit("لتر");
            milk.setStockQuantity(10.0);
            milk.setMinThreshold(2.0);
            milk.setRequiresAudit(true);
            milk.setActive(true);

            ShiftAuditItem cups = new ShiftAuditItem();
            cups.setName("أكواب ورقية (قطعة)");
            cups.setUnit("قطعة");
            cups.setStockQuantity(200.0);
            cups.setMinThreshold(20.0);
            cups.setRequiresAudit(true);
            cups.setActive(true);

            list = shiftAuditItemRepository.saveAll(List.of(coffee, milk, cups));
        }
        ensureDefaultCoffeeRecipes();
        return list.stream().map(ShiftAuditItemDto::from).toList();
    }

    /**
     * Repairs the standard Wanas Turkish-coffee recipes for existing tenants. These two menu
     * products are recipe-controlled raw-material products, never direct piece-stock products.
     */
    public void ensureDefaultCoffeeRecipes() {
        ShiftAuditItem coffeeBeans = shiftAuditItemRepository.findAllByActiveTrue().stream()
                .filter(item -> "بن قهوة (جرام)".equals(item.getName()))
                .findFirst()
                .orElse(null);
        if (coffeeBeans == null) return;

        Map<String, Double> defaults = Map.of(
                "قهوة تركية سادة", 10.0,
                "قهوة تركية دبل", 20.0);

        for (Product product : productRepository.findAll()) {
            Double gramsPerCup = defaults.get(product.getNameAr());
            if (gramsPerCup == null) continue;

            if (productRecipeRepository.findAllByProductId(product.getId()).isEmpty()) {
                ProductRecipe recipe = new ProductRecipe();
                recipe.setProduct(product);
                recipe.setAuditItem(coffeeBeans);
                recipe.setDeductionQuantity(gramsPerCup);
                productRecipeRepository.save(recipe);
            }

            // A recipe product is controlled by its ingredients. Keeping direct piece tracking
            // enabled at the same time creates a second, contradictory stock number in the POS.
            if (product.isTrackInventory() || product.getReservedQuantity() != 0) {
                product.setTrackInventory(false);
                product.setReservedQuantity(0);
                productRepository.save(product);
            }
        }
    }

    public ShiftAuditItemDto saveAuditItem(ShiftAuditItemDto dto) {
        ShiftAuditItem item;
        if (dto.id() != null) {
            item = shiftAuditItemRepository.findById(dto.id())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found: " + dto.id()));
            item.setName(dto.name());
            item.setUnit(dto.unit());
            if (dto.stockQuantity() != null) item.setStockQuantity(dto.stockQuantity());
            if (dto.minThreshold() != null) item.setMinThreshold(dto.minThreshold());
            if (dto.costPerUnit() != null) item.setCostPerUnit(dto.costPerUnit());
            item.setRequiresAudit(dto.requiresAudit());
            item.setActive(dto.active());
        } else {
            item = new ShiftAuditItem();
            item.setName(dto.name());
            item.setUnit(dto.unit());
            item.setStockQuantity(dto.stockQuantity() != null ? dto.stockQuantity() : 0.0);
            item.setMinThreshold(dto.minThreshold() != null ? dto.minThreshold() : 0.0);
            item.setCostPerUnit(dto.costPerUnit() != null ? dto.costPerUnit() : 0.0);
            item.setRequiresAudit(dto.requiresAudit());
            item.setActive(true);
        }
        return ShiftAuditItemDto.from(shiftAuditItemRepository.save(item));
    }

    public void deleteAuditItem(Long id) {
        ShiftAuditItem item = shiftAuditItemRepository.findById(id).orElse(null);
        if (item != null) {
            item.setActive(false);
            shiftAuditItemRepository.save(item);
        }
    }

    @Transactional(readOnly = true)
    public List<ProductRecipeDto> getAllRecipes() {
        return productRecipeRepository.findAll().stream()
                .map(ProductRecipeDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductRecipeDto> getProductRecipes(Long productId) {
        return productRecipeRepository.findAllByProductId(productId).stream()
                .map(ProductRecipeDto::from)
                .toList();
    }

    public List<ProductRecipeDto> saveProductRecipes(Long productId, List<ProductRecipeDto> recipeDtos) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + productId));

        productRecipeRepository.deleteAllByProductId(productId);

        List<ProductRecipe> savedList = new ArrayList<>();
        if (recipeDtos != null) {
            for (ProductRecipeDto dto : recipeDtos) {
                if (dto.auditItemId() == null || dto.deductionQuantity() == null || dto.deductionQuantity() <= 0) {
                    continue;
                }
                ShiftAuditItem auditItem = shiftAuditItemRepository.findById(dto.auditItemId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit item not found: " + dto.auditItemId()));

                ProductRecipe recipe = new ProductRecipe();
                recipe.setProduct(product);
                recipe.setAuditItem(auditItem);
                recipe.setDeductionQuantity(dto.deductionQuantity());

                savedList.add(productRecipeRepository.save(recipe));
            }
        }
        return savedList.stream().map(ProductRecipeDto::from).toList();
    }

    public List<ShiftAuditRecordDto> recordShiftOpening(Long shiftId, ShiftOpeningAuditRequest request) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + shiftId));

        /*
         * One opening audit per shift. Nothing stopped this being posted twice - a double-tap, a
         * retried request - and each call appended a fresh set of records. Closing then iterated
         * every record for the shift, so each duplicate wrote the stock again and the variance
         * report showed each ingredient two or three times.
         */
        if (!shiftAuditRecordRepository.findAllByShiftId(shiftId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "جرد بداية الشيفت متسجل بالفعل لهذه الوردية");
        }

        Map<Long, Double> openingCounts = request.openingCounts();
        List<ShiftAuditRecord> savedRecords = new ArrayList<>();

        List<ShiftAuditItem> activeAuditItems = shiftAuditItemRepository.findAllByActiveTrueAndRequiresAuditTrue();
        for (ShiftAuditItem item : activeAuditItems) {
            Double openingVal = openingCounts != null && openingCounts.containsKey(item.getId())
                    ? openingCounts.get(item.getId())
                    : item.getStockQuantity();

            validateAuditQuantity(openingVal, item);

            /* The count goes through the ledger, so an opening that disagrees with the books leaves
               a row saying by how much instead of silently overwriting the balance. */
            rawMaterialLedgerService.recordAuditCount(item, openingVal,
                    RawMaterialMovementType.AUDIT_OPENING, shiftId, "جرد بداية الوردية");
            item.setStockQuantity(openingVal);
            shiftAuditItemRepository.save(item);

            ShiftAuditRecord record = new ShiftAuditRecord();
            record.setShift(shift);
            record.setAuditItem(item);
            record.setOpeningCount(openingVal);
            record.setSoldDeductionCount(0.0);
            record.setAuditedAt(Instant.now());

            savedRecords.add(shiftAuditRecordRepository.save(record));
        }

        return savedRecords.stream().map(ShiftAuditRecordDto::from).toList();
    }

    public List<ShiftAuditRecordDto> recordShiftClosing(Long shiftId, ShiftClosingAuditRequest request) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + shiftId));

        Map<Long, Double> closingCounts = request.closingCounts();
        List<ShiftAuditRecord> existingRecords = shiftAuditRecordRepository.findAllByShiftId(shiftId);

        List<ShiftAuditRecordDto> result = new ArrayList<>();

        for (ShiftAuditRecord record : existingRecords) {
            ShiftAuditItem item = record.getAuditItem();
            /*
             * An ingredient the client did not send is one nobody counted - not one that was
             * counted as empty. Defaulting to 0.0 recorded the whole opening quantity as variance
             * AND wrote the stock down to zero, so an item deactivated or hidden between the two
             * audits had its real stock silently destroyed. Skip it instead and leave both the
             * record and the stock alone; a missing count is a gap in the audit, not a loss.
             */
            if (closingCounts == null || !closingCounts.containsKey(item.getId())) {
                continue;
            }
            Double actualClosing = closingCounts.get(item.getId());

            validateAuditQuantity(actualClosing, item);

            Double expectedClosing = Math.max(0.0, record.getOpeningCount() - record.getSoldDeductionCount());
            Double variance = expectedClosing - actualClosing; // Positive means deficit/waste
            Double wastePct = expectedClosing > 0 ? (variance / expectedClosing) * 100.0 : 0.0;

            record.setExpectedClosingCount(expectedClosing);
            record.setActualClosingCount(actualClosing);
            record.setVarianceCount(variance);
            record.setWastePercentage(Math.max(0.0, wastePct));
            record.setAuditedAt(Instant.now());

            /* Same for the closing count: the gap between expected and counted is the shift's
               unexplained loss, and it now has a row and a money value rather than living only in
               the variance column of one report. */
            rawMaterialLedgerService.recordAuditCount(item, actualClosing,
                    RawMaterialMovementType.AUDIT_CLOSING, shiftId, "جرد نهاية الوردية");
            item.setStockQuantity(actualClosing);
            shiftAuditItemRepository.save(item);

            result.add(ShiftAuditRecordDto.from(shiftAuditRecordRepository.save(record)));
        }

        return result;
    }

    private void validateAuditQuantity(Double quantity, ShiftAuditItem item) {
        if (quantity == null || !Double.isFinite(quantity) || quantity < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid stock quantity for " + item.getName());
        }
        if (quantity > MAX_AUDIT_QUANTITY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Stock quantity for " + item.getName() + " cannot exceed "
                            + (long) MAX_AUDIT_QUANTITY + " " + item.getUnit());
        }
    }

    @Transactional(readOnly = true)
    public List<ShiftAuditRecordDto> getShiftAuditRecords(Long shiftId) {
        return shiftAuditRecordRepository.findAllByShiftId(shiftId).stream()
                .map(ShiftAuditRecordDto::from)
                .toList();
    }

    private final com.example.cafemangmentsystem.order.repository.OrderItemRepository orderItemRepository;

    /**
     * How many more of this product the ingredients can still produce.
     *
     * <p>The hold for unsent tickets is subtracted <em>per ingredient</em>, not per product. The
     * previous version subtracted only this product's own NEW quantity, so with one tin of beans
     * behind both the espresso and the latte, ten pending espressos were invisible when the
     * question was asked about lattes: 250 g at 20 g a cup reported twelve lattes still available
     * when fifty grams remained, and the order was accepted. Ingredients are what run out.
     */
    private RecipeAvailability calculateRecipeAvailability(Product product) {
        List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(product.getId());
        if (recipes.isEmpty()) return null;
        return availabilityFrom(product, recipes, reservedByIngredient());
    }

    /** Ingredient id to the quantity already committed by NEW tickets across every product. */
    private Map<Long, Double> reservedByIngredient() {
        Map<Long, Double> reserved = new HashMap<>();
        for (Object[] row : productRecipeRepository.sumReservedByIngredient()) {
            if (row == null || row.length < 2 || row[0] == null) continue;
            reserved.put(((Number) row[0]).longValue(),
                    row[1] == null ? 0.0 : ((Number) row[1]).doubleValue());
        }
        return reserved;
    }

    private RecipeAvailability availabilityFrom(Product product, List<ProductRecipe> recipes,
                                                Map<Long, Double> reserved) {
        long producible = Long.MAX_VALUE;
        String limitingIngredient = null;

        for (ProductRecipe recipe : recipes) {
            double perUnit = recipe.getDeductionQuantity();
            if (!Double.isFinite(perUnit) || perUnit <= 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Invalid recipe quantity for " + product.getNameAr());
            }
            ShiftAuditItem ingredient = recipe.getAuditItem();
            double stock = ingredient.getStockQuantity() == null ? 0.0 : ingredient.getStockQuantity();
            double held = ingredient.getId() == null ? 0.0 : reserved.getOrDefault(ingredient.getId(), 0.0);
            double free = Math.max(0.0, stock - held);

            long ingredientCapacity = Math.max(0L, (long) Math.floor((free + 0.000001) / perUnit));
            if (ingredientCapacity < producible) {
                producible = ingredientCapacity;
                limitingIngredient = ingredient.getName();
            }
        }

        return new RecipeAvailability(Math.max(0L, producible), limitingIngredient);
    }

    @Transactional(readOnly = true)
    public Integer getRecipeAvailableQuantity(Product product) {
        if (product == null) return null;
        RecipeAvailability availability = calculateRecipeAvailability(product);
        if (availability == null) return null;
        return (int) Math.min(Integer.MAX_VALUE, availability.availableToAdd());
    }

    public record PrimaryIngredientInfo(
            Long id,
            String name,
            String unit,
            Double stockQuantity,
            Double deductionQuantity
    ) {}

    @Transactional(readOnly = true)
    public PrimaryIngredientInfo getPrimaryIngredientInfo(Product product) {
        if (product == null) return null;
        List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(product.getId());
        if (recipes.isEmpty()) return null;
        ProductRecipe primary = recipes.get(0);
        ShiftAuditItem item = primary.getAuditItem();
        if (item == null) return null;
        return new PrimaryIngredientInfo(
                item.getId(),
                item.getName(),
                item.getUnit(),
                item.getStockQuantity() != null ? item.getStockQuantity() : 0.0,
                primary.getDeductionQuantity()
        );
    }

    @Transactional(readOnly = true)
    public Map<Long, PrimaryIngredientInfo> getPrimaryIngredientsMap(List<Product> products) {
        Map<Long, PrimaryIngredientInfo> map = new HashMap<>();
        if (products == null) return map;
        for (Product product : products) {
            PrimaryIngredientInfo info = getPrimaryIngredientInfo(product);
            if (info != null) {
                map.put(product.getId(), info);
            }
        }
        return map;
    }

    public boolean replenishRecipeStock(Product product, Integer pieceQuantity, Double rawQuantity) {
        if (product == null) return false;
        List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(product.getId());
        if (recipes.isEmpty()) return false;

        /*
         * A raw quantity ("I bought 250 g") only names one thing, so it can only be applied to a
         * recipe with one ingredient. Applied to a latte it used to add 250 to the beans AND 250
         * to the milk - inventing stock that was never bought. Restocking a shared ingredient
         * belongs on the ingredient itself, not on one of the drinks that consume it.
         */
        if (rawQuantity != null && rawQuantity > 0 && recipes.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "\"" + product.getNameAr() + "\" مكوّن من أكثر من خامة. حدّد الكمية بعدد الوحدات، "
                            + "أو زوّد رصيد الخامة نفسها من شاشة المخزون.");
        }

        for (ProductRecipe recipe : recipes) {
            ShiftAuditItem ingredient = recipe.getAuditItem();
            if (ingredient == null) continue;

            double addAmount = 0.0;
            if (rawQuantity != null && rawQuantity > 0) {
                addAmount = rawQuantity;
            } else if (pieceQuantity != null && pieceQuantity > 0) {
                addAmount = pieceQuantity * recipe.getDeductionQuantity();
            }

            if (addAmount > 0) {
                double current = ingredient.getStockQuantity() != null ? ingredient.getStockQuantity() : 0.0;
                ingredient.setStockQuantity(current + addAmount);
                shiftAuditItemRepository.save(ingredient);
            }
        }
        return true;
    }

    @Transactional(readOnly = true)
    public Map<Long, Integer> getRecipeAvailableQuantities(List<Product> products) {
        Map<Long, Integer> result = new HashMap<>();
        if (products == null || products.isEmpty()) return result;

        // One reservation query for the whole menu, not one per product.
        Map<Long, Double> reserved = reservedByIngredient();
        for (Product product : products) {
            if (product == null) continue;
            List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(product.getId());
            if (recipes.isEmpty()) continue;
            RecipeAvailability availability = availabilityFrom(product, recipes, reserved);
            result.put(product.getId(), (int) Math.min(Integer.MAX_VALUE, availability.availableToAdd()));
        }
        return result;
    }

    /** Validates the producible menu quantity from recipe stock, including NEW ticket holds. */
    public void validateRecipeAvailability(Product product, int additionalQuantity) {
        if (product == null || additionalQuantity < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be at least 1");
        }

        RecipeAvailability availability = calculateRecipeAvailability(product);
        if (availability == null) return;

        if (additionalQuantity > availability.availableToAdd()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only " + availability.availableToAdd() + " unit(s) of " + product.getNameAr()
                            + " can be added with the available " + availability.limitingIngredient());
        }
    }

    private record RecipeAvailability(long availableToAdd, String limitingIngredient) {}

    public void deductRecipeInventoryOnItems(Order order, List<OrderItem> items) {
        if (order == null || items == null || items.isEmpty()) return;

        Long shiftId = order.getShift() != null ? order.getShift().getId() : null;
        List<ShiftAuditRecord> shiftRecords = shiftId != null ? shiftAuditRecordRepository.findAllByShiftId(shiftId) : List.of();

        for (OrderItem item : items) {
            if (item.getProduct() == null || item.getStatus() == com.example.cafemangmentsystem.order.entity.OrderItemStatus.CANCELLED) continue;

            List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(item.getProduct().getId());
            for (ProductRecipe recipe : recipes) {
                ShiftAuditItem auditItem = recipe.getAuditItem();
                double totalDeducted = recipe.getDeductionQuantity() * item.getQuantity();

                if (auditItem.getStockQuantity() + 0.000001 < totalDeducted) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Insufficient ingredient stock: " + auditItem.getName());
                }

                // Never clamp an insufficient deduction to zero: doing so hides the shortage and
                // makes the inventory ledger impossible to reconcile.
                double newStock = auditItem.getStockQuantity() - totalDeducted;
                auditItem.setStockQuantity(newStock);
                shiftAuditItemRepository.save(auditItem);

                // Update shift audit record sold deduction count if present
                if (!shiftRecords.isEmpty()) {
                    for (ShiftAuditRecord record : shiftRecords) {
                        if (record.getAuditItem().getId().equals(auditItem.getId())) {
                            record.setSoldDeductionCount(record.getSoldDeductionCount() + totalDeducted);
                            shiftAuditRecordRepository.save(record);
                        }
                    }
                }
            }
        }
    }

    public void restoreRecipeInventoryForItem(Order order, OrderItem item) {
        if (order == null || item == null || item.getProduct() == null) return;
        restoreRecipeInventory(order, List.of(item));
    }

    public void restoreRecipeInventoryForOrder(Order order) {
        if (order == null) return;
        List<OrderItem> sentItems = orderItemRepository.findAllByOrderId(order.getId()).stream()
                .filter(item -> item.getStatus() == com.example.cafemangmentsystem.order.entity.OrderItemStatus.SENT)
                .toList();
        restoreRecipeInventory(order, sentItems);
    }

    private void restoreRecipeInventory(Order order, List<OrderItem> items) {
        if (items == null || items.isEmpty()) return;
        Long shiftId = order.getShift() != null ? order.getShift().getId() : null;
        List<ShiftAuditRecord> shiftRecords = shiftId != null
                ? shiftAuditRecordRepository.findAllByShiftId(shiftId)
                : List.of();

        for (OrderItem item : items) {
            if (item.getProduct() == null) continue;
            for (ProductRecipe recipe : productRecipeRepository.findAllByProductId(item.getProduct().getId())) {
                ShiftAuditItem auditItem = recipe.getAuditItem();
                double quantity = recipe.getDeductionQuantity() * item.getQuantity();
                auditItem.setStockQuantity(auditItem.getStockQuantity() + quantity);
                shiftAuditItemRepository.save(auditItem);
                shiftRecords.stream()
                        .filter(record -> record.getAuditItem().getId().equals(auditItem.getId()))
                        .forEach(record -> {
                            record.setSoldDeductionCount(Math.max(0.0, record.getSoldDeductionCount() - quantity));
                            shiftAuditRecordRepository.save(record);
                        });
            }
        }
    }
}
