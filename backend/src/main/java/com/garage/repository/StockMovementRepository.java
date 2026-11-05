package com.garage.repository;

import com.garage.model.entity.StockMovement;

import java.util.List;
import java.util.Optional;

public interface StockMovementRepository {
    StockMovement save(StockMovement movement);
    Optional<StockMovement> findById(Long movementId);
    List<StockMovement> findByPartId(Long partId);
    List<StockMovement> findAll();
    long count();
}
