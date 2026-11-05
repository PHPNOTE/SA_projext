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
        BigDecimal amount,
        String payerType,
        String method
    ) {}

    public record PayInvoiceResponse(
        Payment payment,
        String repairStatus,
        BigDecimal customerDue,
        BigDecimal totalCustomerPaid
    ) {}
}
