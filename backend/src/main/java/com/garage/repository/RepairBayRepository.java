package com.garage.repository;

import com.garage.model.entity.RepairBay;

import java.util.List;
import java.util.Optional;

public interface RepairBayRepository {
    RepairBay save(RepairBay bay);
    Optional<RepairBay> findById(Long bayId);
    Optional<RepairBay> findByName(String name);
    List<RepairBay> findAllActive();
    List<RepairBay> findAll();
    void update(RepairBay bay);
    boolean isBayOccupied(Long bayId);
    long count();
}
