package com.garage.repository;

import com.garage.model.entity.Estimate;

import java.util.List;
import java.util.Optional;

public interface EstimateRepository {
    Estimate save(Estimate estimate);
    Optional<Estimate> findById(Long estimateId);
    List<Estimate> findByRepairId(Long repairId);
    Optional<Estimate> findByRepairIdAndRevisionNo(Long repairId, int revisionNo);
    Optional<Estimate> findLatestRevision(Long repairId);
    void updateStatus(Long estimateId, Estimate.EstimateStatus status);
    List<Estimate> findAll();
    long count();
}
