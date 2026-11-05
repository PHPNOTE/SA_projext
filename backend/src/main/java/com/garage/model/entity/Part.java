package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;

public record Part(
    Long partId,
    String sku,
    String name,
    BigDecimal sellPrice,
    int onHand,
    int reserved,
    int reorderLevel,
    boolean isActive
) {
    public static final RowMapper<Part> ROW_MAPPER = (rs, rowNum) -> new Part(
        rs.getLong("part_id"),
        rs.getString("sku"),
        rs.getString("name"),
        rs.getBigDecimal("sell_price"),
        rs.getInt("on_hand"),
        rs.getInt("reserved"),
        rs.getInt("reorder_level"),
        rs.getBoolean("is_active")
    );

    public Part withPartId(Long newId) {
        return new Part(newId, sku, name, sellPrice, onHand, reserved, reorderLevel, isActive);
    }
}
