package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.StockAdjustmentRequest;
import com.example.cafemangmentsystem.inventory.dto.StockAdjustmentResponse;
import com.example.cafemangmentsystem.inventory.entity.StockAdjustment;
import com.example.cafemangmentsystem.inventory.entity.StockAdjustmentType;
import com.example.cafemangmentsystem.inventory.repository.StockAdjustmentRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class StockAdjustmentService {

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public StockAdjustmentResponse create(Long productId, Long userId, StockAdjustmentRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + productId));

        if (!product.isTrackInventory()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Product does not track inventory: " + product.getNameAr());
        }
        if (request.quantityChange() == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantityChange must not be zero");
        }
        if (request.type() == StockAdjustmentType.RESTOCK && request.quantityChange() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RESTOCK requires a positive quantityChange");
        }
        if (request.type() == StockAdjustmentType.WASTE && request.quantityChange() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WASTE requires a negative quantityChange");
        }

        int newQuantity = product.getStockQuantity() + request.quantityChange();
        if (newQuantity < 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Adjustment would take stock below zero (current: " + product.getStockQuantity() + ")");
        }

        User adjustedBy = userRepository.findById(userId).orElseThrow();

        product.setStockQuantity(newQuantity);

        StockAdjustment adjustment = new StockAdjustment();
        adjustment.setProduct(product);
        adjustment.setType(request.type());
        adjustment.setQuantityChange(request.quantityChange());
        adjustment.setResultingQuantity(newQuantity);
        adjustment.setReason(request.reason());
        adjustment.setAdjustedBy(adjustedBy);
        adjustment.setAdjustedAt(Instant.now());

        return StockAdjustmentResponse.from(stockAdjustmentRepository.save(adjustment));
    }

    @Transactional(readOnly = true)
    public List<StockAdjustmentResponse> findAllByProduct(Long productId) {
        return stockAdjustmentRepository.findAllByProductIdOrderByAdjustedAtDesc(productId).stream()
                .map(StockAdjustmentResponse::from)
                .toList();
    }
}