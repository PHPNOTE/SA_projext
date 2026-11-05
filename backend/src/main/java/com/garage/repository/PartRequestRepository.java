package com.garage.repository;

import com.garage.model.entity.PartRequest;

import java.util.List;
import java.util.Optional;

public interface PartRequestRepository {
    PartRequest save(PartRequest request);
    Optional<PartRequest> findById(Long requestId);
    Optional<PartRequest> findByEstimateLineId(Long estimateLineId);
    Optional<PartRequest> findBySaleOrderLineId(Long saleOrderLineId);
    List<PartRequest> findByPartIdAndStatus(Long partId, PartRequest.PartRequestStatus status);
    void updateStatusAndQtys(Long requestId, PartRequest.PartRequestStatus status, int qtyIssued, int qtyReturned);
    List<PartRequest> findAll();
    long count();
}
