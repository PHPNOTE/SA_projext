package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;

public record SaleOrderLine(
    Long lineId,
    Long saleId,
    Long partId,
    int qty,
    BigDecimal unitPrice
) {
    public static final RowMapper<SaleOrderLine> ROW_MAPPER = (rs, rowNum) -> new SaleOrderLine(
        rs.getLong("line_id"),
        rs.getLong("sale_id"),
        rs.getLong("part_id"),
        rs.getInt("qty"),
        rs.getBigDecimal("unit_price")
    );

    public SaleOrderLine withLineId(Long newId) {
        return new SaleOrderLine(newId, saleId, partId, qty, unitPrice);
    }
}
