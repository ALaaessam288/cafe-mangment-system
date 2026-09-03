package com.example.cafemangmentsystem.billing.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Writes subscription errors as JSON.
 *
 * <p>Uses Jackson rather than string concatenation. The previous filter built its body by
 * concatenating an Arabic message straight into a JSON literal, which produces malformed JSON the
 * moment a message ever contains a quote or a backslash — and the messages are edited by hand.
 */
@Component
public class BillingErrorWriter {

    private final ObjectMapper objectMapper;

    public BillingErrorWriter() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        this.objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public void write(HttpServletResponse response, int status, String errorCode, String message, String planCode)
            throws IOException {
        if (response.isCommitted()) return;
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", errorCode);
        body.put("status", status);
        body.put("message", message);
        if (planCode != null) body.put("plan", planCode);
        objectMapper.writeValue(response.getWriter(), body);
    }
}
