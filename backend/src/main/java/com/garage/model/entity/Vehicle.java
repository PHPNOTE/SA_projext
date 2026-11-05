package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

public record Vehicle(
    Long vehicleId,
    Long customerId,
    String plate,
    String make,
    String model,
    int year
) {
    public static final RowMapper<Vehicle> ROW_MAPPER = (rs, rowNum) -> new Vehicle(
        rs.getLong("vehicle_id"),
        rs.getLong("customer_id"),
        rs.getString("plate"),
        rs.getString("make"),
        rs.getString("model"),
        rs.getInt("year")
    );

    public Vehicle withVehicleId(Long newId) {
        return new Vehicle(newId, customerId, plate, make, model, year);
    }
}
