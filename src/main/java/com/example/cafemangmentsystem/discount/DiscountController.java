package com.example.cafemangmentsystem.discount;

import com.example.cafemangmentsystem.discount.dto.ApplyDiscountRequest;
import com.example.cafemangmentsystem.discount.dto.DiscountResponse;
import com.example.cafemangmentsystem.order.OrderService;
import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders/{orderId}")
@RequiredArgsConstructor
public class DiscountController {

    private final OrderService orderService;
    private final DiscountService discountService;

    @PostMapping("/discounts")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse applyOrderDiscount(@PathVariable Long orderId, @AuthenticationPrincipal UserPrincipal principal,
                                             @Valid @RequestBody ApplyDiscountRequest request) {
        return orderService.applyOrderDiscount(orderId, principal.getId(), request);
    }

    @PostMapping("/items/{itemId}/discounts")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse applyItemDiscount(@PathVariable Long orderId, @PathVariable Long itemId,
                                            @AuthenticationPrincipal UserPrincipal principal,
                                            @Valid @RequestBody ApplyDiscountRequest request) {
        return orderService.applyItemDiscount(orderId, itemId, principal.getId(), request);
    }

    @GetMapping("/discounts")
    public List<DiscountResponse> findAllForOrder(@PathVariable Long orderId) {
        return discountService.findAllForOrder(orderId);
    }
}