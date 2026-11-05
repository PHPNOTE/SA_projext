package com.garage.repository;

import com.garage.model.entity.Vehicle;

import java.util.List;
import java.util.Optional;

public interface VehicleRepository {
    Vehicle save(Vehicle vehicle);
    Optional<Vehicle> findById(Long vehicleId);
    Optional<Vehicle> findByPlate(String plate);
    List<Vehicle> findByCustomerId(Long customerId);
    List<Vehicle> findAll();
    void update(Vehicle vehicle);
    long count();
}
