package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;

public record PoLine(
    Long poLineId,
    Long poId,
    Long partId,
    int qtyOrdered,
    int qtyReceived,
    BigDecimal unitCost
) {
    public static final RowMapper<PoLine> ROW_MAPPER = (rs, rowNum) -> new PoLine(
        rs.getLong("po_line_id"),
        rs.getLong("po_id"),
        rs.getLong("part_id"),
        rs.getInt("qty_ordered"),
        rs.getInt("qty_received"),
        rs.getBigDecimal("unit_cost")
    );

    public PoLine withPoLineId(Long newId) {
        return new PoLine(newId, poId, partId, qtyOrdered, qtyReceived, unitCost);
    }
}
