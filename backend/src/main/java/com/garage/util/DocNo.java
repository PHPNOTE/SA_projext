package com.garage.util;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Builds business document numbers in the form PREFIX-yyyyMMdd-nnnn (e.g. RO-20261107-0008). */
public final class DocNo {
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private DocNo() {}

    public static String next(String prefix, long existingCount) {
        String day = LocalDate.now(ZoneId.of("Asia/Bangkok")).format(DAY);
        return prefix + "-" + day + "-" + String.format("%04d", existingCount + 1);
    }
}
