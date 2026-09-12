package com.example.cafemangmentsystem.common.whatsapp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The provider field was read into a member and then never used, so every gateway got the same
 * request no matter what it was configured as. These tests exist so that cannot happen silently
 * again: each one asserts the shape one provider actually receives.
 */
class WhatsAppServiceTest {

    private final WhatsAppService service = new WhatsAppService();

    /* ── endpoint ───────────────────────────────────────────────────────── */

    @Test
    void baileysBridgePostsToSend() {
        service.configure("BAILEYS", "http://bridge.railway.internal:8080", "", "key");

        assertThat(service.endpointUrl()).isEqualTo("http://bridge.railway.internal:8080/send");
    }

    @Test
    void aTrailingSlashOnTheBaseUrlDoesNotProduceADoubleSlash() {
        service.configure("BAILEYS", "http://bridge:8080/", "", "key");

        assertThat(service.endpointUrl()).isEqualTo("http://bridge:8080/send");
    }

    @Test
    void ultramsgAddressesTheConfiguredInstance() {
        service.configure("ULTRAMSG", "https://api.ultramsg.com", "instance12345", "tok");

        assertThat(service.endpointUrl()).isEqualTo("https://api.ultramsg.com/instance12345/messages/chat");
    }

    @Test
    void anUnknownProviderUsesTheUrlExactlyAsConfigured() {
        service.configure("GENERIC_HTTP", "https://some-gateway.example/api/v2/send", "", "tok");

        assertThat(service.endpointUrl()).isEqualTo("https://some-gateway.example/api/v2/send");
    }

    @Test
    void theProviderIsMatchedCaseInsensitively() {
        service.configure("baileys", "http://bridge:8080", "", "key");

        assertThat(service.endpointUrl()).isEqualTo("http://bridge:8080/send");
    }

    /* ── payload ────────────────────────────────────────────────────────── */

    @Test
    void baileysGetsOnlyToAndText() throws Exception {
        service.configure("BAILEYS", "http://bridge:8080", "", "secret-key");

        String body = service.payload("201061967618", "hello");

        assertThat(body).isEqualTo("{\"to\":\"201061967618\",\"text\":\"hello\"}");
        // The bridge authenticates by header. A token in the body would be a second copy of the
        // secret in a second place, for nothing.
        assertThat(body).doesNotContain("secret-key");
    }

    @Test
    void ultramsgGetsItsTokenInTheBody() throws Exception {
        service.configure("ULTRAMSG", "https://api.ultramsg.com", "inst", "tok123");

        assertThat(service.payload("201061967618", "hello"))
                .isEqualTo("{\"token\":\"tok123\",\"to\":\"201061967618\",\"body\":\"hello\"}");
    }

    @Test
    void newlinesAndQuotesInTheMessageAreEscapedNotConcatenated() throws Exception {
        service.configure("BAILEYS", "http://bridge:8080", "", "key");

        String body = service.payload("201061967618", "line one\nsaid \"hi\"\ttabbed");

        assertThat(body).isEqualTo("{\"to\":\"201061967618\",\"text\":\"line one\\nsaid \\\"hi\\\"\\ttabbed\"}");
    }

    @Test
    void arabicSurvivesSerialisation() throws Exception {
        service.configure("BAILEYS", "http://bridge:8080", "", "key");

        assertThat(service.payload("201061967618", "اشتراكك ينتهي بعد ٣ أيام"))
                .contains("اشتراكك ينتهي بعد ٣ أيام");
    }

    /* ── phone normalisation ────────────────────────────────────────────── */

    @Test
    void aLocalEgyptianNumberGainsTheCountryCode() {
        assertThat(service.normalizePhone("01061967618")).isEqualTo("201061967618");
    }

    @Test
    void spacesAndPlusAreStripped() {
        assertThat(service.normalizePhone("+20 106 196 7618")).isEqualTo("201061967618");
    }

    @Test
    void theInternationalDiallingPrefixIsRemoved() {
        assertThat(service.normalizePhone("00201061967618")).isEqualTo("201061967618");
    }

    @Test
    void aTenDigitNumberWithNoPrefixIsAssumedEgyptian() {
        assertThat(service.normalizePhone("1061967618")).isEqualTo("201061967618");
    }

    @Test
    void anAlreadyNormalisedNumberIsLeftAlone() {
        assertThat(service.normalizePhone("201061967618")).isEqualTo("201061967618");
    }
}
