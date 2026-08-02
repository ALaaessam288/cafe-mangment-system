package com.example.cafemangmentsystem.payment;

import com.example.cafemangmentsystem.order.OrderService;
import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.payment.dto.PaymentResponse;
import com.example.cafemangmentsystem.payment.dto.RecordPaymentRequest;
import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class PaymentService {

    private static final Set<OrderStatus> PAYABLE_STATUSES = EnumSet.of(OrderStatus.OPEN, OrderStatus.SENT);

    private final PaymentRepository paymentRepository;
    private final OrderService orderService;
    private final UserRepository userRepository;

    public OrderResponse record(Long orderId, Long userId, RecordPaymentRequest request) {
        Order order = orderService.getOrThrow(orderId);

        if (!PAYABLE_STATUSES.contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot accept payments");
        }

        BigDecimal amountPaidSoFar = paymentRepository.sumAmountByOrderId(orderId);
        BigDecimal remaining = order.getTotal().subtract(amountPaidSoFar);

        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is already fully paid");
        }
        if (request.amount().compareTo(remaining) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount exceeds remaining balance of " + remaining);
        }

        BigDecimal received = null;
        BigDecimal change = null;
        String reference = null;

        if (request.method() == PaymentMethod.CASH) {
            if (request.received() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "received is required for CASH payments");
            }
            if (request.received().compareTo(request.amount()) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "received cannot be less than amount");
            }
            received = request.received();
            change = received.subtract(request.amount());
        } else {
            reference = request.reference();
        }

        User cashier = userRepository.findById(userId).orElseThrow();

        Payment payment = Payment.builder()
                .order(order)
                .method(request.method())
                .amount(request.amount())
                .received(received)
                .change(change)
                .reference(reference)
                .paidAt(Instant.now())
                .cashier(cashier)
                .build();

        paymentRepository.save(payment);

        BigDecimal newAmountPaid = amountPaidSoFar.add(request.amount());
        if (newAmountPaid.compareTo(order.getTotal()) >= 0) {
            order.setStatus(OrderStatus.PAID);
        }

        return orderService.toResponse(order);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> findAllForOrder(Long orderId) {
        orderService.getOrThrow(orderId);
        return paymentRepository.findAllByOrderId(orderId).stream()
                .map(PaymentResponse::from)
                .toList();
    }
}