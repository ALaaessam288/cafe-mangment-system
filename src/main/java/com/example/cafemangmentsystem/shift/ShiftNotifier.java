package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.common.whatsapp.WhatsAppService;
import com.example.cafemangmentsystem.shift.dto.ShiftReportResponse;
import com.example.cafemangmentsystem.shift.event.ShiftEvents;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Tells the owner, on WhatsApp, when a shift opens and when it closes.
 *
 * <p>Listens {@link TransactionPhase#AFTER_COMMIT}. That is the whole reason this is an event
 * listener rather than two calls inside {@code ShiftService}: a message saying "the shift is open"
 * must not be sent for a transaction that then rolls back. Telling an owner their drawer is short
 * when the close never happened is worse than telling them nothing.
 *
 * <p>It also keeps the gateway out of the cash path. {@code ShiftService} is long and transactional;
 * a slow or failing HTTP call has no business inside it.
 */
@Component
@RequiredArgsConstructor
public class ShiftNotifier {

    private static final Logger log = LoggerFactory.getLogger(ShiftNotifier.class);

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final ZoneId CAIRO = ZoneId.of("Africa/Cairo");

    private final TenantRepository tenantRepository;
    private final WhatsAppService whatsAppService;
    private final ShiftService shiftService;

    /** Used to link the owner to the full report. Left blank, the message simply omits the line. */
    @Value("${app.public-url:}")
    private String publicUrl;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onShiftOpened(ShiftEvents.ShiftOpened event) {
        send(event.tenantId(), "%s فتح شيفت على %s دلوقتي، والعهدة في الدرج %s. ☕"
                .formatted(event.cashierName(), event.registerName(), money(event.openingFloat())));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onShiftClosed(ShiftEvents.ShiftClosed event) {
        send(event.tenantId(), buildCloseMessage(event));
    }

    /**
     * Writes the close-up the way a supervisor would text it, not the way a system would print it.
     *
     * <p>The first version of this was headed sections separated by box-drawing rules, every figure
     * on its own labelled line. It was complete and nobody would read it: it announced itself as
     * machine output, so the owner skims for the variance and ignores the rest — which defeats the
     * point of sending the rest.
     *
     * <p>So: sentences, numbers inside them, and nothing said at all about a part of the shift where
     * nothing happened. An empty section is silence here, never a row of zeros.
     */
    private String buildCloseMessage(ShiftEvents.ShiftClosed event) {
        StringBuilder body = new StringBuilder();

        body.append("قفلنا الشيفت 🌙\n\n")
            .append(event.cashierName()).append(" كان على ").append(event.registerName())
            .append("، من ").append(time(event.openedAt()))
            .append(" لحد ").append(time(event.closedAt()))
            .append(" (").append(duration(event)).append(").");

        ShiftReportResponse report = null;
        Long previous = TenantContext.get();
        try {
            TenantContext.set(event.tenantId());
            report = shiftService.getShiftReport(event.shiftId());
        } catch (RuntimeException failure) {
            // A report that cannot be built must not cost the owner the cash summary as well.
            log.warn("Could not build the full report for shift {}", event.shiftId(), failure);
        } finally {
            if (previous != null) TenantContext.set(previous); else TenantContext.clear();
        }

        if (report != null) {
            appendSales(body, report);
            appendExpenses(body, report);
            appendEmployeeMovements(body, report);
            appendDebts(body, report);
            appendStations(body, report);
            appendTopProducts(body, report);
        }

        appendDrawer(body, event);

        if (publicUrl != null && !publicUrl.isBlank()) {
            body.append("\n\nالتفاصيل كلها هنا:\n")
                .append(publicUrl.replaceAll("/+$", "")).append("/shifts/").append(event.shiftId());
        }

        return body.toString();
    }

    private void appendSales(StringBuilder body, ShiftReportResponse report) {
        body.append("\n\nبعنا ").append(money(report.totalRevenue()));

        // Only name the methods that were actually used - listing a zero for a wallet nobody paid
        // with is noise dressed as completeness.
        List<String> methods = new ArrayList<>();
        if (isPositive(report.totalCash())) methods.add(money(report.totalCash()) + " كاش");
        if (isPositive(report.totalInstapay())) methods.add(money(report.totalInstapay()) + " انستاباي");
        if (isPositive(report.totalWallet())) methods.add(money(report.totalWallet()) + " محفظة");
        if (methods.size() > 1) {
            body.append(" — ").append(String.join(" و", methods));
        }

        if (report.totalItemsSold() != null && report.totalItemsSold() > 0) {
            body.append("، ").append(report.totalItemsSold()).append(" صنف");
        }
        body.append(".");

        if (isPositive(report.totalDiscounts())) {
            body.append(" وفيه خصومات بـ").append(money(report.totalDiscounts())).append(".");
        }
    }

    private void appendExpenses(StringBuilder body, ShiftReportResponse report) {
        if (!isPositive(report.totalExpenses())) return;

        body.append("\n\nصرفنا ").append(money(report.totalExpenses()));
        if (!isEmpty(report.expenses())) {
            body.append(": ").append(report.expenses().stream()
                    .map(expense -> expense.description() + " " + money(expense.amount()))
                    .collect(Collectors.joining(" · ")));
        }
        body.append(".");
    }

    private void appendEmployeeMovements(StringBuilder body, ShiftReportResponse report) {
        if (isEmpty(report.employeeMovements())) return;

        body.append("\n\nومن الموظفين: ").append(report.employeeMovements().stream()
                .map(this::phrase)
                .collect(Collectors.joining("، و")))
            .append(".");
    }

    /**
     * "سلفة 200 لمحمود" reads; "ADVANCE | محمود | 200.00" does not.
     *
     * <p>The reason is appended whenever one was recorded. It is the first thing an owner asks
     * about a deduction, and a message that reports the amount but withholds the why just produces
     * a phone call — which is the thing this notification exists to save.
     */
    private String phrase(ShiftReportResponse.EmployeeMovementSummaryItem movement) {
        String amount = money(movement.amount());
        String name = movement.employeeName();

        String head = movement.type() == null ? amount + " لـ" + name : switch (movement.type()) {
            case "ADVANCE" -> "سلفة " + amount + " لـ" + name;
            case "DEDUCTION" -> "خصم " + amount + " على " + name;
            case "BONUS" -> "مكافأة " + amount + " لـ" + name;
            case "SALARY_PAYOUT" -> "راتب " + amount + " لـ" + name;
            default -> amount + " لـ" + name;
        };

        String reason = movement.notes();
        return (reason == null || reason.isBlank()) ? head : head + " (" + reason.trim() + ")";
    }

    private void appendDebts(StringBuilder body, ShiftReportResponse report) {
        boolean anyNew = isPositive(report.totalNewDebts());
        boolean anyCollected = isPositive(report.totalCollectedDebts());
        if (!anyNew && !anyCollected) return;

        body.append("\n\n");
        if (anyNew && anyCollected) {
            body.append("فتحنا آجل بـ").append(money(report.totalNewDebts()))
                .append(" وحصّلنا ").append(money(report.totalCollectedDebts())).append(" من آجل قديم.");
        } else if (anyNew) {
            body.append("فتحنا آجل بـ").append(money(report.totalNewDebts())).append(".");
        } else {
            body.append("حصّلنا ").append(money(report.totalCollectedDebts())).append(" من الآجل.");
        }
    }

    /**
     * Sales per preparation point.
     *
     * <p>Only worth a line when there is more than one - a café that sends everything to the bar
     * learns nothing from being told the bar sold all of it. With a fridge in the mix it answers
     * the question the owner actually has at the end of the night: how much went off the cooler,
     * and therefore what needs restocking before tomorrow.
     */
    private void appendStations(StringBuilder body, ShiftReportResponse report) {
        if (isEmpty(report.stationSales()) || report.stationSales().size() < 2) return;

        body.append("\n\n")
            .append(report.stationSales().stream()
                    .filter(station -> isPositive(station.totalAmount()))
                    .map(station -> station.label() + " " + money(station.totalAmount()))
                    .collect(Collectors.joining("، ")))
            .append(".");
    }

    /**
     * Three, not ten. A best-seller line is a flavour of how the shift went, not a stock report —
     * and the link carries the full breakdown for anyone who actually wants to study it.
     */
    private void appendTopProducts(StringBuilder body, ShiftReportResponse report) {
        if (isEmpty(report.productSales())) return;

        String top = report.productSales().stream()
                .sorted(Comparator.comparing(
                        (ShiftReportResponse.ProductSalesSummaryItem item) ->
                                item.quantitySold() == null ? 0 : item.quantitySold())
                        .reversed())
                .limit(3)
                .map(item -> item.productName() + " (" + item.quantitySold() + ")")
                .collect(Collectors.joining("، "));

        if (!top.isBlank()) {
            body.append("\n\nأكتر حاجة اتباعت: ").append(top).append(".");
        }
    }

    /**
     * The part the owner opens the message for, so it goes last and says the number plainly.
     * A shortfall and a surplus must not read the same sentence.
     */
    private void appendDrawer(StringBuilder body, ShiftEvents.ShiftClosed event) {
        body.append("\n\nالدرج: العهدة كانت ").append(money(event.openingFloat()))
            .append("، المفروض يكون فيه ").append(money(event.expectedCash()))
            .append("، وعدّينا ").append(money(event.countedCash())).append(".");

        BigDecimal variance = event.variance() != null ? event.variance() : BigDecimal.ZERO;
        if (variance.compareTo(BigDecimal.ZERO) == 0) {
            body.append("\nمظبوط ✅");
        } else if (variance.compareTo(BigDecimal.ZERO) < 0) {
            body.append("\n*ناقص ").append(money(variance.abs())).append("* 🔴");
        } else {
            body.append("\n*زيادة ").append(money(variance)).append("* 🟡");
        }
    }

    private boolean isPositive(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    private boolean isEmpty(List<?> list) {
        return list == null || list.isEmpty();
    }

    /**
     * Same two guards {@code SubscriptionExpiryJob} applies, and for the same reason: a tenant that
     * has not switched alerts on, or has no number stored, is not to be messaged.
     */
    private void send(Long tenantId, String message) {
        try {
            Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
            if (tenant == null || !Boolean.TRUE.equals(tenant.getWhatsappAlertsEnabled())) return;

            String number = tenant.getOwnerWhatsapp();
            if (number == null || number.isBlank()) return;

            whatsAppService.sendInstantMessage(number, message);
        } catch (RuntimeException failure) {
            // A notification must never be able to affect the shift it is reporting on. By this
            // point the transaction has already committed, so there is nothing to undo either.
            log.warn("Could not notify tenant {} about a shift", tenantId, failure);
        }
    }

    private String duration(ShiftEvents.ShiftClosed event) {
        if (event.openedAt() == null || event.closedAt() == null) return "—";
        Duration d = Duration.between(event.openedAt(), event.closedAt());
        return d.toHours() + " ساعة و " + d.toMinutesPart() + " دقيقة";
    }

    private String time(Instant instant) {
        return instant == null ? "—" : TIME.format(instant.atZone(CAIRO));
    }

    private String money(BigDecimal amount) {
        return (amount == null ? BigDecimal.ZERO : amount).stripTrailingZeros().toPlainString() + " ج.م";
    }
}
