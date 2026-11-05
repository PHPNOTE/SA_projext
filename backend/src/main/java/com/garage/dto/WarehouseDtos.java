package com.garage.dto;

import com.garage.model.entity.Part;
import com.garage.model.entity.PartRequest;
import com.garage.model.entity.PoLine;
import com.garage.model.entity.PurchaseOrder;

import java.math.BigDecimal;
import java.util.List;

public class WarehouseDtos {

    public record PartUpsertRequest(
        String sku,
        String name,
        BigDecimal sellPrice,
        Integer reorderLevel
    ) {}

    public record IssuePartRequest(
        Long requestId
    ) {}

    public record IssuePartResponse(
        PartRequest partRequest,
        Part part
    ) {}

    public record ReturnPartRequest(
        Long requestId,
        Integer qty
    ) {}

    public record ReturnPartResponse(
        PartRequest partRequest,
        Part part
    ) {}

    public record CreatePORequest(
        String supplierName,
        String expectedDate,
        List<POLineRequest> lines
    ) {}

    public record POLineRequest(
        Long partId,
        Integer qtyOrdered,
        BigDecimal unitCost
    ) {}

    public record ReceivePORequest(
        List<ReceivePOLineRequest> lines
    ) {}

    public record ReceivePOLineRequest(
        Long poLineId,
        Integer qtyReceived
    ) {}

    public record POResponse(
        PurchaseOrder purchaseOrder,
        List<PoLine> lines
    ) {}

    public record StockAdjustRequest(
        Long partId,
        Integer delta,
        String reason
    ) {}
}
