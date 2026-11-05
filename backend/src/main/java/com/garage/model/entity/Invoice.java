package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.time.Instant;

public record Invoice(
    Long invoiceId,
    String invoiceNo,
    Long repairId,
    Long saleId,
    BigDecimal subtotal,
    BigDecimal insuranceCovered,
    BigDecimal customerDue,
    InvoiceStatus status,
    Long issuedBy,
    Instant issuedAt
) {
    public enum InvoiceStatus {
        ISSUED, VOID
    }

    public static final RowMapper<Invoice> ROW_MAPPER = (rs, rowNum) -> new Invoice(
        rs.getLong("invoice_id"),
        rs.getString("invoice_no"),
        rs.getObject("repair_id", Long.class),
        rs.getObject("sale_id", Long.class),
        rs.getBigDecimal("subtotal"),
        rs.getBigDecimal("insurance_covered"),
        rs.getBigDecimal("customer_due"),
        InvoiceStatus.valueOf(rs.getString("status")),
        rs.getLong("issued_by"),
        rs.getTimestamp("issued_at").toInstant()
    );

    public Invoice withInvoiceId(Long newId) {
        return new Invoice(newId, invoiceNo, repairId, saleId, subtotal, insuranceCovered, customerDue, status, issuedBy, issuedAt);
    }
}
