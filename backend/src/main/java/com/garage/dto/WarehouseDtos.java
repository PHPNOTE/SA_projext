package com.garage.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.garage.model.entity.Part;
import com.garage.model.entity.PartRequest;
import com.garage.model.entity.PoLine;
import com.garage.model.entity.PurchaseOrder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class WarehouseDtos {

    public record PartUpsertRequest(
        @JsonAlias({"partCode", "sku"})
        String sku,

        @JsonAlias({"name"})
        String name,

        @JsonAlias({"unitPrice", "sellPrice"})
        BigDecimal sellPrice,

        @JsonAlias({"reorderLevel"})
        Integer reorderLevel
    ) {}

    public record IssuePartRequest(
        @JsonAlias({"requestId", "id"})
        Long requestId
    ) {}

    public record IssuePartResponse(
        PartRequest partRequest,
        Part part
    ) {}

    public record ReturnPartRequest(
        @JsonAlias({"requestId", "id"})
        Long requestId,

        @JsonAlias({"qty", "returnQty"})
        Integer qty
    ) {}

    public record ReturnPartResponse(
        PartRequest partRequest,
        Part part
    ) {}

    public record CreatePORequest(
        @JsonAlias({"supplierName"})
        String supplierName,

        @JsonAlias({"expectedDate"})
        String expectedDate,

        @JsonAlias({"lines"})
        List<POLineRequest> lines
    ) {}

    public record POLineRequest(
        @JsonAlias({"partId"})
        Long partId,

        @JsonAlias({"qtyOrdered", "qty"})
        Integer qtyOrdered,

        @JsonAlias({"unitCost", "costPrice"})
        BigDecimal unitCost
    ) {}

    public record ReceivePORequest(
        @JsonAlias({"receivedLines", "lines"})
        List<ReceivePOLineRequest> lines
    ) {}

    public record ReceivePOLineRequest(
        @JsonAlias({"poLineId", "lineId"})
        Long poLineId,

        @JsonAlias({"qtyReceived", "qty"})
        Integer qtyReceived
    ) {}

    public record POResponse(
        PurchaseOrder purchaseOrder,
        List<PoLine> lines
    ) {}

    public record StockAdjustRequest(
        @JsonAlias({"partId"})
        Long partId,

        @JsonAlias({"deltaOnHand", "delta"})
        Integer delta,

        @JsonAlias({"reason"})
        String reason
    ) {}

    public record CreatePartRequestInput(
        @JsonAlias({"repairId"})
        Long repairId,

        @JsonAlias({"partId"})
        Long partId,

        @JsonAlias({"qty", "qtyRequested"})
        Integer qty
    ) {}

    public record PartRequestDto(
        Long id,
        Long requestId,
        String requestNumber,
        Long repairId,
        Long estimateLineId,
        Long saleOrderLineId,
        Long partId,
        String partCode,
        String partName,
        int qtyRequested,
        int qty,
        int qtyIssued,
        int qtyReturned,
        String status,
        Instant createdAt
    ) {}
}
