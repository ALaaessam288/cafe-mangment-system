package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
import com.example.cafemangmentsystem.discount.dto.ApplyDiscountRequest;
import com.example.cafemangmentsystem.discount.entity.Discount;
import com.example.cafemangmentsystem.discount.entity.DiscountScope;
import com.example.cafemangmentsystem.discount.entity.DiscountType;
import com.example.cafemangmentsystem.discount.repository.DiscountRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.entity.ProductOption;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
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
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
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
import lombok.extern.slf4j.Slf4j;
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
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class OrderService {

    private static final Set<OrderStatus> OPEN_STATUSES =
            EnumSet.of(OrderStatus.OPEN, OrderStatus.SENT, OrderStatus.SERVED, OrderStatus.READY_FOR_PICKUP);

    /** Guards daily order-number allocation - see {@link #saveWithNextOrderNumber}. */
    private static final java.util.concurrent.locks.ReentrantLock ORDER_NUMBER_LOCK =
            new java.util.concurrent.locks.ReentrantLock();

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
    private final ProductOptionRepository productOptionRepository;

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
        }
        String effectiveCustomerName = request.customerName();
        if (request.type() != OrderType.DINE_IN) {
            if (request.tableId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Takeaway orders must not have a tableId");
            }
            if (effectiveCustomerName == null || effectiveCustomerName.isBlank()) {
                effectiveCustomerName = "تيك أواي";
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

        Order.OrderBuilder builder = Order.builder()
                .table(table)
                .type(request.type())
                .status(OrderStatus.OPEN)
                .openedBy(openedBy)
                .shift(shift)
                .guestCount(request.guestCount())
                .customerName(effectiveCustomerName)
                .customerPhone(request.customerPhone())
                .customerAddress(request.customerAddress())
                .deliveryFee(request.deliveryFee() != null ? request.deliveryFee() : BigDecimal.ZERO)
                .pickupAt(request.pickupAt())
                .openedAt(Instant.now());

        return toResponse(saveWithNextOrderNumber(builder));
    }

    /**
     * Allocates the next daily order number and persists the order under a lock.
     * <p>
     * The number is what staff and customers use to identify a ticket, and it was previously
     * derived by a bare {@code MAX(order_number) + 1} read followed by an unrelated insert. Two
     * terminals opening an order in the same moment both read the same maximum and both wrote the
     * same number, so the kitchen received two different tickets calling themselves "#42".
     * <p>
     * Serialising allocation and insert closes that window for the single-backend deployment this
     * app ships as today (one Spring Boot process per site, which the Electron launcher enforces
     * with a single-instance lock). It is deliberately not sufficient for several backends sharing
     * one database - that arrangement needs a unique index on
     * {@code (tenant_id, business_day, order_number)} plus retry on constraint violation, which in
     * turn needs a real migration tool rather than {@code ddl-auto=update}.
     */
    private Order saveWithNextOrderNumber(Order.OrderBuilder builder) {
        ORDER_NUMBER_LOCK.lock();
        try {
            int orderNumber = orderRepository.findMaxOrderNumberSince(startOfBusinessDay()) + 1;
            Order order = builder.orderNumber(orderNumber).build();
            Order saved = orderRepository.save(order);
            // Force the insert while the lock is still held; without this Hibernate could defer it
            // past the unlock and let a second caller read a stale maximum.
            orderRepository.flush();
            return saved;
        } finally {
            ORDER_NUMBER_LOCK.unlock();
        }
    }

    /**
     * Midnight local time. Cafés that trade past midnight will want this shifted to the shift's
     * own opening time so a 1am order continues the previous evening's numbering rather than
     * restarting at 1 - that needs a per-tenant "day starts at" setting, which does not exist yet.
     */
    private Instant startOfBusinessDay() {
        return LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
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

        int quantity = request.quantity() == null ? 1 : request.quantity();

        User addedBy = userRepository.findById(userId).orElseThrow();

        BigDecimal unitPrice = product.getPrice();
        String productName = product.getNameAr();

        if (request.optionIds() != null && !request.optionIds().isEmpty()) {
            List<ProductOption> options = productOptionRepository.findAllById(request.optionIds());
            if (!options.isEmpty()) {
                StringBuilder sb = new StringBuilder(productName);
                sb.append(" (");
                for (int i = 0; i < options.size(); i++) {
                    ProductOption opt = options.get(i);
                    unitPrice = unitPrice.add(opt.getPriceDelta());
                    sb.append(opt.getNameAr());
                    if (i < options.size() - 1) {
                        sb.append(" + ");
                    }
                }
                sb.append(")");
                productName = sb.toString();
            }
        }
        final BigDecimal finalUnitPrice = unitPrice;
        final String finalProductName = productName;
        final String finalNote = request.note();

        List<OrderItem> currentItems = orderItemRepository.findByOrderId(order.getId());
        Optional<OrderItem> existingNewItem = currentItems.stream()
                .filter(i -> i.getStatus() == OrderItemStatus.NEW
                        && i.getProduct() != null
                        && Objects.equals(i.getProduct().getId(), product.getId())
                        && (i.getUnitPriceSnapshot() != null && i.getUnitPriceSnapshot().compareTo(finalUnitPrice) == 0)
                        && Objects.equals(i.getProductNameSnapshot(), finalProductName)
                        && (Objects.equals(i.getNote(), finalNote) || (i.getNote() == null && (finalNote == null || finalNote.isBlank()))))
                .findFirst();

        if (existingNewItem.isPresent()) {
            OrderItem existing = existingNewItem.get();
            existing.setQuantity(existing.getQuantity() + quantity);
            orderItemRepository.save(existing);
        } else {
            OrderItem item = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .productNameSnapshot(productName)
                    .categoryNameSnapshot(product.getCategory() != null ? product.getCategory().getNameAr() : null)
                    .unitPriceSnapshot(unitPrice)
                    .stationSnapshot(product.getStation().getCode())
                    .revenueLineSnapshot(product.getRevenueLine())
                    .quantity(quantity)
                    .status(OrderItemStatus.NEW)
                    .note(request.note())
                    .addedBy(addedBy)
                    .build();

            orderItemRepository.save(item);
        }
        recalcTotals(order);

        return toResponse(order);
    }

    public OrderResponse cancelItem(Long orderId, Long itemId, Long userId, CancelOrderItemRequest request) {
        Order order = getOrThrow(orderId);
        // Previously missing. Without it an item could be cancelled on a PAID or CLOSED order,
        // and the recalcTotals below would drop the order total beneath what the customer had
        // already handed over - with no refund row to explain the gap, so the shift's cash
        // reconciliation silently went out by that amount. Corrections after payment must go
        // through refundOrder instead.
        requireOpenForModification(order);

        OrderItem item = getItemOrThrow(orderId, itemId);

        if (item.getStatus() == OrderItemStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is already cancelled");
        }

        boolean wasSent = item.getStatus() == OrderItemStatus.SENT;
        User cancelledBy = userRepository.findById(userId).orElseThrow();

        item.setStatus(OrderItemStatus.CANCELLED);
        item.setCancelledBy(cancelledBy);
        item.setCancelReason(request.reason());

        // Stock is only deducted when an item is SENT to the kitchen, so it is only owed back
        // when a SENT item is cancelled.
        if (wasSent) {
            releaseStock(item);
        }

        recalcTotals(order);

        if (wasSent) {
            printJobService.createCancellationTicket(order, item);
        }

        return toResponse(order);
    }

    /**
     * Deletes a line the kitchen has never seen.
     * <p>
     * Distinct from {@link #cancelItem} on purpose. Cancelling is an audited event: it leaves a
     * CANCELLED row with a reason and a name attached, prints a cancellation slip, and shows up in
     * the void/discount report that owners use to spot theft. All of that is correct once the
     * kitchen has started cooking - and completely wrong for a cashier who tapped the wrong button
     * two seconds ago and has not sent anything yet. Treating both the same way meant ordinary
     * typos accumulated in a report meant for suspicious activity, and cashiers learned to be slow
     * and nervous rather than risk "a cancellation" on their name.
     * <p>
     * Only NEW items qualify. Anything already SENT must go through {@link #cancelItem}.
     */
    public OrderResponse removeUnsentItem(Long orderId, Long itemId) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        OrderItem item = getItemOrThrow(orderId, itemId);

        if (item.getStatus() != OrderItemStatus.NEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only items that have not been sent to the kitchen can be removed - cancel it instead");
        }

        // Any item-level discount rows point at this line by foreign key, so they go first.
        List<Discount> itemDiscounts = discountRepository.findAllByItemId(itemId);
        if (!itemDiscounts.isEmpty()) {
            discountRepository.deleteAll(itemDiscounts);
        }

        // No stock to give back: stock is deducted at send() time, and this item never got there.
        orderItemRepository.delete(item);
        orderItemRepository.flush();

        recalcTotals(order);

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

        for (OrderItem item : itemsToSend) {
            consumeStock(item);
        }

        printJobService.createKitchenTickets(order, itemsToSend, isFirstSend);

        return toResponse(order);
    }

    /** Deducts an item's quantity from stock when it is sent to the kitchen. */
    private void consumeStock(OrderItem item) {
        Product product = item.getProduct();
        if (product == null || !product.isTrackInventory()) {
            return;
        }
        product.setStockQuantity(product.getStockQuantity() - item.getQuantity());
        if (product.getStockQuantity() <= 0) {
            product.setAvailable(false);
            log.warn("Product {} stock dropped to 0 or below. Marked as unavailable.", product.getNameAr());
        }
        productRepository.save(product);
    }

    /**
     * Returns an item's quantity to stock. The counterpart to {@link #consumeStock} - without it
     * stock only ever moved downwards: cancelling, voiding or refunding never gave anything back,
     * so tracked products drifted to zero, auto-flipped to unavailable, and staff stopped
     * believing the inventory numbers within a week of going live.
     * <p>
     * Restoring stock above zero also clears the auto-set unavailable flag, but only that one -
     * a product a manager deliberately deactivated stays deactivated.
     */
    private void releaseStock(OrderItem item) {
        Product product = item.getProduct();
        if (product == null || !product.isTrackInventory()) {
            return;
        }
        product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
        if (product.getStockQuantity() > 0 && product.isActive() && !product.isAvailable()) {
            product.setAvailable(true);
        }
        productRepository.save(product);
    }

    /** Returns stock for every item on an order that had already been sent to the kitchen. */
    private void releaseStockForOrder(Order order) {
        orderItemRepository.findAllByOrderId(order.getId()).stream()
                .filter(i -> i.getStatus() == OrderItemStatus.SENT)
                .forEach(this::releaseStock);
    }

    /**
     * Marks the kitchen work as delivered to the customer - SERVED for dine-in (at the table),
     * READY_FOR_PICKUP for takeaway (waiting at the counter). Only valid straight out of SENT -
     * if items get added afterward and re-sent to the kitchen, {@link #send} moves the order back
     * to SENT, and this has to be called again once the new items are out too.
     */
    public OrderResponse serveOrder(Long orderId, Long userId) {
        Order order = getOrThrow(orderId);

        // PAID is accepted alongside SENT: a takeaway customer who pays at the counter before the
        // kitchen finishes moves to PAID, and requiring exactly SENT meant that order could never
        // be marked served or ready for pickup at all.
        if (order.getStatus() != OrderStatus.SENT && order.getStatus() != OrderStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be marked served");
        }

        User servedBy = userRepository.findById(userId).orElseThrow();

        // Only move the status when the order has not been paid yet. Overwriting PAID with SERVED
        // would strand the order: close() requires PAID, so it could never be closed or receipted.
        // Recording who served it and when is still correct in both cases.
        if (order.getStatus() == OrderStatus.SENT) {
            order.setStatus(order.getType() == OrderType.DINE_IN ? OrderStatus.SERVED : OrderStatus.READY_FOR_PICKUP);
        }
        order.setServedBy(servedBy);
        order.setServedAt(Instant.now());

        return toResponse(order);
    }

    public OrderResponse transferTable(Long orderId, TransferTableRequest request) {
        Order sourceOrder = getOrThrow(orderId);
        requireOpenForModification(sourceOrder);

        if (sourceOrder.getType() != OrderType.DINE_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only dine-in orders can be transferred to a table");
        }

        CafeTable target = getActiveTableOrThrow(request.tableId());

        if (target.getId().equals(sourceOrder.getTable() != null ? sourceOrder.getTable().getId() : null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order is already on table " + target.getNumber());
        }

        // One indexed query replaces what used to be up to three full-table scans stitched
        // together with nested if/else. OPEN_STATUSES already enumerates every status that counts
        // as "this table is occupied", including READY_FOR_PICKUP, which the old chain missed.
        List<Order> ordersOnTarget = orderRepository.findByTableIdAndStatusIn(target.getId(), OPEN_STATUSES);

        if (!ordersOnTarget.isEmpty()) {
            if (!request.merge()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Table " + target.getNumber() + " already has an open order. Use merge flag to merge them.");
            }

            Order targetOrder = ordersOnTarget.get(0);

            // Move all non-cancelled items to target order
            List<OrderItem> sourceItems = orderItemRepository.findAllByOrderId(sourceOrder.getId());
            for (OrderItem item : sourceItems) {
                if (item.getStatus() != OrderItemStatus.CANCELLED) {
                    item.setOrder(targetOrder);
                    orderItemRepository.save(item);
                }
            }
            
            recalcTotals(targetOrder);
            
            // Void the source order
            sourceOrder.setStatus(OrderStatus.VOIDED);
            sourceOrder.setVoidReason("تم دمجه مع طاولة " + target.getNumber());
            orderRepository.save(sourceOrder);
            
            return toResponse(targetOrder);
        }

        // Just move the table
        sourceOrder.setTable(target);
        return toResponse(orderRepository.save(sourceOrder));
    }

    public OrderResponse voidOrder(Long orderId, Long userId, VoidOrderRequest request) {
        Order order = getOrThrow(orderId);

        if (order.getStatus() == OrderStatus.VOIDED || order.getStatus() == OrderStatus.CLOSED
                || order.getStatus() == OrderStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be voided");
        }

        User closedBy = userRepository.findById(userId).orElseThrow();

        // Nothing on a voided order was ever served, so anything already deducted for the
        // kitchen goes back on the shelf.
        releaseStockForOrder(order);

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

    public OrderResponse setDeliveryFee(Long orderId, BigDecimal amount) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        if (amount == null || amount.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delivery fee must be zero or positive");
        }

        order.setDeliveryFee(amount);
        recalcTotals(order);

        return toResponse(order);
    }

    public OrderResponse setServiceFee(Long orderId, BigDecimal amount) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        if (amount == null || amount.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service fee must be zero or positive");
        }

        order.setService(amount);
        BigDecimal subtotal = order.getSubtotal();
        order.setTotal(subtotal.subtract(order.getDiscount()).add(order.getService()).add(order.getDeliveryFee()));

        return toResponse(order);
    }

    public OrderResponse clearOrderDiscounts(Long orderId) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        List<Discount> orderDiscounts = discountRepository.findAllByOrderId(orderId);
        if (!orderDiscounts.isEmpty()) {
            discountRepository.deleteAll(orderDiscounts);
        }

        order.setDiscount(BigDecimal.ZERO);
        recalcTotals(order);
        return toResponse(order);
    }

    public OrderResponse applyOrderDiscount(Long orderId, Long userId, ApplyDiscountRequest request) {
        Order order = getOrThrow(orderId);
        requireOpenForModification(order);

        // Clean replacement for existing order-level discounts
        List<Discount> existingOrderDiscounts = discountRepository.findAllByOrderId(orderId).stream()
                .filter(d -> d.getScope() == DiscountScope.ORDER)
                .toList();
        if (!existingOrderDiscounts.isEmpty()) {
            discountRepository.deleteAll(existingOrderDiscounts);
            order.setDiscount(BigDecimal.ZERO);
        }

        BigDecimal base = order.getSubtotal();
        BigDecimal amount = computeDiscountAmount(request.type(), request.value(), request.maxValue(), base);

        User appliedBy = userId != null ? userRepository.findById(userId).orElse(null) : null;

        Discount discount = Discount.builder()
                .order(order)
                .type(request.type())
                .scope(DiscountScope.ORDER)
                .value(request.value())
                .maxValue(request.maxValue())
                .reason(request.reason() != null && !request.reason().isBlank() ? request.reason() : "خصم يدوي")
                .amount(amount)
                .appliedBy(appliedBy)
                .appliedAt(Instant.now())
                .build();
        discountRepository.save(discount);

        order.setDiscount(amount);
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

        // Service charge is dine-in only. The explicit else matters: without it a non-dine-in
        // order kept whatever was already in the field, which is only harmless today because
        // service defaults to ZERO and order type is immutable.
        if (order.getType() == OrderType.DINE_IN) {
            Tenant tenant = tenantRepository.findById(TenantContext.get()).orElse(null);
            if (tenant != null && tenant.getServiceChargePercent() != null && tenant.getServiceChargePercent() > 0) {
                BigDecimal service = subtotal.multiply(BigDecimal.valueOf(tenant.getServiceChargePercent()))
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                order.setService(service);
            } else {
                order.setService(BigDecimal.ZERO);
            }
        } else {
            order.setService(BigDecimal.ZERO);
        }

        order.setTotal(subtotal.subtract(order.getDiscount()).add(order.getService()).add(order.getDeliveryFee()));
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

    public OrderResponse updateItemQuantity(Long orderId, Long itemId, int newQuantity) {
        Order order = getOrThrow(orderId);
        if (order.getStatus() != OrderStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is " + order.getStatus() + " and cannot be modified");
        }
        OrderItem item = getItemOrThrow(orderId, itemId);
        if (item.getStatus() != OrderItemStatus.NEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is " + item.getStatus() + " and cannot be modified");
        }
        // Was unvalidated: zero produced a free line and a negative quantity produced a negative
        // line total, which recalcTotals happily subtracted from the bill.
        if (newQuantity < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Quantity must be at least 1 - cancel the item instead of setting it to zero");
        }

        item.setQuantity(newQuantity);
        orderItemRepository.save(item);
        recalcTotals(order);
        
        return toResponse(order);
    }

    public Order getOrThrow(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found: " + id));
    }

    public OrderResponse refundOrder(Long orderId, Long userId, BigDecimal amount, String reason) {
        Order order = getOrThrow(orderId);
        if (order.getStatus() != OrderStatus.PAID && order.getStatus() != OrderStatus.CLOSED && order.getStatus() != OrderStatus.REFUNDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order must be PAID or CLOSED to be refunded");
        }

        BigDecimal amountPaid = paymentRepository.sumAmountByOrderId(orderId);
        if (amountPaid == null) amountPaid = BigDecimal.ZERO;
        
        // Sum negative payments (refunds)
        List<Payment> payments = paymentRepository.findAllByOrderId(orderId);
        BigDecimal amountRefunded = payments.stream()
            .filter(p -> p.getAmount() != null && p.getAmount().compareTo(BigDecimal.ZERO) < 0)
            .map(p -> p.getAmount().abs())
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal maxRefundable = amountPaid.subtract(amountRefunded);
        if (maxRefundable.compareTo(BigDecimal.ZERO) <= 0) {
            if (order.getTotal() != null && order.getTotal().compareTo(BigDecimal.ZERO) > 0 && amountPaid.compareTo(BigDecimal.ZERO) == 0) {
                maxRefundable = order.getTotal();
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "لا توجد مبالغ قابلة للإرجاع لهذه الفاتورة");
            }
        }

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            amount = maxRefundable;
        }

        if (amount.compareTo(maxRefundable) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "مبلغ الإرجاع يتجاوز المبلغ المتاح للإرجاع");
        }

        User cashier = userId != null ? userRepository.findById(userId).orElse(null) : null;

        // Refund against the method the customer actually paid with. Hardcoding CASH here meant
        // a card refund was booked as cash leaving the drawer, so every refunded card sale showed
        // up as a shortfall at close of shift.
        PaymentMethod refundMethod = originalPaymentMethod(payments);

        Payment refundPayment = Payment.builder()
                .order(order)
                .method(refundMethod)
                .amount(amount.negate())
                .received(BigDecimal.ZERO)
                .change(BigDecimal.ZERO)
                .reference("REFUND: " + (reason != null ? reason : "إرجاع فاتورة"))
                .paidAt(Instant.now())
                .cashier(cashier)
                .build();
        paymentRepository.save(refundPayment);

        if (amountRefunded.add(amount).compareTo(amountPaid.max(maxRefundable)) >= 0) {
            // A fully refunded order was never consumed, so return whatever it took out of stock.
            releaseStockForOrder(order);
            order.setStatus(OrderStatus.REFUNDED);
            orderRepository.save(order);
        }

        return toResponse(order);
    }

    /**
     * The method to refund on. Picks the largest single original (positive) payment, which is the
     * right answer for the overwhelmingly common single-tender sale and a defensible one for a
     * split tender. Falls back to CASH only when there is no payment history to go on.
     */
    private PaymentMethod originalPaymentMethod(List<Payment> payments) {
        return payments.stream()
                .filter(p -> p.getAmount() != null && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .max(java.util.Comparator.comparing(Payment::getAmount))
                .map(Payment::getMethod)
                .orElse(PaymentMethod.CASH);
    }
}