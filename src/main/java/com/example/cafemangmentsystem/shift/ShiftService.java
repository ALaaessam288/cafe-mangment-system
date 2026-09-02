package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.debt.entity.Debt;
import com.example.cafemangmentsystem.debt.repository.DebtRepository;
import com.example.cafemangmentsystem.employee.entity.EmployeeTransaction;
import com.example.cafemangmentsystem.employee.entity.EmployeeTransactionType;
import com.example.cafemangmentsystem.employee.repository.EmployeeTransactionRepository;
import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.shift.dto.CloseShiftRequest;
import com.example.cafemangmentsystem.shift.dto.OpenShiftRequest;
import com.example.cafemangmentsystem.shift.dto.ShiftReportResponse;
import com.example.cafemangmentsystem.shift.dto.ShiftResponse;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.EnumSet;

@Service
@RequiredArgsConstructor
@Transactional
public class ShiftService {

    private static final java.util.Set<OrderStatus> UNSETTLED_ORDER_STATUSES = EnumSet.of(
            OrderStatus.OPEN, OrderStatus.SENT, OrderStatus.SERVED, OrderStatus.READY_FOR_PICKUP);

    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final RegisterRepository registerRepository;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final DebtRepository debtRepository;
    private final EmployeeTransactionRepository employeeTransactionRepository;
    private final com.example.cafemangmentsystem.cashmovement.repository.CashMovementRepository cashMovementRepository;

    @Transactional
    public ShiftResponse open(Long userId, OpenShiftRequest request) {
        if (request.openingFloat() != null && request.openingFloat().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "مبلغ العهدة الافتتاحية لا يمكن أن يكون سالباً");
        }

        Long currentTenantId = com.example.cafemangmentsystem.common.tenant.TenantContext.get();
        if (shiftRepository.existsByTenantIdAndUserIdAndClosedAtIsNull(currentTenantId, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "لديك شيفت مفتوح بالفعل حالياً. يرجى إغلاق الشيفت الحالي أولاً.");
        }
        if (shiftRepository.existsByTenantIdAndRegisterIdAndClosedAtIsNull(currentTenantId, request.registerId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "يوجد شيفت مفتوح بالفعل على نقطة البيع (الكاشير) المحددة. يرجى إغلاقه أولاً.");
        }

        Register register = registerRepository.findById(request.registerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "نقطة البيع (الكاشير) غير موجودة: " + request.registerId()));
        if (!register.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "نقطة البيع (الكاشير) غير مفعلة حالياً");
        }
        if (shiftRepository.existsByRegisterIdAndClosedAtIsNull(register.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "يوجد شيفت مفتوح بالفعل لنقطة البيع هذه");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "المستخدم غير موجود: " + userId));

        Shift shift = new Shift();
        shift.setUser(user);
        shift.setRegister(register);
        shift.setOpeningFloat(request.openingFloat() != null ? request.openingFloat() : BigDecimal.ZERO);
        shift.setOpenedAt(Instant.now());

        return ShiftResponse.from(shiftRepository.save(shift));
    }

    @Transactional
    public ShiftResponse close(Long shiftId, Long requestingUserId, CloseShiftRequest request) {
        Shift shift = getOrThrow(shiftId);

        User reqUser = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "المستخدم غير موجود"));

        boolean isAdminOrSupervisor = reqUser.getRole() == com.example.cafemangmentsystem.user.entity.Role.ADMIN ||
                                      reqUser.getRole() == com.example.cafemangmentsystem.user.entity.Role.SUPERVISOR;

        if (!shift.getUser().getId().equals(requestingUserId) && !isAdminOrSupervisor) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "غير مسموح بقفل شيفت مستخدم آخر إلا بصلاحية مدير أو مشرف");
        }

        return closeInternal(shift, request, true);
    }

    @Transactional
    public ShiftResponse forceClose(Long shiftId, CloseShiftRequest request) {
        Shift shift = getOrThrow(shiftId);
        return closeInternal(shift, request, false);
    }

    private ShiftResponse closeInternal(Shift shift, CloseShiftRequest request, boolean requireSettledOrders) {
        if (shift.getClosedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تم إغلاق هذا الشيفت بالفعل سابقاً");
        }

        if (request != null && request.countedCash() != null && request.countedCash().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "مبلغ الكاش الفعلي في الدرج لا يمكن أن يكون سالباً");
        }

        if (requireSettledOrders) {
            List<Order> unsettledOrders = orderRepository.findAllByShiftIdAndStatusIn(shift.getId(), UNSETTLED_ORDER_STATUSES);
            if (unsettledOrders != null && !unsettledOrders.isEmpty()) {
                long tableCount = unsettledOrders.stream().filter(o -> o.getTable() != null).count();
                long takeawayCount = unsettledOrders.size() - tableCount;
                StringBuilder sb = new StringBuilder("لا يمكن إغلاق الشيفت لوجود ");
                sb.append(unsettledOrders.size()).append(" طلب مفتوح أو معلق");
                if (tableCount > 0 && takeawayCount > 0) {
                    sb.append(" (").append(tableCount).append(" طاولة، ").append(takeawayCount).append(" تيك أواي/دليفري)");
                } else if (tableCount > 0) {
                    sb.append(" (").append(tableCount).append(" طاولة صالة)");
                } else if (takeawayCount > 0) {
                    sb.append(" (").append(takeawayCount).append(" تيك أواي/دليفري)");
                }
                sb.append(". يرجى إنهاء حساب جميع الطلبات أو إلغاؤها أولاً قبل قفل الشيفت.");
                throw new ResponseStatusException(HttpStatus.CONFLICT, sb.toString());
            }

            // Check for pending unsettled advances/expenses from drawer
            List<Expense> shiftExpenses = expenseRepository.findAllByShiftId(shift.getId());
            long pendingAdvancesCount = shiftExpenses != null ? shiftExpenses.stream()
                    .filter(e -> e.getStatus() == com.example.cafemangmentsystem.expense.entity.ExpenseStatus.PENDING_SETTLEMENT)
                    .count() : 0;
            if (pendingAdvancesCount > 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "يوجد عدد (" + pendingAdvancesCount + ") عُهدة مؤقتة معلقة بانتظار التسوية في هذا الشيفت. يرجى تسوية العُهد وإرجاع المتبقي للدرج قبل قفل الشيفت.");
            }
        }

        BigDecimal openFloat = shift.getOpeningFloat() != null ? shift.getOpeningFloat() : BigDecimal.ZERO;
        BigDecimal cashCollected = paymentRepository.sumAmountByShiftIdAndMethod(shift.getId(), PaymentMethod.CASH);
        BigDecimal cash = cashCollected != null ? cashCollected : BigDecimal.ZERO;
        BigDecimal drawerExpenses = expenseRepository.sumDrawerAmountByShiftId(shift.getId());
        BigDecimal exp = drawerExpenses != null ? drawerExpenses : BigDecimal.ZERO;

        BigDecimal cashIn = cashMovementRepository != null ?
                cashMovementRepository.sumAmountByShiftIdAndType(shift.getId(), com.example.cafemangmentsystem.cashmovement.entity.CashMovementType.CASH_IN) : BigDecimal.ZERO;
        if (cashIn == null) cashIn = BigDecimal.ZERO;

        BigDecimal safeDrops = cashMovementRepository != null ?
                cashMovementRepository.sumAmountByShiftIdAndType(shift.getId(), com.example.cafemangmentsystem.cashmovement.entity.CashMovementType.SAFE_DROP) : BigDecimal.ZERO;
        if (safeDrops == null) safeDrops = BigDecimal.ZERO;

        BigDecimal cashOut = cashMovementRepository != null ?
                cashMovementRepository.sumAmountByShiftIdAndType(shift.getId(), com.example.cafemangmentsystem.cashmovement.entity.CashMovementType.CASH_OUT) : BigDecimal.ZERO;
        if (cashOut == null) cashOut = BigDecimal.ZERO;

        BigDecimal expected = openFloat.add(cash).add(cashIn).subtract(safeDrops).subtract(cashOut).subtract(exp);
        shift.setExpectedCash(expected);

        BigDecimal counted = request != null && request.countedCash() != null ? request.countedCash() : BigDecimal.ZERO;
        shift.setCountedCash(counted);
        shift.setVariance(counted.subtract(expected));

        if (request != null && request.snacksNet() != null) {
            shift.setSnacksNet(request.snacksNet());
        }
        shift.setClosedAt(Instant.now());

        return ShiftResponse.from(shiftRepository.save(shift));
    }

    @Transactional
    public ShiftResponse setSnacksNet(Long shiftId, BigDecimal amount) {
        Shift shift = getOrThrow(shiftId);
        shift.setSnacksNet(amount != null ? amount : BigDecimal.ZERO);
        return ShiftResponse.from(shiftRepository.save(shift));
    }

    @Transactional(readOnly = true)
    public ShiftResponse findById(Long id) {
        return ShiftResponse.from(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> findAll(boolean openOnly) {
        List<Shift> shifts = openOnly ? shiftRepository.findAllByClosedAtIsNull() : shiftRepository.findAll();
        return shifts.stream().map(ShiftResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> findAllByUserId(Long userId, boolean openOnly) {
        List<Shift> shifts = openOnly ? 
                shiftRepository.findAllByUserIdAndClosedAtIsNull(userId) : 
                shiftRepository.findAllByUserId(userId);
        return shifts.stream().map(ShiftResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<ShiftResponse> findCurrentForUser(Long userId) {
        // A cashier shift is an accountable cash session, not a tenant-wide session. Returning
        // another user's shift here made the POS operate under one cashier and then correctly
        // reject closure by the logged-in cashier. Privileged users can inspect/force-close
        // other shifts through the dedicated endpoints instead.
        return shiftRepository.findByUserIdAndClosedAtIsNull(userId).map(ShiftResponse::from);
    }

    @Transactional(readOnly = true)
    public ShiftReportResponse getShiftReport(Long shiftId) {
        Shift shift = getOrThrow(shiftId);
        ShiftResponse shiftResponse = ShiftResponse.from(shift);

        // 1. Payments
        BigDecimal cash = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.CASH);
        if (cash == null) cash = BigDecimal.ZERO;
        BigDecimal instapay = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.INSTAPAY);
        if (instapay == null) instapay = BigDecimal.ZERO;
        BigDecimal wallet = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.WALLET);
        if (wallet == null) wallet = BigDecimal.ZERO;
        
        BigDecimal totalRevenue = cash.add(instapay).add(wallet);

        // 2. Revenue lines
        BigDecimal foodRevenue = orderItemRepository.sumTotalByShiftIdAndRevenueLine(shiftId, RevenueLine.FOOD);
        if (foodRevenue == null) foodRevenue = BigDecimal.ZERO;
        BigDecimal buffetRevenue = orderItemRepository.sumTotalByShiftIdAndRevenueLine(shiftId, RevenueLine.BUFFET);
        if (buffetRevenue == null) buffetRevenue = BigDecimal.ZERO;
        BigDecimal snacksNet = shift.getSnacksNet() != null ? shift.getSnacksNet() : BigDecimal.ZERO;

        // 3. Orders: Discounts & Service charges
        List<Order> shiftOrders = orderRepository.findAllByShiftId(shiftId);
        BigDecimal totalDiscounts = BigDecimal.ZERO;
        BigDecimal totalService = BigDecimal.ZERO;
        if (shiftOrders != null) {
            for (Order o : shiftOrders) {
                if (o.getStatus() != OrderStatus.VOIDED) {
                    if (o.getDiscount() != null) totalDiscounts = totalDiscounts.add(o.getDiscount());
                    if (o.getService() != null) totalService = totalService.add(o.getService());
                }
            }
        }

        // 4. Expenses
        List<Expense> expensesList = expenseRepository.findAllByShiftId(shiftId);
        BigDecimal totalExpenses = BigDecimal.ZERO;
        List<ShiftReportResponse.ExpenseSummaryItem> expenseItems = new ArrayList<>();
        if (expensesList != null) {
            for (Expense e : expensesList) {
                totalExpenses = totalExpenses.add(e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO);
                expenseItems.add(new ShiftReportResponse.ExpenseSummaryItem(
                        e.getId(),
                        e.getNotes() != null && !e.getNotes().isBlank() ? e.getNotes() : (e.getType() != null ? e.getType().name() : "مصروف"),
                        e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO,
                        e.getType() != null ? e.getType().name() : "عام",
                        e.getExpenseDate() != null ? e.getExpenseDate().toString() : ""
                ));
            }
        }

        // 5. Debts
        List<Debt> debtsList = debtRepository.findAll();
        BigDecimal totalNewDebts = BigDecimal.ZERO;
        BigDecimal totalCollectedDebts = BigDecimal.ZERO;
        if (debtsList != null) {
            Instant start = shift.getOpenedAt();
            Instant end = shift.getClosedAt() != null ? shift.getClosedAt() : Instant.now();
            for (Debt d : debtsList) {
                Instant debtTime = d.getCreatedAt() != null ? d.getCreatedAt() : (d.getDebtDate() != null ? d.getDebtDate().atStartOfDay(ZoneId.systemDefault()).toInstant() : null);
                if (debtTime != null && !debtTime.isBefore(start) && !debtTime.isAfter(end)) {
                    if (d.getAmount() != null) totalNewDebts = totalNewDebts.add(d.getAmount());
                    if (d.getPaidAmount() != null) totalCollectedDebts = totalCollectedDebts.add(d.getPaidAmount());
                }
            }
        }

        // 6. Employee Transactions
        LocalDate shiftDate = shift.getOpenedAt().atZone(ZoneId.systemDefault()).toLocalDate();
        List<EmployeeTransaction> employeeTxs = employeeTransactionRepository.findByTransactionDateBetween(shiftDate, shiftDate);
        BigDecimal totalEmployeeAdvances = BigDecimal.ZERO;
        BigDecimal totalEmployeeDeductions = BigDecimal.ZERO;
        BigDecimal totalEmployeeBonuses = BigDecimal.ZERO;
        List<ShiftReportResponse.EmployeeMovementSummaryItem> employeeMovements = new ArrayList<>();
        if (employeeTxs != null) {
            for (EmployeeTransaction t : employeeTxs) {
                BigDecimal amt = t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO;
                if (t.getType() == EmployeeTransactionType.ADVANCE) {
                    totalEmployeeAdvances = totalEmployeeAdvances.add(amt);
                } else if (t.getType() == EmployeeTransactionType.DEDUCTION) {
                    totalEmployeeDeductions = totalEmployeeDeductions.add(amt);
                } else if (t.getType() == EmployeeTransactionType.BONUS) {
                    totalEmployeeBonuses = totalEmployeeBonuses.add(amt);
                }
                employeeMovements.add(new ShiftReportResponse.EmployeeMovementSummaryItem(
                        t.getId(),
                        t.getEmployee() != null ? t.getEmployee().getName() : "",
                        t.getType().name(),
                        amt,
                        t.getNotes() != null ? t.getNotes() : "",
                        t.getTransactionDate() != null ? t.getTransactionDate().toString() : ""
                ));
            }
        }

        // 7. Product Sales Breakdown Table
        List<OrderItem> activeItems = orderItemRepository.findAllActiveByShiftId(shiftId);
        Map<String, ShiftReportResponse.ProductSalesSummaryItem> productAgg = new LinkedHashMap<>();
        int totalItemsSold = 0;
        if (activeItems != null) {
            for (OrderItem oi : activeItems) {
                String name = oi.getProductNameSnapshot() != null ? oi.getProductNameSnapshot() : "صنف";
                String category = oi.getCategoryNameSnapshot() != null ? oi.getCategoryNameSnapshot() : "عام";
                String revLine = oi.getRevenueLineSnapshot() != null ? oi.getRevenueLineSnapshot().name() : "BUFFET";
                int qty = oi.getQuantity();
                BigDecimal lineTotal = oi.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(qty)).subtract(oi.getDiscountAmount() != null ? oi.getDiscountAmount() : BigDecimal.ZERO);

                totalItemsSold += qty;
                ShiftReportResponse.ProductSalesSummaryItem existing = productAgg.get(name);
                if (existing != null) {
                    productAgg.put(name, new ShiftReportResponse.ProductSalesSummaryItem(
                            name,
                            category,
                            existing.quantitySold() + qty,
                            existing.totalAmount().add(lineTotal),
                            revLine
                    ));
                } else {
                    productAgg.put(name, new ShiftReportResponse.ProductSalesSummaryItem(
                            name,
                            category,
                            qty,
                            lineTotal,
                            revLine
                    ));
                }
            }
        }
        List<ShiftReportResponse.ProductSalesSummaryItem> productSales = new ArrayList<>(productAgg.values());
        productSales.sort((a, b) -> b.quantitySold().compareTo(a.quantitySold()));

        // 8. Expected Cash in Drawer
        BigDecimal opening = shift.getOpeningFloat() != null ? shift.getOpeningFloat() : BigDecimal.ZERO;
        BigDecimal expectedCashInDrawer = opening
                .add(cash)
                .add(totalCollectedDebts)
                .subtract(totalExpenses)
                .subtract(totalEmployeeAdvances);

        return new ShiftReportResponse(
                shiftResponse,
                totalRevenue,
                cash,
                instapay,
                wallet,
                foodRevenue,
                buffetRevenue,
                snacksNet,
                totalDiscounts,
                totalService,
                totalExpenses,
                expenseItems,
                totalNewDebts,
                totalCollectedDebts,
                totalEmployeeAdvances,
                totalEmployeeDeductions,
                totalEmployeeBonuses,
                employeeMovements,
                productSales,
                totalItemsSold,
                expectedCashInDrawer
        );
    }

    Shift getOrThrow(Long id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + id));
    }

    @Transactional
    public void delete(Long shiftId) {
        Shift shift = getOrThrow(shiftId);
        try {
            shiftRepository.delete(shift);
            shiftRepository.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "لا يمكن حذف هذا الشيفت لوجود طلبات أو مصاريف مسجلة عليه.");
        }
    }
}
