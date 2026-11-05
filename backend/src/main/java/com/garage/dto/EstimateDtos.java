package com.garage.dto;

import com.garage.model.entity.Estimate;
import com.garage.model.entity.EstimateLine;
import com.garage.model.entity.RepairOrder;

import java.math.BigDecimal;
import java.util.List;

public class EstimateDtos {

    public record CreateEstimateRequest(
        Long repairId,
        String diagnosisNote,
        List<EstimateLineRequest> lines
    ) {}

    public record EstimateLineRequest(
        String lineType,
        Long partId,
        String description,
        Integer qty,
        BigDecimal unitPrice
    ) {}

    public record EstimateDecisionRequest(
        String decision,
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
