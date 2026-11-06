package com.garage.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import java.math.BigDecimal;

public class RepairDtos {

    public record RegisterRepairRequest(
        @JsonAlias({"name", "customerName"})
        String customerName,

        @JsonAlias({"phone", "customerPhone"})
        String customerPhone,

        @JsonAlias({"note", "customerNote"})
        String customerNote,

        @JsonAlias({"plate", "licensePlate"})
        String licensePlate,

        @JsonAlias({"brand", "make"})
        String make,

        @JsonAlias({"model"})
        String model,

        @JsonAlias({"year"})
        Integer year,

        @JsonAlias({"symptoms", "complaint"})
        String complaint,

        @JsonAlias({"queueClass"})
        String queueClass,

        @JsonAlias({"priorityReason"})
        String priorityReason,

        @JsonAlias({"queuedAt"})
        String queuedAt,

        @JsonAlias({"insurerName"})
        String insurerName,

        @JsonAlias({"insuranceClaimNo", "claimNo"})
        String claimNo,

        @JsonAlias({"insuranceDocsReceived"})
        Boolean insuranceDocsReceived,

        @JsonAlias({"insuranceCoveredAmount"})
        BigDecimal insuranceCoveredAmount
    ) {}

    public record CallNextRequest(
        @JsonAlias({"bayId"})
        Long bayId,

        @JsonAlias({"mechanicId"})
        Long mechanicId
    ) {}

    public record HoldRepairRequest(
        @JsonAlias({"reason", "holdReason", "note"})
        String holdReason
    ) {}

    public record CancelRepairRequest(
        @JsonAlias({"reason", "note"})
        String reason
    ) {}

    public record PriorityOverrideRequest(
        @JsonAlias({"reason", "priorityReason"})
        String priorityReason
    ) {}

    public record QCRequest(
        @JsonAlias({"passed"})
        Boolean passed
    ) {}

    public record UpdateRepairStatusRequest(
        @JsonAlias({"status"})
        String status,

        @JsonAlias({"note", "reason", "holdReason"})
        String note
    ) {}
}
