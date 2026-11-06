package com.garage.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.garage.model.entity.Invoice;
import com.garage.model.entity.Payment;
import com.garage.model.entity.SaleOrder;
import com.garage.model.entity.SaleOrderLine;

import java.math.BigDecimal;
import java.util.List;

public class SaleDtos {

    public record CreateSaleQuoteRequest(
        @JsonAlias({"customerId"})
        Long customerId,

        @JsonAlias({"lines", "items"})
        List<SaleLineRequest> lines
    ) {}

    public record SaleLineRequest(
        @JsonAlias({"partId"})
        Long partId,

        @JsonAlias({"qty"})
        Integer qty,

        @JsonAlias({"unitPrice"})
        BigDecimal unitPrice
    ) {}

    public record SaleResponse(
        SaleOrder saleOrder,
        List<SaleOrderLine> lines
    ) {}

    public record CompleteSaleRequest(
        @JsonAlias({"amountPaid", "amount"})
        BigDecimal amountPaid,

        @JsonAlias({"paymentMethod"})
        String paymentMethod
    ) {}

    public record CompleteSaleResponse(
        SaleOrder saleOrder,
        Invoice invoice,
        Payment payment
    ) {}

    public record SingleShotSaleRequest(
        @JsonAlias({"customerName"})
        String customerName,

        @JsonAlias({"customerPhone", "phone"})
        String customerPhone,

        @JsonAlias({"lines", "items"})
        List<SaleLineRequest> items,

        @JsonAlias({"paymentMethod"})
        String paymentMethod,

        @JsonAlias({"amountPaid", "amount"})
        BigDecimal amountPaid,

        @JsonAlias({"customerId"})
        Long customerId
    ) {}
}
