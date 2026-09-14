package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.common.whatsapp.WhatsAppService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Lets the platform owner verify the WhatsApp gateway without waiting for a real notification.
 *
 * <p>Every message this application sends goes out through {@code @Async} fire-and-forget calls
 * made by a scheduled job. That is right for production - nothing should block a checkout on a
 * gateway - but it meant the integration could only be tested by waiting for a subscription to
 * approach expiry and then reading server logs. A misconfigured URL, a wrong token or an
 * unlinked WhatsApp session were all equally silent.
 *
 * <p>Sits under {@code /api/platform/**}, so {@code PlatformApiKeyFilter} already requires either
 * the provisioning key or an authenticated SUPER_ADMIN. No café user can reach it.
 */
@RestController
@RequestMapping("/api/platform/whatsapp")
@RequiredArgsConstructor
public class WhatsAppDiagnosticsController {

    private final WhatsAppService whatsAppService;

    /** What the running application believes its gateway configuration to be. Never the token. */
    @GetMapping("/status")
    public Map<String, Object> status() {
        return whatsAppService.describeConfiguration();
    }

    public record TestRequest(@NotBlank(message = "رقم المستقبل مطلوب") String to, String text) {}

    /**
     * Sends one message and reports the outcome. Synchronous on purpose: an async answer here
     * would say "queued" and tell the caller nothing, which is the problem this endpoint exists
     * to solve.
     */
    @PostMapping("/test")
    public ResponseEntity<WhatsAppService.DispatchResult> test(@RequestBody TestRequest request) {
        String message = (request.text() == null || request.text().isBlank())
                ? "رسالة تجربة من Caffio ☕ — لو وصلتك دي يبقى الربط شغال."
                : request.text();

        WhatsAppService.DispatchResult result = whatsAppService.sendNow(request.to(), message);

        // 502 rather than 500: the failure is the upstream gateway's, and the status code should
        // say so to whoever is holding the runbook at 2am.
        return result.dispatched() ? ResponseEntity.ok(result) : ResponseEntity.status(502).body(result);
    }
}
