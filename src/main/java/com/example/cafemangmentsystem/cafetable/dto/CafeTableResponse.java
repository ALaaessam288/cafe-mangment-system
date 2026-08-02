package com.example.cafemangmentsystem.cafetable.dto;

import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import com.example.cafemangmentsystem.cafetable.entity.TableZone;

public record CafeTableResponse(
        Long id,
        Integer number,
        TableZone zone,
        Integer seats,
        boolean active
) {
    public static CafeTableResponse from(CafeTable table) {
        return new CafeTableResponse(table.getId(), table.getNumber(), table.getZone(),
                table.getSeats(), table.isActive());
    }
}