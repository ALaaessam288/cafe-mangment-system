package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
import com.example.cafemangmentsystem.discount.dto.ApplyDiscountRequest;
import com.example.cafemangmentsystem.discount.entity.Discount;
import com.example.cafemangmentsystem.discount.entity.DiscountScope;
import com.example.cafemangmentsystem.discount.entity.DiscountType;
import com.example.cafemangmentsystem.discount.repository.DiscountRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.dto.AddOrderItemRequest;
import com.example.cafemangmentsystem.order.dto.CancelOrderItemRequest;
import com.example.cafemangmentsystem.order.dto.OpenOrderRequest;
import com.example.cafemangmentsystem.order.dto.OrderItemResponse;
import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.order.dto.TransferTableRequest;
import com.example.cafemangmentsystem.order.dto.VoidOrderRequest;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderItemStatus;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.entity.OrderType;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.printing.PrintJobService;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {

    private static final Set<OrderStatus> OPEN_STATUSES =
            EnumSet.of(OrderStatus.OPEN, OrderStatus.SENT, OrderStatus.SERVED, OrderStatus.READY_FOR_PICKUP);

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CafeTableRepository cafeTableRepository;
    private final ProductRepository productRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final PrintJobService printJobService;
    private final DiscountRepository discountRepository;
    private final TenantRepository tenantRepository;

    public OrderResponse open(Long userId, OpenOrderRequest request) {
        Shift shift = shiftRepository.findByUserIdAndClosedAtIsNull(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "You must have an open shift to open an order"));

        User openedBy = userRepository.findById(userId).orElseThrow();

        CafeTable table = null;
        if (request.type() == OrderType.DINE_IN) {
            if (request.tableId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dine-in orders require a tableId");
            }
            if (request.customerName() != null || request.customerPhone() != null || request.pickupAt() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dine-in orders must not include takeaway pickup details");
            }
            table = getActiveTableOrThrow(request.tableId());
            if (orderRepository.existsByTableIdAndStatusIn(table.getId(), OPEN_STATUSES)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Table " + table.getNumber() + " already has an open order");
            }
        } else {
            if (request.tableId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Takeaway orders must not have a tableId");
            }
            if (request.customerName() == null || request.customerName().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Takeaway orders require a customerName");
            }
            if (request.pickupAt() != null) {
                Tenant tenant = tenantRepository.findById(TenantContext.get()).orElseThrow();
                if (tenant.getBusinessType() != BusinessType.RESTAURANT && tenant.getBusinessType() != BusinessType.CAFE_AND_RESTAURANT) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scheduled pickup is only available for restaurant tenants");
                }
                if (request.pickupAt().isBefore(Instant.now())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "pickupAt must be in the future");
                }
            }
        }

        Instant startOfToday = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
        int orderNumber = orderRepository.findMaxOrderNumberSince(startOfToday) + 1;

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .table(table)
                .type(request.type())
                .status(OrderStatus.OPEN)
                .openedBy(openedBy)
                .shift(shift)
                .guestCount(request.guestCount())
                .customerName(request.customerName())
                .customerPhone(request.customerPhone())
                .pickupAt(request.pickupAt())
                .openedAt(Instant.now())
                .build();

        return toResponse(orderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> findAll(OrderStatus statusFilter) {
        List<Order> orders = statusFilter == null ? orderRepository.findAll() : orderRepository.findAllByStatus(statusFilter);
        return orders.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse findById(Long id) {
        return toResponse(getOrThrow(id));
    }

    public OrderResponse addItem(Long orderId, Long userId, AddOrderItemRequest request) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product not found: " + request.productId()));

        if (!product.isActive() || !product.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Product is not available: " + product.getNameAr());
        }

        User addedBy = userRepository.findById(userId).orElseThrow();

        OrderItem item = OrderItem.builder()
                .order(order)
                .product(product)
                .productNameSnapshot(product.getNameAr())
                .unitPriceSnapshot(product.getPrice())
                .stationSnapshot(product.getStation().getCode())
                .revenueLineSnapshot(product.getRevenueLine())
                .quantity(request.quantity() == null ? 1 : request.quantity())
                .status(OrderItemStatus.NEW)
                .note(request.note())
                .addedBy(addedBy)
                .build();

        orderItemRepository.save(item);
        recalcTotals(order);

        return toResponse(order);
    }

    public OrderResponse cancelItem(Long orderId, Long itemId, Long userId, CancelOrderItemRequest request) {
        Order order = getOrThrow(orderId);
        OrderItem item = getItemOrThrow(orderId, itemId);

        if (item.getStatus() == OrderItemStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is already cancelled");
        }

        boolean wasSent = item.getStatus() == OrderItemStatus.SENT;
        User cancelledBy = userRepository.findById(userId).orElseThrow();

        item.setStatus(OrderItemStatus.CANCELLED);
        item.setCancelledBy(cancelledBy);
        item.setCancelReason(request.reason());

        recalcTotals(order);

        if (wasSent) {
            printJobService.createCancellationTicket(order, item);
        }

        return toResponse(order);
    }

    public OrderResponse send(Long orderId) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        boolean isFirstSend = order.getStatus() == OrderStatus.OPEN;
        List<OrderItem> itemsToSend = orderItemRepository.findAllByOrderId(orderId).stream()
                .filter(i -> i.getStatus() == OrderItemStatus.NEW)
                .toList();

        order.setStatus(OrderStatus.SENT);
        itemsToSend.forEach(i -> i.setStatus(OrderItemStatus.SENT));

        printJobService.createKitchenTickets(order, itemsToSend, isFirstSend);

        return toResponse(order);
    }

    /**
     * Marks the kitchen work as delivered to the customer - SERVED for dine-in (at the table),
     * READY_FOR_PICKUP for takeaway (waiting at the counter). Only valid straight out of SENT -
     * if items get added afterward and re-sent to the kitchen, {@link #send} moves the order back
     * to SENT, and this has to be called again once the new items are out too.
     */
    public OrderResponse serveOrder(Long orderId, Long userId) {
        Order order = getOrThrow(orderId);

        if (order.getStatus() != OrderStatus.SENT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be marked served");
        }

        User servedBy = userRepository.findById(userId).orElseThrow();

        order.setStatus(order.getType() == OrderType.DINE_IN ? OrderStatus.SERVED : OrderStatus.READY_FOR_PICKUP);
        order.setServedBy(servedBy);
        order.setServedAt(Instant.now());

        return toResponse(order);
    }

    public OrderResponse transferTable(Long orderId, TransferTableRequest request) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        if (order.getType() != OrderType.DINE_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only dine-in orders can be transferred to a table");
        }

        CafeTable target = getActiveTableOrThrow(request.tableId());
        if (orderRepository.existsByTableIdAndStatusIn(target.getId(), OPEN_STATUSES)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Table " + target.getNumber() + " already has an open order");
        }

        order.setTable(target);
        return toResponse(order);
    }

    public OrderResponse voidOrder(Long orderId, Long userId, VoidOrderRequest request) {
        Order order = getOrThrow(orderId);

        if (order.getStatus() == OrderStatus.VOIDED || order.getStatus() == OrderStatus.CLOSED
                || order.getStatus() == OrderStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be voided");
        }

        User closedBy = userRepository.findById(userId).orElseThrow();

        order.setStatus(OrderStatus.VOIDED);
        order.setClosedBy(closedBy);
        order.setClosedAt(Instant.now());
        order.setVoidReason(request.reason());

        return toResponse(order);
    }

    public OrderResponse close(Long orderId, Long userId) {
        Order order = getOrThrow(orderId);

        if (order.getStatus() != OrderStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order must be fully paid before it can be closed (current status: " + order.getStatus() + ")");
        }

        User closedBy = userRepository.findById(userId).orElseThrow();

        order.setStatus(OrderStatus.CLOSED);
        order.setClosedBy(closedBy);
        order.setClosedAt(Instant.now());

        List<OrderItem> items = orderItemRepository.findAllByOrderId(orderId);
        List<Payment> payments = paymentRepository.findAllByOrderId(orderId);
        printJobService.createReceiptTicket(order, items, payments);

        return toResponse(order);
    }

    public OrderResponse applyOrderDiscount(Long orderId, Long userId, ApplyDiscountRequest request) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        BigDecimal remainingBase = order.getSubtotal().subtract(order.getDiscount());
        BigDecimal amount = computeDiscountAmount(request.type(), request.value(), request.maxValue(), remainingBase);

        User appliedBy = userRepository.findById(userId).orElseThrow();

        Discount discount = Discount.builder()
                .order(order)
                .type(request.type())
                .scope(DiscountScope.ORDER)
                .value(request.value())
                .maxValue(request.maxValue())
                .reason(request.reason())
                .amount(amount)
                .appliedBy(appliedBy)
                .appliedAt(Instant.now())
                .build();
        discountRepository.save(discount);

        order.setDiscount(order.getDiscount().add(amount));
        recalcTotals(order);

        return toResponse(order);
    }

    public OrderResponse applyItemDiscount(Long orderId, Long itemId, Long userId, ApplyDiscountRequest request) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);
        OrderItem item = getItemOrThrow(orderId, itemId);

        if (item.getStatus() == OrderItemStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot discount a cancelled item");
        }

        BigDecimal grossLineTotal = item.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(item.getQuantity()));
        BigDecimal remainingBase = grossLineTotal.subtract(item.getDiscountAmount());
        BigDecimal amount = computeDiscountAmount(request.type(), request.value(), request.maxValue(), remainingBase);

        User appliedBy = userRepository.findById(userId).orElseThrow();

        Discount discount = Discount.builder()
                .order(order)
                .item(item)
                .type(request.type())
                .scope(DiscountScope.ITEM)
                .value(request.value())
                .maxValue(request.maxValue())
                .reason(request.reason())
                .amount(amount)
                .appliedBy(appliedBy)
                .appliedAt(Instant.now())
                .build();
        discountRepository.save(discount);

        item.setDiscountAmount(item.getDiscountAmount().add(amount));
        recalcTotals(order);

        return toResponse(order);
    }

    private BigDecimal computeDiscountAmount(DiscountType type, BigDecimal value, BigDecimal maxValue, BigDecimal base) {
        BigDecimal raw = type == DiscountType.PERCENT
                ? base.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : value;

        BigDecimal capped = raw;
        if (maxValue != null) {
            capped = capped.min(maxValue);
        }
        capped = capped.min(base);

        return capped.max(BigDecimal.ZERO);
    }

    private void requireOpenForModification(Order order) {
        if (!OPEN_STATUSES.contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be modified");
        }
    }

    private void recalcTotals(Order order) {
        BigDecimal subtotal = orderItemRepository.findAllByOrderId(order.getId()).stream()
                .filter(i -> i.getStatus() != OrderItemStatus.CANCELLED)
                .map(i -> i.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(i.getQuantity())).subtract(i.getDiscountAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setSubtotal(subtotal);
        order.setTotal(subtotal.subtract(order.getDiscount()).add(order.getService()));
    }

    public OrderResponse toResponse(Order order) {
        List<OrderItemResponse> items = orderItemRepository.findAllByOrderId(order.getId()).stream()
                .map(OrderItemResponse::from)
                .toList();
        BigDecimal amountPaid = paymentRepository.sumAmountByOrderId(order.getId());
        return OrderResponse.from(order, items, amountPaid);
    }

    private CafeTable getActiveTableOrThrow(Long tableId) {
        CafeTable table = cafeTableRepository.findById(tableId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table not found: " + tableId));
        if (!table.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table " + table.getNumber() + " is not active");
        }
        return table;
    }

    private OrderItem getItemOrThrow(Long orderId, Long itemId) {
        OrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order item not found: " + itemId));
        if (!item.getOrder().getId().equals(orderId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order item " + itemId + " does not belong to order " + orderId);
        }
        return item;
    }

    public Order getOrThrow(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found: " + id));
    }
}