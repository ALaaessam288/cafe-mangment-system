package com.example.cafemangmentsystem.common.whatsapp;

import com.example.cafemangmentsystem.tenant.entity.Tenant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
public class WhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppService.class);

    @Value("${whatsapp.gateway.enabled:true}")
    private boolean enabled;

    @Value("${whatsapp.gateway.provider:GENERIC_HTTP}")
    private String provider;

    @Value("${whatsapp.gateway.api-url:}")
    private String apiUrl;

    @Value("${whatsapp.gateway.instance-id:}")
    private String instanceId;

    @Value("${whatsapp.gateway.token:}")
    private String token;

    @Value("${whatsapp.gateway.sender-number:01061967618}")
    private String senderNumber;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Sends a WhatsApp message in the background immediately without requiring user interaction.
     */
    @Async
    public void sendInstantMessage(String recipientPhone, String messageText) {
        if (!enabled || recipientPhone == null || recipientPhone.isBlank()) {
            log.info("[WhatsApp] Skipping instant dispatch: Gateway disabled or empty recipient.");
            return;
        }

        String normalizedPhone = normalizePhone(recipientPhone);

        log.info("[WhatsApp Automation] 📲 Sending background message to {} (Sender: {})", normalizedPhone, senderNumber);

        if (apiUrl == null || apiUrl.isBlank() || token == null || token.isBlank()) {
            log.info("────────────────────────────────────────────────────────────────────────────");
            log.info("[WhatsApp Instant Server Dispatch] (Simulated / Ready for Gateway Token)");
            log.info("To: {}", normalizedPhone);
            log.info("Message:\n{}", messageText);
            log.info("────────────────────────────────────────────────────────────────────────────");
            return;
        }

        try {
            String targetUrl = buildEndpointUrl();
            String payload = buildJsonPayload(normalizedPhone, messageText);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[WhatsApp Automation] ✅ Message delivered successfully to {}. Response: {}", normalizedPhone, response.body());
            } else {
                log.warn("[WhatsApp Automation] ⚠️ Gateway responded with status {}: {}", response.statusCode(), response.body());
            }
        } catch (Exception ex) {
            log.error("[WhatsApp Automation] ❌ Failed to dispatch instant message to {}: {}", normalizedPhone, ex.getMessage());
        }
    }

    /**
     * Sends tenant owner credentials instantly upon account creation.
     */
    public void sendTenantCredentials(Tenant tenant, String username, String plainPassword, String appBaseUrl) {
        if (tenant.getOwnerWhatsapp() == null || tenant.getOwnerWhatsapp().isBlank()) {
            return;
        }

        String baseUrl = (appBaseUrl != null && !appBaseUrl.isBlank()) ? appBaseUrl : "http://localhost:5173";
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        String tenantLoginUrl = String.format("%s/%s/login", baseUrl, tenant.getSlug());

        String message = String.format(
                "مرحباً بك في منصة كافيو لإدارة الكافيهات والمطاعم ☕🚀\n\n" +
                "تم تأسيس وتفعيل حساب منشأتكم بنجاح:\n" +
                "🏪 اسم المنشأة: %s\n" +
                "🌐 المعرف المختصر (Slug): %s\n" +
                "⭐ باقة الاشتراك: %s\n\n" +
                "🔐 بيانات الدخول لحساب الإدارة:\n" +
                "👤 اسم المستخدم: %s\n" +
                "🔑 كلمة المرور: %s\n\n" +
                "🌐 رابط تسجيل الدخول المباشر لمنشأتكم:\n" +
                "%s\n\n" +
                "📞 للتواصل مع إدارة المنصة والدعم الفني:\n" +
                "01061967618\n\n" +
                "نتمنى لكم تجربة مميزة وتشغيل ناجح! ✨",
                tenant.getName(),
                tenant.getSlug(),
                tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan().name() : "PRO",
                username,
                plainPassword,
                tenantLoginUrl
        );

        sendInstantMessage(tenant.getOwnerWhatsapp(), message);
    }

    private String normalizePhone(String raw) {
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.startsWith("0")) {
            return "20" + digits.substring(1);
        }
        if (!digits.startsWith("20") && digits.length() == 10) {
            return "20" + digits;
        }
        return digits;
    }

    private String buildEndpointUrl() {
        if (instanceId != null && !instanceId.isBlank()) {
            return String.format("%s/%s/messages/chat", apiUrl.replaceAll("/+$", ""), instanceId);
        }
        return apiUrl;
    }

    private String buildJsonPayload(String phone, String message) {
        return String.format("{\"token\":\"%s\",\"to\":\"%s\",\"body\":%s,\"phone\":\"%s\",\"message\":%s}",
                escapeJson(token),
                phone,
                escapeJsonString(message),
                phone,
                escapeJsonString(message)
        );
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String escapeJsonString(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"') sb.append("\\\"");
            else if (c == '\\') sb.append("\\\\");
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else if (c == '\t') sb.append("\\t");
            else sb.append(c);
        }
        sb.append("\"");
        return sb.toString();
    }
}
