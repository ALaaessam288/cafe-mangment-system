package com.caffio.cafetable.dto;

import com.caffio.cafetable.entity.TableZone;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CafeTableRequest(
        @NotNull(message = "رقم الطاولة مطلوب")
        @Positive(message = "يجب أن يكون رقم الطاولة رقماً موجباً")
        Integer number,

        @NotNull(message = "منطقة الطاولة مطلوبة")
        TableZone zone,

        @NotNull(message = "عدد المقاعد مطلوب")
        @Positive(message = "يجب أن يكون عدد المقاعد 1 على الأقل")
        Integer seats
) {
}
