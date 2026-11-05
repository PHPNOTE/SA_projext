package com.garage.repository;

import com.garage.model.entity.Customer;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository {
    Customer save(Customer customer);
    Optional<Customer> findById(Long customerId);
    Optional<Customer> findByPhone(String phone);
    List<Customer> searchByNameOrPhone(String query);
    List<Customer> findAll();
    void update(Customer customer);
    long count();
}
