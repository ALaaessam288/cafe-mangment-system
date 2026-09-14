package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.common.whatsapp.WhatsAppService;
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

    /** Used to link the owner to the full report. Left blank, the message simply omits the line. */
    @Value("${app.public-url:}")
    private String publicUrl;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onShiftOpened(ShiftEvents.ShiftOpened event) {
        send(event.tenantId(), """
                🟢 *فتح شيفت*

                👤 الكاشير: %s
                🖥 نقطة البيع: %s
                💰 العهدة الافتتاحية: %s
                🕐 وقت الفتح: %s"""
                .formatted(event.cashierName(), event.registerName(),
                        money(event.openingFloat()), time(event.openedAt())));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onShiftClosed(ShiftEvents.ShiftClosed event) {
        BigDecimal variance = event.variance() != null ? event.variance() : BigDecimal.ZERO;

        // The line an owner actually opens the message for. A shortfall and a surplus are different
        // problems and should not read the same.
        String varianceLine;
        if (variance.compareTo(BigDecimal.ZERO) == 0) {
            varianceLine = "✅ الدرج مظبوط";
        } else if (variance.compareTo(BigDecimal.ZERO) < 0) {
            varianceLine = "🔴 *عجز: " + money(variance.abs()) + "*";
        } else {
            varianceLine = "🟡 *زيادة: " + money(variance) + "*";
        }

        String body = """
                🔴 *قفل شيفت*

                👤 الكاشير: %s
                🖥 نقطة البيع: %s
                🕐 من %s إلى %s (%s)

                💰 العهدة الافتتاحية: %s
                💵 مبيعات كاش: %s
                🧾 المفروض في الدرج: %s
                🔢 المعدود فعلياً: %s

                %s"""
                .formatted(event.cashierName(), event.registerName(),
                        time(event.openedAt()), time(event.closedAt()), duration(event),
                        money(event.openingFloat()), money(event.cashSales()),
                        money(event.expectedCash()), money(event.countedCash()),
                        varianceLine);

        if (publicUrl != null && !publicUrl.isBlank()) {
            body += "\n\n📄 التفاصيل الكاملة:\n"
                    + publicUrl.replaceAll("/+$", "") + "/shifts/" + event.shiftId();
        }

        send(event.tenantId(), body);
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
