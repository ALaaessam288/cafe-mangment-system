package com.example.cafemangmentsystem.discount;

import com.example.cafemangmentsystem.discount.dto.DiscountResponse;
import com.example.cafemangmentsystem.discount.repository.DiscountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiscountService {

    private final DiscountRepository discountRepository;

    public List<DiscountResponse> findAllForOrder(Long orderId) {
        return discountRepository.findAllByOrderId(orderId).stream()
                .map(DiscountResponse::from)
                .toList();
    }
}