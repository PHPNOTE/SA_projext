package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

public record RepairBay(
    Long bayId,
    String name,
    boolean isActive
) {
    public static final RowMapper<RepairBay> ROW_MAPPER = (rs, rowNum) -> new RepairBay(
        rs.getLong("bay_id"),
        rs.getString("name"),
        rs.getBoolean("is_active")
    );

    public RepairBay withBayId(Long newId) {
        return new RepairBay(newId, name, isActive);
    }
}
