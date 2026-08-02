package com.example.cafemangmentsystem.printing.dto;

import com.example.cafemangmentsystem.printing.entity.Printer;
import com.example.cafemangmentsystem.printing.entity.PrinterType;

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