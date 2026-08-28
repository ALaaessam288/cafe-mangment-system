package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.ProductRecipeDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditItemDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftAuditRecordDto;
import com.example.cafemangmentsystem.inventory.dto.ShiftClosingAuditRequest;
import com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest;
import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
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
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class ShiftAuditService {

    private final ShiftAuditItemRepository shiftAuditItemRepository;
    private final ProductRecipeRepository productRecipeRepository;
    private final ShiftAuditRecordRepository shiftAuditRecordRepository;
    private final ProductRepository productRepository;
    private final ShiftRepository shiftRepository;

    public List<ShiftAuditItemDto> getAuditItems() {
        List<ShiftAuditItem> list = shiftAuditItemRepository.findAllByActiveTrue();
        if (list.isEmpty()) {
            ShiftAuditItem coffee = ShiftAuditItem.builder()
                    .name("بن قهوة (جرام)")
                    .unit("جرام")
                    .stockQuantity(1000.0)
                    .minThreshold(200.0)
                    .requiresAudit(true)
                    .active(true)
                    .build();
            ShiftAuditItem milk = ShiftAuditItem.builder()
                    .name("حليب / لبن (لتر)")
                    .unit("لتر")
                    .stockQuantity(10.0)
                    .minThreshold(2.0)
                    .requiresAudit(true)
                    .active(true)
                    .build();
            ShiftAuditItem cups = ShiftAuditItem.builder()
                    .name("أكواب ورقية (قطعة)")
                    .unit("قطعة")
                    .stockQuantity(200.0)
                    .minThreshold(20.0)
                    .requiresAudit(true)
                    .active(true)
                    .build();
            list = shiftAuditItemRepository.saveAll(List.of(coffee, milk, cups));
        }
        return list.stream().map(ShiftAuditItemDto::from).toList();
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
            item.setRequiresAudit(dto.requiresAudit());
            item.setActive(dto.active());
        } else {
            item = ShiftAuditItem.builder()
                    .name(dto.name())
                    .unit(dto.unit())
                    .stockQuantity(dto.stockQuantity() != null ? dto.stockQuantity() : 0.0)
                    .minThreshold(dto.minThreshold() != null ? dto.minThreshold() : 0.0)
                    .requiresAudit(dto.requiresAudit())
                    .active(true)
                    .build();
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

                ProductRecipe recipe = ProductRecipe.builder()
                        .product(product)
                        .auditItem(auditItem)
                        .deductionQuantity(dto.deductionQuantity())
                        .build();

                savedList.add(productRecipeRepository.save(recipe));
            }
        }
        return savedList.stream().map(ProductRecipeDto::from).toList();
    }

    public List<ShiftAuditRecordDto> recordShiftOpening(Long shiftId, ShiftOpeningAuditRequest request) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + shiftId));

        Map<Long, Double> openingCounts = request.openingCounts();
        List<ShiftAuditRecord> savedRecords = new ArrayList<>();

        List<ShiftAuditItem> activeAuditItems = shiftAuditItemRepository.findAllByActiveTrueAndRequiresAuditTrue();
        for (ShiftAuditItem item : activeAuditItems) {
            Double openingVal = openingCounts != null && openingCounts.containsKey(item.getId())
                    ? openingCounts.get(item.getId())
                    : item.getStockQuantity();

            // Update item stock to opening count
            item.setStockQuantity(openingVal);
            shiftAuditItemRepository.save(item);

            ShiftAuditRecord record = ShiftAuditRecord.builder()
                    .shift(shift)
                    .auditItem(item)
                    .openingCount(openingVal)
                    .soldDeductionCount(0.0)
                    .auditedAt(Instant.now())
                    .build();

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
            Double actualClosing = closingCounts != null && closingCounts.containsKey(item.getId())
                    ? closingCounts.get(item.getId())
                    : 0.0;

            Double expectedClosing = Math.max(0.0, record.getOpeningCount() - record.getSoldDeductionCount());
            Double variance = expectedClosing - actualClosing; // Positive means deficit/waste
            Double wastePct = expectedClosing > 0 ? (variance / expectedClosing) * 100.0 : 0.0;

            record.setExpectedClosingCount(expectedClosing);
            record.setActualClosingCount(actualClosing);
            record.setVarianceCount(variance);
            record.setWastePercentage(Math.max(0.0, wastePct));
            record.setAuditedAt(Instant.now());

            // Update item remaining stock
            item.setStockQuantity(actualClosing);
            shiftAuditItemRepository.save(item);

            result.add(ShiftAuditRecordDto.from(shiftAuditRecordRepository.save(record)));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<ShiftAuditRecordDto> getShiftAuditRecords(Long shiftId) {
        return shiftAuditRecordRepository.findAllByShiftId(shiftId).stream()
                .map(ShiftAuditRecordDto::from)
                .toList();
    }

    private final com.example.cafemangmentsystem.order.repository.OrderItemRepository orderItemRepository;

    public void deductRecipeInventoryOnOrder(Order order) {
        if (order == null) return;

        List<OrderItem> items = orderItemRepository.findAllByOrderId(order.getId());
        if (items.isEmpty()) return;

        Long shiftId = order.getShift() != null ? order.getShift().getId() : null;
        List<ShiftAuditRecord> shiftRecords = shiftId != null ? shiftAuditRecordRepository.findAllByShiftId(shiftId) : List.of();

        for (OrderItem item : items) {
            if (item.getProduct() == null) continue;

            List<ProductRecipe> recipes = productRecipeRepository.findAllByProductId(item.getProduct().getId());
            for (ProductRecipe recipe : recipes) {
                ShiftAuditItem auditItem = recipe.getAuditItem();
                double totalDeducted = recipe.getDeductionQuantity() * item.getQuantity();

                // Deduct stock quantity
                double newStock = Math.max(0.0, auditItem.getStockQuantity() - totalDeducted);
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
}
