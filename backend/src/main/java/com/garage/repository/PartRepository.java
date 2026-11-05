package com.garage.repository;

import com.garage.model.entity.Part;

import java.util.List;
import java.util.Optional;

public interface PartRepository {
    Part save(Part part);
    Optional<Part> findById(Long partId);
    Optional<Part> findByIdForUpdate(Long partId);
    Optional<Part> findBySku(String sku);
    List<Part> findLowStock();
    List<Part> findAllActive();
    List<Part> findAll();
    void updateStockCounters(Long partId, int newOnHand, int newReserved);
    void update(Part part);
    long count();
}
