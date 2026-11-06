package com.garage.dto;

import com.garage.model.entity.Invoice;
import com.garage.model.entity.InvoiceLine;
import com.garage.model.entity.Payment;

import java.math.BigDecimal;
import java.util.List;

public class InvoiceDtos {

    public record GenerateInvoiceRequest(
        Long repairId,
        Long saleId
    ) {}

    public record InvoiceResponse(
        Invoice invoice,
        List<InvoiceLine> lines
    ) {}

    public record PayInvoiceRequest(
        @com.fasterxml.jackson.annotation.JsonAlias({"amount", "amountPaid"})
        BigDecimal amount,

        @com.fasterxml.jackson.annotation.JsonAlias({"payerType", "payer"})
        String payerType,

        @com.fasterxml.jackson.annotation.JsonAlias({"method", "paymentMethod"})
        String method
    ) {}

    public record PayInvoiceResponse(
        Payment payment,
        String repairStatus,
        BigDecimal customerDue,
        BigDecimal totalCustomerPaid
    ) {}
}
