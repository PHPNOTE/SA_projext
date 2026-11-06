package com.garage.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class ReportDtos {

    public record RepairSummaryReport(
        int totalOrders,
        int completedOrders,
        List<RepairSummaryItem> items,
        String startDate,
        String endDate,
        int totalJobs,
        int completedJobs,
        int pendingJobs,
        int cancelledJobs,
        double avgTurnaroundHours,
        BigDecimal totalLaborRevenue,
        BigDecimal totalPartsRevenue,
        BigDecimal totalRevenue,
        List<EnrichedRepairOrder> records
    ) {}

    public record EnrichedRepairOrder(
        Long id,
        Long repairId,
        String roNumber,
        String ticketNumber,
        String ticketNo,
        String queueClass,
        String status,
        Long customerId,
        String customerName,
        String customerPhone,
        Long vehicleId,
        String licensePlate,
        String vehicleModel,
        int mileage,
        String symptoms,
        String complaint,
        String priorityReason,
        String insurerName,
        String insuranceClaimNo,
        Instant queuedAt,
        Instant createdAt,
        Instant completedAt,
        Instant closedAt,
        Long assignedBayId,
        String assignedBayNumber,
        Long assignedMechanicId,
        String assignedMechanicName,
        BigDecimal laborTotal,
        BigDecimal partsTotal,
        BigDecimal subtotal
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
        List<InventoryUsageItem> items,
        String generatedAt,
        String categoryFilter,
        String statusFilter,
        BigDecimal totalValuation,
        int totalItems,
        int lowStockItemsCount,
        int outOfStockItemsCount,
        List<TopConsumedPart> topConsumedParts,
        List<EnrichedPartRecord> records
    ) {}

    public record TopConsumedPart(
        String partCode,
        String partName,
        int consumedQty,
        BigDecimal consumedValue
    ) {}

    public record EnrichedPartRecord(
        Long id,
        Long partId,
        String partCode,
        String sku,
        String name,
        String category,
        String description,
        String shelfLocation,
        BigDecimal unitPrice,
        BigDecimal sellPrice,
        BigDecimal costPrice,
        int onHand,
        int reserved,
        int reorderLevel,
        boolean isActive,
        String stockStatus,
        int suggestedReorderQty,
        int netConsumed
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
