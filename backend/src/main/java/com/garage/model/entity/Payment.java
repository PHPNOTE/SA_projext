package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.time.Instant;

public record Payment(
    Long paymentId,
    Long invoiceId,
    PayerType payerType,
    BigDecimal amount,
    String method,
    Long receivedBy,
    Instant paidAt
) {
    public enum PayerType {
        CUSTOMER, INSURER
    }

    public static final RowMapper<Payment> ROW_MAPPER = (rs, rowNum) -> new Payment(
        rs.getLong("payment_id"),
        rs.getLong("invoice_id"),
        PayerType.valueOf(rs.getString("payer_type")),
        rs.getBigDecimal("amount"),
        rs.getString("method"),
        rs.getLong("received_by"),
        rs.getTimestamp("paid_at").toInstant()
    );

    public Payment withPaymentId(Long newId) {
        return new Payment(newId, invoiceId, payerType, amount, method, receivedBy, paidAt);
    }
}
