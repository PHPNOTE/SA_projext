package com.garage.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.garage.model.entity.Estimate;
import com.garage.model.entity.EstimateLine;
import com.garage.model.entity.RepairOrder;

import java.math.BigDecimal;
import java.util.List;

public class EstimateDtos {

    public record CreateEstimateRequest(
        @JsonAlias({"repairId"})
        Long repairId,

        @JsonAlias({"diagnosisNote", "note"})
        String diagnosisNote,

        @JsonAlias({"lines"})
        List<EstimateLineRequest> lines
    ) {}

    public record EstimateLineRequest(
        @JsonAlias({"lineType"})
        String lineType,

        @JsonAlias({"partId"})
        Long partId,

        @JsonAlias({"description"})
        String description,

        @JsonAlias({"qty"})
        Integer qty,

        @JsonAlias({"unitPrice"})
        BigDecimal unitPrice
    ) {}

    public record EstimateDecisionRequest(
        @JsonAlias({"decision", "status"})
        String decision,

        @JsonAlias({"insuranceDocsReceived", "docsReceived"})
        Boolean insuranceDocsReceived
    ) {}

    public record EstimateResponse(
        Estimate estimate,
        List<EstimateLine> lines
    ) {}

    public record EstimateDecisionResponse(
        Estimate estimate,
        RepairOrder repairOrder
    ) {}
}
