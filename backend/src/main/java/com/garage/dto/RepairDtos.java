package com.garage.dto;

import java.math.BigDecimal;

public class RepairDtos {

    public record RegisterRepairRequest(
        String customerName,
        String customerPhone,
        String customerNote,
        String licensePlate,
        String make,
        String model,
        Integer year,
        String complaint,
        String queueClass,
        String priorityReason,
        String queuedAt,
        String insurerName,
        String claimNo,
        Boolean insuranceDocsReceived,
        BigDecimal insuranceCoveredAmount
    ) {}

    public record CallNextRequest(
        Long bayId,
        Long mechanicId
    ) {}

    public record HoldRepairRequest(
        String holdReason
    ) {}

    public record CancelRepairRequest(
        String reason
    ) {}

    public record PriorityOverrideRequest(
        String priorityReason
    ) {}

    public record QCRequest(
        Boolean passed
    ) {}
}
