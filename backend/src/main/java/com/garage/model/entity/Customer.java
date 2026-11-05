package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

public record Customer(
    Long customerId,
    String name,
    String phone,
    String note
) {
    public static final RowMapper<Customer> ROW_MAPPER = (rs, rowNum) -> new Customer(
        rs.getLong("customer_id"),
        rs.getString("name"),
        rs.getString("phone"),
        rs.getString("note")
    );

    public Customer withCustomerId(Long newId) {
        return new Customer(newId, name, phone, note);
    }
}
