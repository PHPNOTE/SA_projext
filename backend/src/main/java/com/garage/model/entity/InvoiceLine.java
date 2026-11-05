package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;

public record InvoiceLine(
    Long lineId,
    Long invoiceId,
    Long partId,
    String description,
    int qty,
    BigDecimal unitPrice,
    BigDecimal lineTotal
) {
    public static final RowMapper<InvoiceLine> ROW_MAPPER = (rs, rowNum) -> new InvoiceLine(
        rs.getLong("line_id"),
        rs.getLong("invoice_id"),
        rs.getObject("part_id", Long.class),
        rs.getString("description"),
        rs.getInt("qty"),
        rs.getBigDecimal("unit_price"),
        rs.getBigDecimal("line_total")
    );

    public InvoiceLine withLineId(Long newId) {
        return new InvoiceLine(newId, invoiceId, partId, description, qty, unitPrice, lineTotal);
    }
}
