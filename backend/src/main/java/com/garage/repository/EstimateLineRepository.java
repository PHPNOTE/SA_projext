package com.garage.repository;

import com.garage.model.entity.EstimateLine;

import java.util.List;
import java.util.Optional;

public interface EstimateLineRepository {
    EstimateLine save(EstimateLine line);
    void batchInsert(List<EstimateLine> lines);
    Optional<EstimateLine> findById(Long lineId);
    List<EstimateLine> findByEstimateId(Long estimateId);
    void deleteByEstimateId(Long estimateId);
    List<EstimateLine> findAll();
    long count();
}
