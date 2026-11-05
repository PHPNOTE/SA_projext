package com.garage.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class ReportDtos {

    public record RepairSummaryReport(
        int totalOrders,
        int completedOrders,
        List<RepairSummaryItem> items
    ) {}

    public record RepairSummaryItem(
        Long repairId,
        String ticketNo,
        String status,
        Instant queuedAt,
        Instant closedAt,
        String plate,
        String customerName,
        BigDecimal subtotal,
        BigDecimal customerDue
    ) {}

    public record InventoryUsageReport(
        int totalParts,
        List<InventoryUsageItem> items
    ) {}

    public record InventoryUsageItem(
        Long partId,
        String sku,
        String name,
        BigDecimal sellPrice,
        int onHand,
        int reserved,
        int reorderLevel,
        boolean isLowStock,
        int netConsumed
    ) {}

    public record RevenueReport(
        int totalInvoicesIssued,
        BigDecimal grossRevenue,
        BigDecimal totalPayments
    ) {}
}
