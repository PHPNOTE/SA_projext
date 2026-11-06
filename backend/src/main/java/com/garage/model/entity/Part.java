package com.garage.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;

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
    @JsonProperty("id")
    public Long id() {
        return partId;
    }

    @JsonProperty("partCode")
    public String partCode() {
        return sku;
    }

    @JsonProperty("unitPrice")
    public BigDecimal unitPrice() {
        return sellPrice;
    }

    @JsonProperty("costPrice")
    public BigDecimal costPrice() {
        if (sellPrice == null) return BigDecimal.ZERO;
        return sellPrice.multiply(BigDecimal.valueOf(0.70)).setScale(2, RoundingMode.HALF_UP);
    }

    @JsonProperty("shelfLocation")
    public String shelfLocation() {
        return "A-" + (partId != null ? partId : 1);
    }

    @JsonProperty("category")
    public String category() {
        if (sku == null) return "GENERAL";
        if (sku.startsWith("OIL") || sku.startsWith("COOL") || sku.startsWith("FLT")) return "FLUIDS";
        if (sku.startsWith("BRK")) return "BRAKES";
        if (sku.startsWith("SPK")) return "IGNITION";
        if (sku.startsWith("BLT")) return "ENGINE";
        if (sku.startsWith("BAT")) return "ELECTRICAL";
        if (sku.startsWith("SUS")) return "SUSPENSION";
        return "GENERAL";
    }

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
