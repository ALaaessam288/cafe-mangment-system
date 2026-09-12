package com.example.cafemangmentsystem.common.whatsapp;

import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import java.util.Locale;

/**
 * Sends WhatsApp messages through whichever gateway is configured.
 *
 * <p>Gateways disagree about everything - the path, the header the key goes in, and what the JSON
 * body is called - so {@code whatsapp.gateway.provider} selects the shape. That property already
 * existed and was read into a field that nothing ever looked at; every deployment therefore got the
 * one hardcoded request shape regardless of what it was set to.
 *
 * <p>The body used to be assembled by {@code String.format} with a hand-written escaper, and it
 * carried {@code token}, {@code to}, {@code body}, {@code phone} and {@code message} all at once -
 * a scattergun aimed at several gateways in the hope that one of them recognised some of it. It is
 * built with Jackson now, and only the fields the selected provider actually reads are sent.
 */
@Service
public class WhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppService.class);

    /** The self-hosted Baileys bridge in {@code whatsapp-bridge/}. */
    static final String BAILEYS = "BAILEYS";
    /** api.ultramsg.com and the several hosted gateways that copied its shape. */
    static final String ULTRAMSG = "ULTRAMSG";

    private final ObjectMapper json = new ObjectMapper();

    @Value("${whatsapp.gateway.enabled:false}")
    private boolean enabled;

    @Value("${whatsapp.gateway.provider:GENERIC_HTTP}")
    private String provider;

    @Value("${whatsapp.gateway.api-url:}")
    private String apiUrl;

    @Value("${whatsapp.gateway.instance-id:}")
    private String instanceId;

    @Value("${whatsapp.gateway.token:}")
    private String token;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Sends a WhatsApp message in the background immediately without requiring user interaction.
     */
    @Async
    public void sendInstantMessage(String recipientPhone, String messageText) {
        if (!enabled || recipientPhone == null || recipientPhone.isBlank()) {
            log.debug("[WhatsApp] Skipping dispatch: gateway disabled or empty recipient.");
            return;
        }

        String normalizedPhone = normalizePhone(recipientPhone);

        if (apiUrl == null || apiUrl.isBlank() || token == null || token.isBlank()) {
            log.warn("[WhatsApp] Dispatch skipped for {} because gateway credentials are not configured",
                    maskPhone(normalizedPhone));
            return;
        }

        try {
            HttpRequest request = buildRequest(normalizedPhone, messageText);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[WhatsApp] Accepted by {} for {}", resolvedProvider(), maskPhone(normalizedPhone));
            } else {
                // The body is the only place a gateway explains itself, and a bare status code has
                // repeatedly turned a one-line misconfiguration into a debugging session.
                log.warn("[WhatsApp] {} returned status {} for {}: {}", resolvedProvider(), response.statusCode(),
                        maskPhone(normalizedPhone), abbreviate(response.body()));
            }
        } catch (Exception ex) {
            log.error("[WhatsApp] Failed to dispatch message to {}: {}", maskPhone(normalizedPhone), ex.getMessage());
        }
    }

    /**
     * Sends tenant owner credentials only when an explicit caller supplies a public application URL.
     *
     * <p>NOTE: this puts a password in a chat thread, where it stays forever - in the recipient's
     * phone backup, and in the logs of whatever gateway carried it. It has no callers. Before it
     * gets one, it should send a single-use activation link that expires and let the owner choose
     * their own password instead.
     */
    public void sendTenantCredentials(Tenant tenant, String username, String plainPassword, String appBaseUrl,
                                      String planDisplayName) {
        if (tenant.getOwnerWhatsapp() == null || tenant.getOwnerWhatsapp().isBlank()) {
            return;
        }

        if (appBaseUrl == null || appBaseUrl.isBlank()) {
            log.warn("[WhatsApp] Credential delivery skipped because no public application URL was supplied");
            return;
        }

        String baseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;

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
                planDisplayName != null ? planDisplayName : "—",
                username,
                plainPassword,
                tenantLoginUrl
        );

        sendInstantMessage(tenant.getOwnerWhatsapp(), message);
    }

    /* ── request shapes ─────────────────────────────────────────────────── */

    HttpRequest buildRequest(String phone, String messageText) throws JsonProcessingException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(endpointUrl()))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(payload(phone, messageText), StandardCharsets.UTF_8));

        // The bridge reads x-api-key; it deliberately does not accept Bearer, so that a token meant
        // for a hosted gateway cannot be pointed at it by accident and half-work.
        if (BAILEYS.equals(resolvedProvider())) {
            builder.header("x-api-key", token);
        } else {
            builder.header("Authorization", "Bearer " + token);
        }

        return builder.build();
    }

    String endpointUrl() {
        String base = apiUrl == null ? "" : apiUrl.replaceAll("/+$", "");

        return switch (resolvedProvider()) {
            case BAILEYS -> base + "/send";
            // UltraMsg addresses one of several WhatsApp sessions on the same account by id.
            case ULTRAMSG -> base + "/" + instanceId + "/messages/chat";
            // GENERIC_HTTP: the URL is taken exactly as configured, because the whole point of it
            // is a gateway this code has never heard of.
            default -> base.isEmpty() ? apiUrl : base;
        };
    }

    String payload(String phone, String messageText) throws JsonProcessingException {
        ObjectNode body = json.createObjectNode();

        switch (resolvedProvider()) {
            case BAILEYS -> {
                body.put("to", phone);
                body.put("text", messageText);
            }
            case ULTRAMSG -> {
                body.put("token", token);
                body.put("to", phone);
                body.put("body", messageText);
            }
            default -> {
                // No provider named: send the union of the field names the common gateways use and
                // let the far end pick. This is a guess by construction - name the provider.
                body.put("to", phone);
                body.put("phone", phone);
                body.put("body", messageText);
                body.put("message", messageText);
                body.put("text", messageText);
            }
        }

        return json.writeValueAsString(body);
    }

    String resolvedProvider() {
        return provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT);
    }

    /* ── helpers ────────────────────────────────────────────────────────── */

    private String abbreviate(String body) {
        if (body == null || body.isBlank()) return "(empty body)";
        return body.length() <= 300 ? body : body.substring(0, 300) + "…";
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) return "unknown recipient";
        int visibleDigits = Math.min(4, phone.length());
        return "***" + phone.substring(phone.length() - visibleDigits);
    }

    /**
     * Reduces whatever a human typed to a bare international number: digits only, no leading trunk
     * zero, Egypt assumed when no country code is present.
     */
    String normalizePhone(String raw) {
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.startsWith("00")) {
            digits = digits.substring(2);
        }
        if (digits.startsWith("0")) {
            return "20" + digits.substring(1);
        }
        if (!digits.startsWith("20") && digits.length() == 10) {
            return "20" + digits;
        }
        return digits;
    }

    /* ── test seams ─────────────────────────────────────────────────────── */

    void configure(String provider, String apiUrl, String instanceId, String token) {
        this.provider = provider;
        this.apiUrl = apiUrl;
        this.instanceId = instanceId;
        this.token = token;
    }
}
