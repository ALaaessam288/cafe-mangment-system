package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.order.dto.RefundRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class RefundController {

    private final OrderService orderService;

    @PostMapping("/{id}/refund")
    public OrderResponse refundOrder(@PathVariable Long id, @Valid @RequestBody RefundRequest request, @AuthenticationPrincipal UserPrincipal user) {
        return orderService.refundOrder(id, user.getId(), request.getAmount(), request.getReason(), request.getStockDisposal());
    }
}
