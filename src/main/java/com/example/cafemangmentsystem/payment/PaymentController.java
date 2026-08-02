package com.example.cafemangmentsystem.payment;

import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.payment.dto.PaymentResponse;
import com.example.cafemangmentsystem.payment.dto.RecordPaymentRequest;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/orders/{orderId}/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse record(@PathVariable Long orderId, @AuthenticationPrincipal UserPrincipal principal,
                                 @Valid @RequestBody RecordPaymentRequest request) {
        return paymentService.record(orderId, principal.getId(), request);
    }

    @GetMapping
    public List<PaymentResponse> findAll(@PathVariable Long orderId) {
        return paymentService.findAllForOrder(orderId);
    }
}