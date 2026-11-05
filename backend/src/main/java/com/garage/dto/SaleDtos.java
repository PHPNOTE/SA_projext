package com.garage.dto;

import com.garage.model.entity.Invoice;
import com.garage.model.entity.Payment;
import com.garage.model.entity.SaleOrder;
import com.garage.model.entity.SaleOrderLine;

import java.math.BigDecimal;
import java.util.List;

public class SaleDtos {

    public record CreateSaleQuoteRequest(
        Long customerId,
        List<SaleLineRequest> lines
    ) {}

    public record SaleLineRequest(
        Long partId,
        Integer qty,
        BigDecimal unitPrice
    ) {}

    public record SaleResponse(
        SaleOrder saleOrder,
        List<SaleOrderLine> lines
    ) {}

    public record CompleteSaleRequest(
        BigDecimal amountPaid,
        String paymentMethod
    ) {}

    public record CompleteSaleResponse(
        SaleOrder saleOrder,
        Invoice invoice,
        Payment payment
    ) {}
}
