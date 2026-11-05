package com.caffio.printing.dto;

import com.caffio.printing.entity.Printer;
import com.caffio.printing.entity.PrinterType;

import java.time.Instant;

public record PrinterResponse(
        Long id,
        String name,
        String ipAddress,
        Integer port,
        PrinterType type,
        Integer paperWidth,
        boolean online,
        Instant lastSeenAt
) {
    public static PrinterResponse from(Printer printer) {
        return new PrinterResponse(printer.getId(), printer.getName(), printer.getIpAddress(),
                printer.getPort(), printer.getType(), printer.getPaperWidth(), printer.isOnline(), printer.getLastSeenAt());
    }
}