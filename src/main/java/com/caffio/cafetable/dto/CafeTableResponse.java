package com.caffio.cafetable.dto;

import com.caffio.cafetable.entity.CafeTable;
import com.caffio.cafetable.entity.TableZone;

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